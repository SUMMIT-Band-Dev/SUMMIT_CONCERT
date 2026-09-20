import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { ProcessMutex } from '../common/process-mutex.js';
import { SONG_NOT_FOUND_MESSAGE } from '../songs/songs.constants.js';
import { YoutubeMaintenanceService } from './youtube-maintenance.service.js';
import { YoutubeQuotaExhaustedException } from './youtube-quota-exhausted.exception.js';
import { YoutubeQuotaService, type QuotaStatus } from './youtube-quota.service.js';
import { selectCandidates, type SelectedCandidate } from './youtube-score.js';
import { isStorableVideoId } from './youtube-video-id.js';
import {
  YOUTUBE_API_KEY_MESSAGE,
  YOUTUBE_BATCH_ABORT_AFTER_CONSECUTIVE_ERRORS,
  YOUTUBE_BATCH_ALREADY_RUNNING_MESSAGE,
  YOUTUBE_CANDIDATE_LIMIT,
  YOUTUBE_CHANNEL_TITLE_MAX_LENGTH,
  YOUTUBE_MAX_CONSECUTIVE_FAILURES,
  YOUTUBE_RESERVATION_STALE_MINUTES,
  YOUTUBE_THUMBNAIL_ALLOWED_HOSTS,
  YOUTUBE_THUMBNAIL_URL_MAX_LENGTH,
  YOUTUBE_TITLE_MAX_LENGTH,
} from './youtube-search.constants.js';
import {
  YOUTUBE_SEARCH_CLIENT,
  YoutubeApiKeyError,
  YoutubeQuotaExceededError,
  YoutubeTimeoutError,
  type YoutubeSearchClient,
  type YoutubeSearchItem,
} from './youtube-search.client.js';

/** 배치가 멈춘 이유. `null`이면 상한까지 정상적으로 처리한 것이다. */
export type BatchAbortReason = 'quota' | 'api_key' | 'consecutive_errors' | null;

export interface BatchSummary {
  processed: number;
  searched: number;
  noResults: number;
  failed: number;
  abortedBy: BatchAbortReason;
  remainingTargets: number;
  quota: QuotaStatus;
}

export interface SongTarget {
  id: bigint;
  title: string;
  singer: string | null;
}

type AttemptOutcome = 'searched' | 'no_results' | 'failed';

/**
 * 유튜브 배치 추천 검색 (PRD F011).
 *
 * ## 한 곡을 처리하는 순서
 *
 * ```
 *   ① 짧은 TX: 시도 행 INSERT (outcome='reserved')  ← 예약, 즉시 커밋
 *   ② ─────── 외부 호출 (DB 트랜잭션·잠금 없음) ───────
 *   ③ 짧은 TX: 후보 INSERT + 시도 UPDATE
 * ```
 *
 * ①을 호출 **전에** 커밋하는 것이 핵심이다. ② 도중에 프로세스가 죽어도 행이 남아
 * 일일 쿼터 집계에 포함된다. 쿼터를 적게 세는 쪽이 훨씬 위험하다 — `search.list`는
 * 별도 버킷에 하루 100회뿐이라 한 번 넘기면 그날이 통째로 죽는다.
 *
 * ②에서 DB 트랜잭션을 열지 않는 것도 의도다(§13 앨범 커버와 같은 원칙). 잠금을 쥔 채
 * 네트워크를 기다리면 같은 곡을 건드리는 다른 요청이 그만큼 막힌다.
 *
 * ## 중복 실행
 *
 * `ProcessMutex`로 막는다. DB advisory lock을 쓰지 않은 이유는 `process-mutex.ts` 주석 참조 —
 * 요약하면 Prisma의 pg 풀에서 잠금을 잡은 커넥션과 푸는 커넥션이 달라질 수 있다.
 *
 * ## 실패 분류 — `completedAt`이 기준이다
 *
 * | 상황 | outcome | completedAt | 쿼터 집계 | 곡별 연속 실패수 |
 * | --- | --- | --- | --- | --- |
 * | 타임아웃 / 5xx / 파싱 실패 | failed | **채움** | 포함 | **포함** |
 * | 쿼터 초과 / 키 오류 | failed | **NULL** | 포함 | **제외** |
 * | 크래시 후 정리 | failed | **NULL** | 포함 | **제외** |
 *
 * `completedAt`은 "외부 호출이 **이 곡에 대한 판정**으로 귀결된 시각"이다. 쿼터 초과와
 * 키 오류는 곡을 평가조차 못 한 것이므로 그 곡의 실패로 세면 안 된다 — 안 그러면 쿼터가
 * 떨어진 날 세 곡이 영구히 배치에서 빠진다.
 */
