import {
  ConflictException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProcessMutex } from '../common/process-mutex.js';
import { YoutubeBatchService, buildSearchQuery, type SongTarget } from './youtube-batch.service.js';
import {
  YoutubeApiKeyError,
  YoutubeQuotaExceededError,
  YoutubeTimeoutError,
  YoutubeUpstreamError,
  type YoutubeSearchClient,
  type YoutubeSearchItem,
} from './youtube-search.client.js';
import { YoutubeQuotaExhaustedException } from './youtube-quota-exhausted.exception.js';
import {
  YOUTUBE_API_KEY_MESSAGE,
  YOUTUBE_DAILY_SEARCH_LIMIT,
  YOUTUBE_QUOTA_EXHAUSTED_MESSAGE,
} from './youtube-search.constants.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { YoutubeMaintenanceService } from './youtube-maintenance.service.js';
import type { QuotaStatus, YoutubeQuotaService } from './youtube-quota.service.js';

const SONG: SongTarget = { id: 27n, title: '사랑의 미학', singer: '리도어 (Redoor)' };

const item = (over: Partial<YoutubeSearchItem> = {}): YoutubeSearchItem => ({
  videoId: 'BTo-I-gCAxk',
  title: '사랑의 미학 Official MV',
  description: '',
  channelTitle: 'Redoor',
  thumbnailUrl: 'https://i.ytimg.com/vi/BTo-I-gCAxk/mqdefault.jpg',
  ...over,
});

const quotaStatus = (remaining: number): QuotaStatus => ({
  usedToday: YOUTUBE_DAILY_SEARCH_LIMIT - remaining,
  limit: YOUTUBE_DAILY_SEARCH_LIMIT,
  remaining,
  resetsAt: '2026-09-21T07:00:00.000Z',
  timeZone: 'America/Los_Angeles',
});

/** 대상 선정 쿼리인가. 요약용 집계 쿼리에는 이 SELECT 목록이 없다. */
const isSelectTargets = (sql: string) => sql.includes('s.title');

interface HarnessOptions {
  targets?: SongTarget[];
  remainingTargets?: number;
  remainingQuota?: number | number[];
  search?: YoutubeSearchClient['search'];
}

function createHarness(options: HarnessOptions = {}) {
  const targets = options.targets ?? [SONG];
  let nextAttemptId = 100n;

  const attemptCreate = vi.fn(async () => ({ id: nextAttemptId++ }));
  // 인자 타입을 명시하지 않으면 mock.calls가 `[]` 튜플로 추론돼 호출 인자를 꺼낼 수 없다.
  const attemptUpdate = vi.fn(
    async (_args: { where: { id: bigint }; data: Record<string, unknown> }) => ({}),
  );
  const recommendationCreateMany = vi.fn(
    async (_args: { data: Array<{ rank: number; videoId: string }> }) => ({ count: 0 }),
  );

  const tx = {
    youtubeSearchAttempt: { update: attemptUpdate },
    youtubeRecommendation: { createMany: recommendationCreateMany },
  };

  // selectTargets / countTargets를 SQL 본문으로 구분한다.
  // ⚠️ `count(*)::int`로는 구분할 수 없다 — 공통 CTE(consecutive_failures)가 그 표현을
  //    이미 포함하고 있어 두 쿼리 모두에 나온다. 선정 쿼리에만 있는 SELECT 목록으로 본다.
  const $queryRaw = vi.fn(async (statement: { text?: string; sql?: string }) => {
    const text = String(statement?.text ?? statement?.sql ?? '');
    return isSelectTargets(text) ? targets : [{ n: options.remainingTargets ?? 0 }];
  });

  const prisma = {
    setlist: {
      findUnique: vi.fn(async ({ where }: { where: { id: bigint } }) =>
        targets.find((target) => target.id === where.id) ?? null,
      ),
    },
    youtubeSearchAttempt: { create: attemptCreate, update: attemptUpdate },
    youtubeRecommendation: { createMany: recommendationCreateMany },
    $queryRaw,
    $transaction: vi.fn(async (run: (client: typeof tx) => unknown) => run(tx)),
  } as unknown as PrismaService;

  const remaining = options.remainingQuota ?? 80;
  const remainingQueue = Array.isArray(remaining) ? [...remaining] : null;
  const getStatus = vi.fn(async () =>
    quotaStatus(remainingQueue ? (remainingQueue.shift() ?? 0) : (remaining as number)),
  );
  const quota = { getStatus } as unknown as YoutubeQuotaService;

  const maintenanceRun = vi.fn(async () => ({
    staleReservations: 0,
    expiredAttempts: 0,
    deletedCandidates: 0,
  }));
  const maintenance = { run: maintenanceRun } as unknown as YoutubeMaintenanceService;

  const search = vi.fn(options.search ?? (async () => [item()]));
  const client: YoutubeSearchClient = { search };

  const mutex = new ProcessMutex();
  const service = new YoutubeBatchService(prisma, client, quota, maintenance, mutex);

  return {
    service,
    mutex,
    search,
    attemptCreate,
    attemptUpdate,
    recommendationCreateMany,
    maintenanceRun,
    $queryRaw,
    prisma,
  };
}

