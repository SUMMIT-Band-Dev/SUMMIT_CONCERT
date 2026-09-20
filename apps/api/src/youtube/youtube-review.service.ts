import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseBigIntId } from '../common/parse-bigint.pipe.js';
import { SONG_NOT_FOUND_MESSAGE } from '../songs/songs.constants.js';
import { toSongResponse, type SongResponse } from '../songs/dto/song-response.js';
import { invalidateAttempts } from './youtube-attempt.js';
import { isStorableVideoId, toWatchUrl } from './youtube-video-id.js';
import {
  toRecommendationResponse,
  type RecommendationListResponse,
} from './dto/recommendation-response.js';
import type { ListRecommendationsQuery } from './dto/review-recommendation.dto.js';
import {
  YOUTUBE_ATTEMPT_NOT_FOUND_MESSAGE,
  YOUTUBE_ATTEMPT_NOT_OPEN_MESSAGE,
  YOUTUBE_CANDIDATE_NOT_FOUND_MESSAGE,
  YOUTUBE_REQUEUE_NOT_ALLOWED_MESSAGE,
  YOUTUBE_RETENTION_DAYS,
  YOUTUBE_SONG_ALREADY_LINKED_MESSAGE,
} from './youtube-search.constants.js';

/** 잠금 대상을 최소 형태로만 읽는다. 전체 행을 끌어올 이유가 없다. */
interface LockedSong {
  id: bigint;
  youtube_url: string | null;
  youtube_review_status: string;
}

/**
 * 유튜브 추천 리뷰 — 승인 / 반려 / 재큐 (PRD F012).
 *
 * ## 리뷰 단위는 곡이다
 *
 * 후보를 여러 개 보여 주되, 승인은 **그중 하나를 고르는 것**이고 반려는 **그 시도 전체를
 * 버리는 것**이다. 후보별로 독립적인 상태를 두지 않는 이유는 한 곡에 영상이 하나만
 * 연결되기 때문이다 — 후보 단위 상태는 저장할 곳도 쓸 곳도 없다.
 *
 * ## 잠금 순서: `Setlist` → `YoutubeSearchAttempt`
 *
 * `common/lock-order.ts`의 전역 순서를 따른다. 곡 행을 먼저 `FOR UPDATE`로 잡고, 그 안에서
 * 시도 행을 잡는다. 역순으로 잡는 경로가 프로젝트 어디에도 없어 데드락이 성립하지 않는다.
 *
 * 시도 행을 **읽기만** 하는 것은 잠금 밖에서 해도 된다(잠금을 잡지 않으므로 순서와 무관).
 * 판단은 전부 잠금 안에서 다시 읽은 값으로 한다.
 *
 * ## 후보는 리뷰가 끝나는 순간 전부 지운다
 *
 * 승인·반려 모두 `deleteMany`가 따라붙는다. YouTube 개발자 정책의 30일 보관 제한 대응이며
 * (해석은 구현자의 것, 법적 확인 없음), 그래서 승인 기록에 남는 것은 videoId가 아니라
 * **등수(`approvedRank`)** 뿐이다. 승인된 videoId는 `Setlist.youtube_url`에만 존재한다.
 */