@Injectable()
export class YoutubeBatchService {
  private readonly logger = new Logger(YoutubeBatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(YOUTUBE_SEARCH_CLIENT) private readonly client: YoutubeSearchClient,
    private readonly quota: YoutubeQuotaService,
    private readonly maintenance: YoutubeMaintenanceService,
    private readonly mutex: ProcessMutex,
  ) {}

  /**
   * 대상을 자동 선정해 최대 `limit`곡을 처리한다.
   *
   * ## 중단했을 때의 응답 — 혼합안
   *
   * | 상황 | 응답 |
   * | --- | --- |
   * | 쿼터 초과로 멈췄고 **결과를 하나도 못 냈다**(`searched`·`noResults`가 모두 0) | **429 + `Retry-After`** |
   * | 키 오류로 멈췄다 | **500** (서버 설정 문제다) |
   * | 중간에 멈춘 부분 성공 / 연속 실패 중단 | **200 + `abortedBy`** |
   *
   * 부분 성공을 200으로 두는 이유는 이미 저장한 후보를 응답에 그대로 담아야 하기 때문이다 —
   * 429/500으로 돌려주면 클라이언트는 "아무것도 안 됐다"고 읽는다. 반대로 아무것도 처리하지
   * 못한 쿼터 소진은 상태 코드만으로 판단할 수 있어야 하고 다음 시도 시각(`Retry-After`)이 필요하다.
   *
   * 키 오류는 부분 성공이 있어도 500이다. 곡 문제가 아니라 서버 설정 문제이고, 이미 저장한 결과는
   * DB에 남아 있어 잃지 않는다. **응답과 로그에 키·헤더를 싣지 않는다**(고정 문구만 내보낸다).
   *
   * 검증용 `searchForSong`에는 이 매핑을 적용하지 않는다 — 요약을 그대로 받아야 한다.
   */
  async runBatch(limit: number): Promise<BatchSummary> {
    const outcome = await this.mutex.tryRun(() => this.runExclusive(limit));
    if (!outcome.ran) {
      throw new ConflictException(YOUTUBE_BATCH_ALREADY_RUNNING_MESSAGE);
    }

    return assertBatchResponse(outcome.value);
  }

  /**
   * **곡 하나를 명시적으로 지정해** 검색한다.
   *
   * 대상 자동 선정을 거치지 않는다. 프로덕션에서 임시 곡만으로 쓰기 검증을 하기 위한
   * 진입점이다 — 공개 배치 엔드포인트를 부르면 실제 59곡에 시도 행이 쓰인다.
   * 컨트롤러에 노출하지 않는다(라우트가 없다).
   */
  async searchForSong(songId: bigint): Promise<BatchSummary> {
    const song = await this.prisma.setlist.findUnique({
      where: { id: songId },
      select: { id: true, title: true, singer: true },
    });
    if (!song) {
      throw new NotFoundException(SONG_NOT_FOUND_MESSAGE);
    }

    const outcome = await this.mutex.tryRun(() => this.processTargets([song]));
    if (!outcome.ran) {
      throw new ConflictException(YOUTUBE_BATCH_ALREADY_RUNNING_MESSAGE);
    }

    return outcome.value;
  }

  /**
   * **DB에 쓰지 않고** 검색·후보 선정만 해서 돌려준다 (캘리브레이션용).
   *
   * ⚠️ 호출은 실제로 나가므로 **쿼터는 소모되는데 시도 행이 남지 않아 집계에 잡히지 않는다.**
   * 일일 상한을 100이 아니라 80으로 둔 20회의 여유가 이 용도를 덮는다. 상시 경로가 아니라
   * 게이트 승인 아래 소수 호출로만 쓴다.
   */
  async previewSearch(title: string, singer: string | null): Promise<SelectedCandidate[]> {
    const query = buildSearchQuery(title, singer);
    const items = await this.client.search(query);

    return selectCandidates(items.filter((item) => this.isStorable(item)), {
      query,
      title,
      artist: singer ?? '',
      limit: YOUTUBE_CANDIDATE_LIMIT,
    });
  }