describe('buildSearchQuery', () => {
  it('프론트 폴백과 같은 모양으로 만든다', () => {
    expect(buildSearchQuery('사랑의 미학', '리도어 (Redoor)')).toBe('사랑의 미학 리도어 (Redoor)');
  });

  it('괄호·feat.를 제거하지 않는다 (근거 없는 가공을 하지 않는다)', () => {
    expect(buildSearchQuery('Vancouver2 (BAND Ver.)', 'BIG Naughty (서동현)')).toBe(
      'Vancouver2 (BAND Ver.) BIG Naughty (서동현)',
    );
  });

  it('가수가 없으면 제목만 쓴다', () => {
    expect(buildSearchQuery('멋진헛간', null)).toBe('멋진헛간');
  });

  it('자모가 분리된 한글을 NFC로 모은다', () => {
    const nfd = '사랑의 미학'.normalize('NFD');
    expect(buildSearchQuery(nfd, null)).toBe('사랑의 미학');
  });
});

describe('YoutubeBatchService — 예약 기록', () => {
  it('외부 호출 전에 시도 행을 먼저 만든다', async () => {
    // 호출 도중 프로세스가 죽어도 행이 남아 쿼터 집계에 포함돼야 한다.
    const { service, attemptCreate, search } = createHarness();

    await service.runBatch(1);

    expect(attemptCreate.mock.invocationCallOrder[0]).toBeLessThan(
      search.mock.invocationCallOrder[0],
    );
    expect(attemptCreate).toHaveBeenCalledWith({
      data: { songId: SONG.id, query: '사랑의 미학 리도어 (Redoor)' },
      select: { id: true },
    });
  });

  it('외부 호출 중에는 트랜잭션을 열지 않는다', async () => {
    const { service, prisma, search } = createHarness();
    const transaction = prisma.$transaction as unknown as ReturnType<typeof vi.fn>;

    await service.runBatch(1);

    // 트랜잭션은 후보 저장(③)에서만 열린다 — 호출보다 뒤다.
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(search.mock.invocationCallOrder[0]).toBeLessThan(
      transaction.mock.invocationCallOrder[0],
    );
  });

  it('배치 시작 시 정리 작업이 먼저 돈다', async () => {
    const { service, maintenanceRun, attemptCreate } = createHarness();

    await service.runBatch(1);

    expect(maintenanceRun.mock.invocationCallOrder[0]).toBeLessThan(
      attemptCreate.mock.invocationCallOrder[0],
    );
  });
});