@Injectable()
export class YoutubeReviewService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 추천 목록 (PRD F012).
   *
   * 30일이 지난 시도의 후보는 정리가 아직 돌지 않았더라도 **응답에서 뺀다.** 정리는 배치
   * 실행과 `npm run youtube:cleanup`에서만 돌기 때문에, 조회 쪽에서도 같은 기준을 걸어야
   * 보관 제한이 "정리가 언제 돌았는가"에 좌우되지 않는다.
   */
  async list(query: ListRecommendationsQuery): Promise<RecommendationListResponse> {
    const cursor = query.cursor === undefined ? null : parseBigIntId(query.cursor);
    if (query.cursor !== undefined && cursor === null) {
      throw new BadRequestException('커서 형식이 올바르지 않습니다.');
    }

    // limit + 1을 읽어 "다음 페이지가 있는가"를 별도 쿼리 없이 판단한다.
    const rows = await this.prisma.youtubeSearchAttempt.findMany({
      where: { reviewState: query.state, ...(cursor === null ? {} : { id: { lte: cursor } }) },
      orderBy: { id: 'desc' },
      take: query.limit + 1,
      select: {
        id: true,
        songId: true,
        query: true,
        searchedAt: true,
        outcome: true,
        reviewState: true,
        candidateCount: true,
        approvedRank: true,
        rejectedReason: true,
        reviewedAt: true,
        song: { select: { title: true, singer: true } },
        recommendations: {
          orderBy: { rank: 'asc' },
          select: {
            rank: true,
            score: true,
            videoId: true,
            title: true,
            channelTitle: true,
            thumbnailUrl: true,
          },
        },
      },
    });

    const page = rows.slice(0, query.limit);
    const nextCursor = rows.length > query.limit ? rows[query.limit].id.toString() : null;
    const cutoff = retentionCutoff();

    return {
      items: page.map((attempt) =>
        toRecommendationResponse(attempt, {
          includeCandidates: attempt.searchedAt >= cutoff,
        }),
      ),
      nextCursor,
    };
  }

  /**
   * 후보 하나를 승인해 곡에 연결한다 (PRD F012).
   *
   * 잠금 안에서 **세 가지를 다시 확인**한다. 셋 다 "목록을 보고 있는 사이에 세상이 바뀐"
   * 경우를 잡기 위한 것이다.
   * 1. 곡에 아직 URL이 없고 상태가 `pending`인가 → 아니면 409 (그 사이 F013 수동 입력)
   * 2. 시도가 아직 `open`인가 → 아니면 409 (이미 처리됨 / 다른 탭에서 승인)
   * 3. 고른 영상이 **이 시도의 후보 목록에 실재**하는가 → 아니면 400
   *
   * 재승인을 멱등 200으로 처리하지 않고 409로 두는 이유는, 같은 응답을 주면 "누가 언제
   * 무엇을 승인했는가"가 흐려지기 때문이다.
   */
  async approve(attemptId: bigint, videoId: string): Promise<SongResponse> {
    const attempt = await this.prisma.youtubeSearchAttempt.findUnique({
      where: { id: attemptId },
      select: { id: true, songId: true },
    });
    if (!attempt) {
      throw new NotFoundException(YOUTUBE_ATTEMPT_NOT_FOUND_MESSAGE);
    }

    return this.prisma.$transaction(async (tx) => {
      const song = await lockSong(tx, attempt.songId);
      assertSongOpenForReview(song);
      await lockOpenAttempt(tx, attemptId);

      const candidate = await tx.youtubeRecommendation.findFirst({
        where: { attemptId, videoId },
        select: { rank: true, videoId: true },
      });
      if (!candidate) {
        throw new BadRequestException(YOUTUBE_CANDIDATE_NOT_FOUND_MESSAGE);
      }
      // 저장 직전 마지막 관문. 배치가 이미 걸렀지만 DB에 들어간 값을 그대로 믿지 않는다 —
      // §14의 예약어 결함이 "형식이 맞으면 영상이 존재한다"는 가정에서 나왔다.
      if (!isStorableVideoId(candidate.videoId)) {
        throw new BadRequestException(YOUTUBE_CANDIDATE_NOT_FOUND_MESSAGE);
      }

      const now = new Date();
      const updated = await tx.setlist.update({
        where: { id: attempt.songId },
        data: {
          youtubeUrl: toWatchUrl(candidate.videoId),
          youtubeReviewStatus: 'approved',
        },
      });

      await tx.youtubeRecommendation.deleteMany({ where: { attemptId } });
      await tx.youtubeSearchAttempt.update({
        where: { id: attemptId },
        data: { reviewState: 'approved', approvedRank: candidate.rank, reviewedAt: now },
      });

      return toSongResponse(updated);
    });
  }

  /**
   * 추천을 반려한다 (PRD F012).
   *
   * 곡 상태를 `rejected`로 바꾼다. 배치 대상은 `pending`만이라 **이후 자동 재검색에서
   * 빠진다**(PRD 요구). `youtube_url`은 건드리지 않는다 — 반려는 `url IS NULL`인 곡에만
   * 일어나므로 비울 것이 애초에 없다.
   *
   * 영구 제외가 아니다. 검색어를 고치거나(곡 제목·가수 수정) 재큐하면 돌아온다.
   */
  async reject(attemptId: bigint, reason: string | undefined): Promise<SongResponse> {
    const attempt = await this.prisma.youtubeSearchAttempt.findUnique({
      where: { id: attemptId },
      select: { id: true, songId: true },
    });
    if (!attempt) {
      throw new NotFoundException(YOUTUBE_ATTEMPT_NOT_FOUND_MESSAGE);
    }

    return this.prisma.$transaction(async (tx) => {
      const song = await lockSong(tx, attempt.songId);
      assertSongOpenForReview(song);
      await lockOpenAttempt(tx, attemptId);

      const now = new Date();
      const updated = await tx.setlist.update({
        where: { id: attempt.songId },
        data: { youtubeReviewStatus: 'rejected' },
      });

      await tx.youtubeRecommendation.deleteMany({ where: { attemptId } });
      await tx.youtubeSearchAttempt.update({
        where: { id: attemptId },
        // CHECK `rejected_reason_valid`가 "사유는 rejected일 때만"을 강제한다.
        data: { reviewState: 'rejected', rejectedReason: reason ?? null, reviewedAt: now },
      });

      return toSongResponse(updated);
    });
  }

  /**
   * 곡을 다시 배치 대상으로 되돌린다.
   *
   * PRD는 "반려 시 이후 배치 재검색 대상에서 제외"라고만 정했는데, 그대로면 반려한 곡은
   * F013 수동 입력 외에 탈출구가 없다. 곡명 오타를 고치고 다시 돌리고 싶은 경우가 실제로
   * 있으므로 **명시적 재큐**를 둔다 — *자동* 재검색에서 빠진다는 PRD 취지는 그대로다.
   *
   * 대상은 두 가지다.
   * - `rejected` 곡 — 사람이 "이 추천은 틀렸다"고 판단한 경우
   * - 유효한 `no_results` 시도가 있는 곡 — 검색 결과가 0건이라 자동 재검색에서 빠진 경우
   *
   * URL이 이미 있는 곡은 받지 않는다. 배치 대상 조건이 `youtube_url IS NULL`이라 되돌려도
   * 아무 일도 일어나지 않고, "되돌렸는데 왜 안 돌지"라는 혼란만 남는다.
   */
  async requeue(songId: bigint): Promise<SongResponse> {
    return this.prisma.$transaction(async (tx) => {
      const song = await lockSong(tx, songId);

      const hasNoResults =
        (await tx.youtubeSearchAttempt.count({
          where: { songId, outcome: 'no_results', invalidatedAt: null },
        })) > 0;

      const eligible =
        song.youtube_url === null &&
        (song.youtube_review_status === 'rejected' ||
          (song.youtube_review_status === 'pending' && hasNoResults));

      if (!eligible) {
        throw new BadRequestException(YOUTUBE_REQUEUE_NOT_ALLOWED_MESSAGE);
      }

      const updated = await tx.setlist.update({
        where: { id: songId },
        data: { youtubeReviewStatus: 'pending' },
      });

      // 열린 추천을 닫고 이력 전체에 invalidatedAt을 찍어 제외 조건을 푼다.
      // 쿼터 집계에서는 빠지지 않는다 — 이미 쓴 호출은 되돌릴 수 없다.
      await invalidateAttempts(tx, songId);

      return toSongResponse(updated);
    });
  }
}