  private async runExclusive(limit: number): Promise<BatchSummary> {
    await this.maintenance.run();
    const targets = await this.selectTargets(limit);

    return this.processTargets(targets);
  }

  private async processTargets(targets: SongTarget[]): Promise<BatchSummary> {
    let searched = 0;
    let noResults = 0;
    let failed = 0;
    let processed = 0;
    let consecutiveErrors = 0;
    let abortedBy: BatchAbortReason = null;

    for (const song of targets) {
      const quota = await this.quota.getStatus();
      if (quota.remaining <= 0) {
        abortedBy = 'quota';
        break;
      }

      const result = await this.processOne(song);
      processed += 1;

      if (result === 'searched') {
        searched += 1;
        consecutiveErrors = 0;
      } else if (result === 'no_results') {
        noResults += 1;
        consecutiveErrors = 0;
      } else {
        failed += 1;
        consecutiveErrors += 1;
      }

      if (result === 'abort_quota') {
        abortedBy = 'quota';
        break;
      }
      if (result === 'abort_api_key') {
        abortedBy = 'api_key';
        break;
      }
      if (consecutiveErrors >= YOUTUBE_BATCH_ABORT_AFTER_CONSECUTIVE_ERRORS) {
        abortedBy = 'consecutive_errors';
        break;
      }
    }

    return {
      processed,
      searched,
      noResults,
      failed,
      abortedBy,
      remainingTargets: await this.countTargets(),
      quota: await this.quota.getStatus(),
    };
  }

  /** 한 곡: 예약 → 외부 호출 → 완료 기록. 예외를 밖으로 던지지 않고 결과로 돌려준다. */
  private async processOne(
    song: SongTarget,
  ): Promise<AttemptOutcome | 'abort_quota' | 'abort_api_key'> {
    const query = buildSearchQuery(song.title, song.singer);

    // ① 예약 — 외부 호출 전에 커밋된다.
    const attempt = await this.prisma.youtubeSearchAttempt.create({
      data: { songId: song.id, query },
      select: { id: true },
    });

    let items: YoutubeSearchItem[];
    try {
      // ② 외부 호출 — DB 트랜잭션도 잠금도 쥐고 있지 않다.
      items = await this.client.search(query);
    } catch (error) {
      return this.recordFailure(attempt.id, song.id, error);
    }

    // 후보는 저장 가능한 항목 중 **YouTube 원본 순서 상위 N개**다. 점수는 참고값으로만 저장한다
    // (게이트 2 캘리브레이션: 점수 정렬이 원본 순서보다 나빴다 — youtube-score.ts 주석 참조).
    const candidates = selectCandidates(items.filter((item) => this.isStorable(item)), {
      query,
      title: song.title,
      artist: song.singer ?? '',
      limit: YOUTUBE_CANDIDATE_LIMIT,
    });

    const now = new Date();

    if (candidates.length === 0) {
      // 결과 0건은 오류가 아니다. 같은 검색어로 다시 검색해도 같은 결과라 재시도 대상에서 뺀다
      // (재큐하거나 곡 제목·가수를 고치면 돌아온다).
      await this.prisma.youtubeSearchAttempt.update({
        where: { id: attempt.id },
        data: { outcome: 'no_results', completedAt: now },
      });
      return 'no_results';
    }

    // ③ 후보 저장과 상태 전환을 한 트랜잭션으로. 나누면 "open인데 후보가 없는" 시도가 생긴다.
    await this.prisma.$transaction(async (tx) => {
      await tx.youtubeRecommendation.createMany({
        data: candidates.map((candidate) => ({
          attemptId: attempt.id,
          rank: candidate.rank,
          score: candidate.score,
          videoId: candidate.videoId,
          title: candidate.title,
          channelTitle: candidate.channelTitle,
          thumbnailUrl: candidate.thumbnailUrl,
        })),
      });
      await tx.youtubeSearchAttempt.update({
        where: { id: attempt.id },
        data: {
          outcome: 'searched',
          reviewState: 'open',
          candidateCount: candidates.length,
          completedAt: now,
        },
      });
    });

    return 'searched';
  }