describe('YoutubeBatchService — 결과 기록', () => {
  it('후보가 있으면 searched/open으로 닫고 후보를 저장한다', async () => {
    const { service, attemptUpdate, recommendationCreateMany } = createHarness();

    const summary = await service.runBatch(1);

    expect(summary.searched).toBe(1);
    expect(recommendationCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ attemptId: 100n, rank: 1, videoId: 'BTo-I-gCAxk' }),
      ],
    });
    expect(attemptUpdate).toHaveBeenCalledWith({
      where: { id: 100n },
      data: expect.objectContaining({
        outcome: 'searched',
        reviewState: 'open',
        candidateCount: 1,
        completedAt: expect.any(Date),
      }),
    });
  });

  it('결과가 0건이면 오류가 아니라 no_results다', async () => {
    const { service, attemptUpdate, recommendationCreateMany } = createHarness({
      search: async () => [],
    });

    const summary = await service.runBatch(1);

    expect(summary.noResults).toBe(1);
    expect(summary.failed).toBe(0);
    expect(recommendationCreateMany).not.toHaveBeenCalled();
    expect(attemptUpdate).toHaveBeenCalledWith({
      where: { id: 100n },
      data: { outcome: 'no_results', completedAt: expect.any(Date) },
    });
  });

  it('상위 3개만 저장하고 rank는 1부터 연속이다', async () => {
    const { service, recommendationCreateMany } = createHarness({
      search: async () =>
        Array.from({ length: 10 }, (_, index) =>
          item({ videoId: `vid${String(index).padStart(8, '0')}` }),
        ),
    });

    await service.runBatch(1);

    const [{ data }] = recommendationCreateMany.mock.calls[0];
    expect(data).toHaveLength(3);
    expect(data.map((row) => row.rank)).toEqual([1, 2, 3]);
  });

  it('후보는 점수가 아니라 YouTube 원본 순서 상위 3개로 저장한다 (점수는 참고값)', async () => {
    // 게이트 2 캘리브레이션: 점수 정렬이 원본 순서보다 나빴다. 4번째가 점수 1위여도 밀려나야 한다.
    const { service, recommendationCreateMany } = createHarness({
      search: async () => [
        item({ videoId: 'first000000', title: '무관한 영상' }),
        item({ videoId: 'second00000', title: '무관한 영상 (live)' }),
        item({ videoId: 'third000000', title: '무관한 영상' }),
        item({ videoId: 'official000', title: '사랑의 미학 Official MV', description: 'official mv' }),
      ],
    });

    await service.searchForSong(SONG.id);

    const [{ data }] = recommendationCreateMany.mock.calls[0];
    expect(data.map((row) => row.videoId)).toEqual(['first000000', 'second00000', 'third000000']);
    expect(data.map((row) => row.rank)).toEqual([1, 2, 3]);
    // 점수는 저장되지만 정렬 근거가 아니다: 2번째(감점)가 1번째보다 낮아도 순서는 그대로다.
    expect(data.every((row) => typeof (row as { score?: unknown }).score === 'number')).toBe(true);
  });
});

describe('YoutubeBatchService — 저장 가능한 후보만 남긴다', () => {
  it.each([
    ['예약어 videoId', item({ videoId: 'videoseries' })],
    ['형식이 틀린 videoId', item({ videoId: 'short' })],
    ['http 썸네일', item({ thumbnailUrl: 'http://i.ytimg.com/x.jpg' })],
    ['허용되지 않은 썸네일 호스트', item({ thumbnailUrl: 'https://evil.example/x.jpg' })],
    ['썸네일이 URL이 아님', item({ thumbnailUrl: 'not-a-url' })],
    ['제목이 상한 초과', item({ title: 'x'.repeat(301) })],
    ['채널명이 상한 초과', item({ channelTitle: 'x'.repeat(201) })],
  ])('%s는 후보에서 빠진다', async (_label, bad) => {
    const { service, attemptUpdate } = createHarness({ search: async () => [bad] });

    const summary = await service.runBatch(1);

    // 전부 걸러지면 "검색은 됐지만 쓸 후보가 없음" → no_results
    expect(summary.noResults).toBe(1);
    expect(attemptUpdate).toHaveBeenCalledWith({
      where: { id: 100n },
      data: { outcome: 'no_results', completedAt: expect.any(Date) },
    });
  });

  it('상한을 넘는 제목은 자르지 않고 버린다', async () => {
    // 잘린 제목은 관리자가 잘못 판단할 근거가 된다.
    const { service, recommendationCreateMany } = createHarness({
      search: async () => [item({ title: 'x'.repeat(301) }), item({ videoId: 'uC56MsZ8J8M' })],
    });

    await service.runBatch(1);

    const [{ data }] = recommendationCreateMany.mock.calls[0];
    expect(data).toHaveLength(1);
    expect(data[0].videoId).toBe('uC56MsZ8J8M');
  });
});