type ReviewClient = Pick<
  PrismaService,
  'setlist' | 'youtubeSearchAttempt' | 'youtubeRecommendation' | '$queryRaw'
>;

/**
 * 곡 행을 잠그고 최소 필드만 읽는다. 0행이면 404.
 *
 * enum을 `::text`로 캐스팅하는 이유는 드라이버가 사용자 정의 타입 파서를 갖고 있지 않아
 * 원문 문자열로 돌아오는 것에 기대지 않기 위해서다 — 명시적으로 text로 받는다.
 */
async function lockSong(tx: ReviewClient, songId: bigint): Promise<LockedSong> {
  const [song] = await tx.$queryRaw<LockedSong[]>`
    SELECT id, "youtube_url", "youtube_review_status"::text AS "youtube_review_status"
      FROM "Setlist" WHERE id = ${songId} FOR UPDATE
  `;

  if (!song) {
    throw new NotFoundException(SONG_NOT_FOUND_MESSAGE);
  }

  return song;
}

/** 그 사이 F013 수동 입력이 끼어들었는지 본다. */
function assertSongOpenForReview(song: LockedSong): void {
  if (song.youtube_url !== null || song.youtube_review_status !== 'pending') {
    throw new ConflictException(YOUTUBE_SONG_ALREADY_LINKED_MESSAGE);
  }
}

/** 시도 행을 잠그고 아직 `open`인지 확인한다. 아니면 409. */
async function lockOpenAttempt(tx: ReviewClient, attemptId: bigint): Promise<void> {
  const [locked] = await tx.$queryRaw<Array<{ reviewState: string }>>`
    SELECT "reviewState"::text AS "reviewState"
      FROM "YoutubeSearchAttempt" WHERE id = ${attemptId} FOR UPDATE
  `;

  if (!locked) {
    throw new NotFoundException(YOUTUBE_ATTEMPT_NOT_FOUND_MESSAGE);
  }
  if (locked.reviewState !== 'open') {
    throw new ConflictException(YOUTUBE_ATTEMPT_NOT_OPEN_MESSAGE);
  }
}

function retentionCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - YOUTUBE_RETENTION_DAYS * 24 * 60 * 60_000);
}