  /** 실패를 기록한다. `completedAt`을 채울지가 분류의 전부다 (클래스 주석의 표 참조). */
  private async recordFailure(
    attemptId: bigint,
    songId: bigint,
    error: unknown,
  ): Promise<'failed' | 'abort_quota' | 'abort_api_key'> {
    const systemFault =
      error instanceof YoutubeQuotaExceededError || error instanceof YoutubeApiKeyError;

    await this.prisma.youtubeSearchAttempt.update({
      where: { id: attemptId },
      data: { outcome: 'failed', completedAt: systemFault ? null : new Date() },
    });

    // 입력값이나 응답 본문은 남기지 않는다. 어떤 종류의 실패인지만 있으면 충분하다.
    this.logger.warn(
      `유튜브 배치 검색 실패 (songId=${songId}, kind=${describeError(error)})`,
    );

    if (error instanceof YoutubeQuotaExceededError) return 'abort_quota';
    if (error instanceof YoutubeApiKeyError) return 'abort_api_key';

    return 'failed';
  }

  /**
   * 저장해도 되는 후보인지 본다.
   *
   * **클라이언트가 아니라 여기서** 거르는 이유는 캘리브레이션 때문이다 — 클라이언트가
   * 걸러 버리면 실제 응답 분포(특히 썸네일 호스트)를 관측할 수 없어 "왜 후보가 0건인지"가
   * 가려진다 (§13 앨범 커버 mapper와 같은 판단).
   *
   * 길이 초과는 **자르지 않고 후보를 버린다.** 잘린 제목은 관리자가 잘못 판단할 근거가 된다.
   */
  private isStorable(item: YoutubeSearchItem): boolean {
    if (!isStorableVideoId(item.videoId)) {
      this.logger.warn(`후보 제외: 저장할 수 없는 영상 ID 형식`);
      return false;
    }
    if (item.title.length > YOUTUBE_TITLE_MAX_LENGTH) return false;
    if (item.channelTitle.length > YOUTUBE_CHANNEL_TITLE_MAX_LENGTH) return false;
    if (item.thumbnailUrl.length > YOUTUBE_THUMBNAIL_URL_MAX_LENGTH) return false;

    let host: string;
    try {
      const url = new URL(item.thumbnailUrl);
      if (url.protocol !== 'https:') return false;
      host = url.hostname;
    } catch {
      return false;
    }

    if (!YOUTUBE_THUMBNAIL_ALLOWED_HOSTS.includes(host)) {
      // 호스트만 남긴다(URL 전문은 남기지 않는다). allowlist가 아직 실측으로 확정되지
      // 않았으므로, 이 로그가 곧 확정 근거가 된다.
      this.logger.warn(`후보 제외: 허용되지 않은 썸네일 호스트 (${host})`);
      return false;
    }

    return true;
  }

  private selectTargets(limit: number): Promise<SongTarget[]> {
    return this.prisma.$queryRaw<SongTarget[]>(Prisma.sql`
      ${TARGET_CTE}
      SELECT s.id, s.title, s.singer
        FROM "Setlist" s
        LEFT JOIN consecutive_failures cf ON cf."songId" = s.id
        LEFT JOIN last_attempt la ON la."songId" = s.id
       WHERE ${TARGET_PREDICATE}
       ORDER BY la.at ASC NULLS FIRST, s.id ASC
       LIMIT ${limit}
    `);
  }

  private async countTargets(): Promise<number> {
    const [row] = await this.prisma.$queryRaw<Array<{ n: number }>>(Prisma.sql`
      ${TARGET_CTE}
      SELECT count(*)::int AS n
        FROM "Setlist" s
        LEFT JOIN consecutive_failures cf ON cf."songId" = s.id
        LEFT JOIN last_attempt la ON la."songId" = s.id
       WHERE ${TARGET_PREDICATE}
    `);

    return row?.n ?? 0;
  }
}

/**
 * 배치 대상 판정의 공통 CTE.
 *
 * `valid`는 **무효화되지 않은** 시도만 본다. 곡 제목·가수가 바뀌거나 관리자가 재큐하면
 * `invalidatedAt`이 찍히고, 그 순간 아래 제외 조건이 전부 풀려 곡이 대상으로 돌아온다.
 *
 * `consecutive_failures`가 `completedAt IS NOT NULL`을 요구하는 것이 중요하다 —
 * 쿼터 초과·키 오류·크래시 잔재는 **곡 탓이 아닌 실패**라 곡을 배치에서 밀어내면 안 된다.
 * 판정 기준 전체는 `YoutubeBatchService` 클래스 주석의 표에 있다.
 */