describe('YoutubeBatchService — 실패 분류 (completedAt이 기준)', () => {
  it.each([
    ['타임아웃', new YoutubeTimeoutError('timeout')],
    ['업스트림 5xx', new YoutubeUpstreamError('upstream', 503)],
  ])('%s은 곡 탓인 실패라 completedAt을 채운다', async (_label, error) => {
    const { service, attemptUpdate } = createHarness({
      search: async () => {
        throw error;
      },
    });

    const summary = await service.runBatch(1);

    expect(summary.failed).toBe(1);
    expect(attemptUpdate).toHaveBeenCalledWith({
      where: { id: 100n },
      data: { outcome: 'failed', completedAt: expect.any(Date) },
    });
  });

  it.each([
    ['쿼터 초과', new YoutubeQuotaExceededError('quota')],
    ['키 오류', new YoutubeApiKeyError('key')],
  ])('%s는 곡을 평가조차 못 한 것이라 completedAt이 NULL이다', async (_label, error) => {
    // 이 값이 NULL이라야 곡별 연속 실패수에서 빠진다.
    // 안 그러면 쿼터가 떨어진 날 세 곡이 영구히 배치에서 제외된다.
    const { service, attemptUpdate } = createHarness({
      search: async () => {
        throw error;
      },
    });

    // 기록 내용을 보는 테스트라 응답 매핑(429/500)이 없는 searchForSong으로 실행한다.
    await service.searchForSong(SONG.id);

    expect(attemptUpdate).toHaveBeenCalledWith({
      where: { id: 100n },
      data: { outcome: 'failed', completedAt: null },
    });
  });

  it('실패해도 시도 행은 남는다 (쿼터 집계 보존)', async () => {
    const { service, attemptCreate, attemptUpdate } = createHarness({
      search: async () => {
        throw new YoutubeQuotaExceededError('quota');
      },
    });

    await service.searchForSong(SONG.id);

    expect(attemptCreate).toHaveBeenCalledTimes(1);
    expect(attemptUpdate).toHaveBeenCalledTimes(1);
  });
});