const TARGET_CTE = Prisma.sql`
  WITH valid AS (
    SELECT "songId", "searchedAt", "completedAt", "outcome", "reviewState"
      FROM "YoutubeSearchAttempt"
     WHERE "invalidatedAt" IS NULL
  ),
  last_resolved AS (
    SELECT "songId", MAX("searchedAt") AS at
      FROM valid WHERE "outcome" IN ('searched', 'no_results')
     GROUP BY "songId"
  ),
  consecutive_failures AS (
    SELECT v."songId", count(*)::int AS n
      FROM valid v
      LEFT JOIN last_resolved lr ON lr."songId" = v."songId"
     WHERE v."outcome" = 'failed'
       AND v."completedAt" IS NOT NULL
       AND (lr.at IS NULL OR v."searchedAt" > lr.at)
     GROUP BY v."songId"
  ),
  last_attempt AS (
    SELECT "songId", MAX("searchedAt") AS at FROM valid GROUP BY "songId"
  )
`;

/**
 * 대상 조건.
 *
 * `ORDER BY la.at ASC NULLS FIRST`(선정 쿼리 쪽)와 짝이다 — **한 번도 시도하지 않은 곡이
 * 항상 먼저** 처리되어, 실패를 반복하는 곡이 신규 곡의 쿼터를 뺏지 않는다.
 */
const TARGET_PREDICATE = Prisma.sql`
       s."youtube_url" IS NULL
   AND s."youtube_review_status" = 'pending'
   AND NOT EXISTS (
         SELECT 1 FROM valid v WHERE v."songId" = s.id AND v."reviewState" = 'open')
   AND NOT EXISTS (
         SELECT 1 FROM valid v WHERE v."songId" = s.id AND v."outcome" = 'reserved'
           AND v."searchedAt" > now() - (${YOUTUBE_RESERVATION_STALE_MINUTES}::int * interval '1 minute'))
   AND NOT EXISTS (
         SELECT 1 FROM valid v WHERE v."songId" = s.id AND v."outcome" = 'no_results')
   AND COALESCE(cf.n, 0) < ${YOUTUBE_MAX_CONSECUTIVE_FAILURES}::int
`;

/**
 * 중단 사유를 응답 형태로 바꾼다 (`runBatch` 주석의 표).
 *
 * 던지는 예외에는 **고정 문구만** 실린다. 요약·에러 객체·요청 헤더는 응답에 섞이지 않는다.
 */
function assertBatchResponse(summary: BatchSummary): BatchSummary {
  if (summary.abortedBy === 'api_key') {
    throw new InternalServerErrorException(YOUTUBE_API_KEY_MESSAGE);
  }

  if (summary.abortedBy === 'quota' && summary.searched === 0 && summary.noResults === 0) {
    const waitMs = Date.parse(summary.quota.resetsAt) - Date.now();
    // 0초를 돌려주면 즉시 재시도해도 된다는 뜻이 된다. 최소 1초.
    throw new YoutubeQuotaExhaustedException(Math.max(1, Math.ceil(waitMs / 1000)));
  }

  return summary;
}

/**
 * 검색어를 만든다.
 *
 * 프론트 폴백이 `` `${track.title} ${track.artist}`.trim() `` 으로 만드는 것과 같은 모양이다
 * (`src/lib/open-track-video.ts`). 괄호·`feat.` 같은 토큰을 **일부러 제거하지 않는다** —
 * 근거 없이 쿼리를 가공하면 결과가 왜 달라졌는지 설명할 수 없다(§13 `buildSearchTerm`과 같은 방침).
 *
 * NFC 정규화만 더한다. macOS에서 복사한 한글은 자모가 분리된 NFD로 들어올 수 있고,
 * 그대로 보내면 눈에 같아 보이는 문자열이 다른 검색어가 된다.
 */
export function buildSearchQuery(title: string, singer: string | null): string {
  const normalize = (value: string) => value.normalize('NFC').replace(/\s+/g, ' ').trim();

  return [normalize(title), normalize(singer ?? '')].filter(Boolean).join(' ');
}

function describeError(error: unknown): string {
  if (error instanceof YoutubeQuotaExceededError) return 'quota_exceeded';
  if (error instanceof YoutubeApiKeyError) return 'api_key';
  if (error instanceof YoutubeTimeoutError) return 'timeout';

  return 'upstream';
}