describe('YoutubeBatchService — 중단 조건', () => {
  const threeSongs: SongTarget[] = [
    { id: 1n, title: 'a', singer: 'a' },
    { id: 2n, title: 'b', singer: 'b' },
    { id: 3n, title: 'c', singer: 'c' },
  ];

  it('쿼터가 0이면 시작조차 하지 않는다', async () => {
    const { service, attemptCreate, search } = createHarness({ remainingQuota: 0 });

    // 아무것도 처리하지 못한 쿼터 소진은 429다 (혼합안)
    await expect(service.runBatch(5)).rejects.toBeInstanceOf(YoutubeQuotaExhaustedException);
    expect(attemptCreate).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });

  it('쿼터 초과 응답이 오면 즉시 멈추고 다음 곡을 건드리지 않는다', async () => {
    const { service, search } = createHarness({
      targets: threeSongs,
      search: async () => {
        throw new YoutubeQuotaExceededError('quota');
      },
    });

    // 첫 호출이 쿼터 초과 → 결과가 하나도 없으므로 429
    await expect(service.runBatch(3)).rejects.toBeInstanceOf(YoutubeQuotaExhaustedException);
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('키 오류도 즉시 멈춘다', async () => {
    const { service, search } = createHarness({
      targets: threeSongs,
      search: async () => {
        throw new YoutubeApiKeyError('key');
      },
    });

    // 키 오류는 서버 설정 문제라 500이다 (혼합안)
    await expect(service.runBatch(3)).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('연속 3회 실패하면 남은 곡의 쿼터를 지키려고 멈춘다', async () => {
    const four: SongTarget[] = [...threeSongs, { id: 4n, title: 'd', singer: 'd' }];
    const { service, search } = createHarness({
      targets: four,
      search: async () => {
        throw new YoutubeTimeoutError('timeout');
      },
    });

    const summary = await service.runBatch(4);

    expect(summary.abortedBy).toBe('consecutive_errors');
    expect(summary.failed).toBe(3);
    expect(search).toHaveBeenCalledTimes(3);
  });

  it('중간에 성공하면 연속 실패 카운터가 초기화된다', async () => {
    const four: SongTarget[] = [...threeSongs, { id: 4n, title: 'd', singer: 'd' }];
    let call = 0;
    const { service, search } = createHarness({
      targets: four,
      search: async () => {
        call += 1;
        if (call === 3) return [item()];
        throw new YoutubeTimeoutError('timeout');
      },
    });

    const summary = await service.runBatch(4);

    expect(summary.abortedBy).toBeNull();
    expect(search).toHaveBeenCalledTimes(4);
  });

  it('처리 도중 쿼터가 바닥나면 그 지점에서 멈춘다', async () => {
    const { service, search } = createHarness({
      targets: threeSongs,
      remainingQuota: [2, 1, 0],
    });

    const summary = await service.runBatch(3);

    expect(search).toHaveBeenCalledTimes(2);
    expect(summary.abortedBy).toBe('quota');
  });

  it('부분 성공은 유지된다 (앞서 저장한 결과를 되돌리지 않는다)', async () => {
    let call = 0;
    const { service, recommendationCreateMany } = createHarness({
      targets: threeSongs,
      search: async () => {
        call += 1;
        if (call === 1) return [item()];
        throw new YoutubeQuotaExceededError('quota');
      },
    });

    const summary = await service.runBatch(3);

    expect(summary.searched).toBe(1);
    expect(recommendationCreateMany).toHaveBeenCalledTimes(1);
  });
});

describe('YoutubeBatchService — 중복 실행', () => {
  it('이미 실행 중이면 409다 (기다리지 않는다)', async () => {
    const { service, mutex } = createHarness();

    const outer = mutex.tryRun(
      () => new Promise<void>((resolve) => setTimeout(resolve, 20)),
    );
    await expect(service.runBatch(1)).rejects.toBeInstanceOf(ConflictException);
    await outer;
  });

  it('끝난 뒤에는 다시 실행할 수 있다', async () => {
    const { service } = createHarness();

    await service.runBatch(1);
    await expect(service.runBatch(1)).resolves.toBeDefined();
  });
});

describe('YoutubeBatchService.searchForSong — 검증용 단일 곡 경로', () => {
  it('대상 자동 선정을 거치지 않는다', async () => {
    // 프로덕션 검증에서 실제 59곡을 건드리지 않기 위한 진입점이다.
    const { service, $queryRaw, attemptCreate } = createHarness();

    await service.searchForSong(SONG.id);

    // countTargets(요약용)만 불리고 selectTargets는 불리지 않는다.
    const texts = $queryRaw.mock.calls.map(([statement]) =>
      String((statement as { text?: string })?.text ?? ''),
    );
    expect(texts.some(isSelectTargets)).toBe(false);
    expect(texts.length).toBeGreaterThan(0);
    expect(attemptCreate).toHaveBeenCalledWith({
      data: { songId: SONG.id, query: '사랑의 미학 리도어 (Redoor)' },
      select: { id: true },
    });
  });

  it('없는 곡이면 404이고 아무것도 쓰지 않는다', async () => {
    const { service, attemptCreate } = createHarness();

    await expect(service.searchForSong(999n)).rejects.toBeInstanceOf(NotFoundException);
    expect(attemptCreate).not.toHaveBeenCalled();
  });
});

describe('YoutubeBatchService.previewSearch — 캘리브레이션 (DB 쓰기 없음)', () => {
  it('시도 행을 만들지 않는다', async () => {
    const { service, attemptCreate, attemptUpdate } = createHarness();

    const ranked = await service.previewSearch(SONG.title, SONG.singer);

    expect(ranked).toHaveLength(1);
    expect(ranked[0].rank).toBe(1);
    expect(attemptCreate).not.toHaveBeenCalled();
    expect(attemptUpdate).not.toHaveBeenCalled();
  });

  it('저장 불가능한 후보는 제외한 결과를 보여 준다', async () => {
    const { service } = createHarness({
      search: async () => [item({ videoId: 'videoseries' }), item({ videoId: 'uC56MsZ8J8M' })],
    });

    const ranked = await service.previewSearch(SONG.title, SONG.singer);

    expect(ranked.map((candidate) => candidate.videoId)).toEqual(['uC56MsZ8J8M']);
  });
});

/**
 * 중단 응답 — 혼합안 (work02-6b 결정).
 *
 * | 상황 | 응답 |
 * | --- | --- |
 * | 쿼터 초과 + 결과 0건(searched·noResults 모두 0) | 429 + Retry-After |
 * | 키 오류 | 500 (키·헤더가 응답·로그에 없다) |
 * | 부분 성공 / 연속 실패 중단 | 200 + abortedBy |
 */
describe('YoutubeBatchService.runBatch — 중단 응답 (혼합안)', () => {
  const songs: SongTarget[] = [
    { id: 1n, title: 'a', singer: 'a' },
    { id: 2n, title: 'b', singer: 'b' },
    { id: 3n, title: 'c', singer: 'c' },
  ];
  const FAKE_KEY = 'AIzaSyFAKEKEYFAKEKEYFAKEKEYFAKEKEY123';

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('쿼터 소진 429는 메시지와 Retry-After(초)를 담는다', async () => {
    // 리셋(07:00Z)까지 정확히 1시간 남은 시각으로 고정한다.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-21T06:00:00.000Z'));
    const { service } = createHarness({ remainingQuota: 0 });

    const error = await service.runBatch(5).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(YoutubeQuotaExhaustedException);
    expect((error as YoutubeQuotaExhaustedException).retryAfterSeconds).toBe(3600);
    expect((error as YoutubeQuotaExhaustedException).getStatus()).toBe(429);
    expect((error as YoutubeQuotaExhaustedException).getResponse()).toMatchObject({
      message: YOUTUBE_QUOTA_EXHAUSTED_MESSAGE,
    });
  });

  it('Retry-After는 최소 1초다 (리셋 시각이 이미 지났어도 즉시 재시도를 권하지 않는다)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-21T09:00:00.000Z')); // resetsAt(07:00Z)보다 뒤
    const { service } = createHarness({ remainingQuota: 0 });

    const error = await service.runBatch(5).catch((caught: unknown) => caught);

    expect((error as YoutubeQuotaExhaustedException).retryAfterSeconds).toBe(1);
  });

  it('결과를 낸 뒤 쿼터가 바닥나면 200 + abortedBy다 (부분 성공은 429가 아니다)', async () => {
    const { service } = createHarness({ targets: songs, remainingQuota: [3, 2, 0] });

    const summary = await service.runBatch(3);

    expect(summary).toMatchObject({ searched: 2, abortedBy: 'quota' });
  });

  it('결과 0건만 낸 뒤 쿼터가 바닥나도 200이다 (처리한 결과가 있다)', async () => {
    const { service } = createHarness({
      targets: songs,
      remainingQuota: [2, 1, 0],
      search: async () => [],
    });

    const summary = await service.runBatch(3);

    expect(summary).toMatchObject({ noResults: 2, searched: 0, abortedBy: 'quota' });
  });

  it('곡 탓 실패만 있던 뒤 쿼터 초과를 만나면 결과가 없으므로 429다', async () => {
    let call = 0;
    const { service } = createHarness({
      targets: songs,
      search: async () => {
        call += 1;
        if (call === 1) throw new YoutubeTimeoutError('timeout');
        throw new YoutubeQuotaExceededError('quota');
      },
    });

    await expect(service.runBatch(3)).rejects.toBeInstanceOf(YoutubeQuotaExhaustedException);
  });

  it('연속 실패 중단은 429·500이 아니라 200 + abortedBy다', async () => {
    const { service } = createHarness({
      targets: songs,
      search: async () => {
        throw new YoutubeTimeoutError('timeout');
      },
    });

    await expect(service.runBatch(3)).resolves.toMatchObject({
      abortedBy: 'consecutive_errors',
      failed: 3,
    });
  });

  it('키 오류는 500이고 고정 문구만 내보낸다', async () => {
    const { service } = createHarness({
      search: async () => {
        throw new YoutubeApiKeyError('rejected');
      },
    });

    const error = await service.runBatch(1).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(InternalServerErrorException);
    expect((error as InternalServerErrorException).getStatus()).toBe(500);
    expect((error as InternalServerErrorException).getResponse()).toMatchObject({
      message: YOUTUBE_API_KEY_MESSAGE,
    });
  });

  it('키 오류는 부분 성공이 있어도 500이다 (저장한 결과는 DB에 남는다)', async () => {
    let call = 0;
    const { service, recommendationCreateMany } = createHarness({
      targets: songs,
      search: async () => {
        call += 1;
        if (call === 1) return [item()];
        throw new YoutubeApiKeyError('rejected');
      },
    });

    await expect(service.runBatch(3)).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(recommendationCreateMany).toHaveBeenCalledTimes(1);
  });

  it('원본 오류 메시지에 키가 들어 있어도 응답·로그 어디에도 나가지 않는다', async () => {
    // 최악의 경우를 가정한다: 업스트림 오류 객체의 메시지에 키가 섞여 있다.
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service } = createHarness({
      search: async () => {
        throw new YoutubeApiKeyError(`key=${FAKE_KEY} X-goog-api-key: ${FAKE_KEY}`);
      },
    });

    const error = (await service
      .runBatch(1)
      .catch((caught: unknown) => caught)) as InternalServerErrorException;

    const surfaces = [
      JSON.stringify(error.getResponse()),
      error.message,
      error.stack ?? '',
      JSON.stringify(warn.mock.calls),
    ].join('\n');
    expect(surfaces).not.toContain(FAKE_KEY);
    expect(surfaces).not.toContain('AIza');
    expect(surfaces).not.toContain('X-goog-api-key');
  });

  it('검증용 searchForSong에는 매핑을 적용하지 않는다 (요약을 그대로 받는다)', async () => {
    // 임시 곡 검증이 429/500 예외 없이 결과를 관찰할 수 있어야 한다.
    const { service } = createHarness({
      search: async () => {
        throw new YoutubeQuotaExceededError('quota');
      },
    });

    await expect(service.searchForSong(SONG.id)).resolves.toMatchObject({ abortedBy: 'quota' });
  });
});
