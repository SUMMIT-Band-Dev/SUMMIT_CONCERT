import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { YoutubeReviewService } from './youtube-review.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { ListRecommendationsQuery } from './dto/review-recommendation.dto.js';

const ATTEMPT_ID = 100n;
const SONG_ID = 27n;
const VIDEO_ID = 'BTo-I-gCAxk';

interface HarnessOptions {
  attempt?: { id: bigint; songId: bigint } | null;
  song?: { youtube_url: string | null; youtube_review_status: string } | null;
  lockedState?: string | null;
  candidate?: { rank: number; videoId: string } | null;
  noResultsCount?: number;
  openAttemptIds?: bigint[];
}

function createHarness(options: HarnessOptions = {}) {
  const {
    attempt = { id: ATTEMPT_ID, songId: SONG_ID },
    song = { youtube_url: null, youtube_review_status: 'pending' },
    lockedState = 'open',
    candidate = { rank: 1, videoId: VIDEO_ID },
    noResultsCount = 0,
    openAttemptIds = [],
  } = options;

  const setlistUpdate = vi.fn(async ({ where, data }: { where: { id: bigint }; data: Record<string, unknown> }) => ({
    id: where.id,
    teamId: 7n,
    title: '사랑의 미학',
    singer: '리도어 (Redoor)',
    albumCoverUrl: null,
    youtubeUrl: null,
    youtubeReviewStatus: 'pending',
    ...data,
  }));

  // lockSong / lockOpenAttempt 둘 다 태그드 템플릿이라 (strings, ...values)로 들어온다.
  const $queryRaw = vi.fn(async (strings: TemplateStringsArray) => {
    const text = strings.join('');
    if (text.includes('"Setlist"')) {
      return song === null ? [] : [{ id: SONG_ID, ...song }];
    }
    return lockedState === null ? [] : [{ reviewState: lockedState }];
  });

  // 인자 타입을 명시하지 않으면 mock.calls가 `[]` 튜플로 추론돼 호출 인자를 꺼낼 수 없다.
  const attemptUpdate = vi.fn(
    async (_args: { where: unknown; data: Record<string, unknown> }) => ({}),
  );
  const attemptUpdateMany = vi.fn(async () => ({ count: 0 }));
  const attemptFindMany = vi.fn(async () => openAttemptIds.map((id) => ({ id })));
  const attemptCount = vi.fn(async () => noResultsCount);
  const recommendationFindFirst = vi.fn(async () => candidate);
  const recommendationDeleteMany = vi.fn(async () => ({ count: 0 }));

  const tx = {
    setlist: { update: setlistUpdate },
    youtubeSearchAttempt: {
      update: attemptUpdate,
      updateMany: attemptUpdateMany,
      findMany: attemptFindMany,
      count: attemptCount,
    },
    youtubeRecommendation: {
      findFirst: recommendationFindFirst,
      deleteMany: recommendationDeleteMany,
    },
    $queryRaw,
  };

  const prisma = {
    ...tx,
    youtubeSearchAttempt: {
      ...tx.youtubeSearchAttempt,
      findUnique: vi.fn(async () => attempt),
      findMany: attemptFindMany,
    },
    $transaction: vi.fn(async (run: (client: typeof tx) => unknown) => run(tx)),
  } as unknown as PrismaService;

  return {
    service: new YoutubeReviewService(prisma),
    setlistUpdate,
    attemptUpdate,
    attemptUpdateMany,
    recommendationFindFirst,
    recommendationDeleteMany,
    $queryRaw,
    prisma,
  };
}

describe('YoutubeReviewService.approve', () => {
  it('곡에 정규화된 URL을 넣고 approved로 바꾼다', async () => {
    const { service, setlistUpdate } = createHarness();

    const result = await service.approve(ATTEMPT_ID, VIDEO_ID);

    expect(setlistUpdate).toHaveBeenCalledWith({
      where: { id: SONG_ID },
      data: {
        youtubeUrl: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
        youtubeReviewStatus: 'approved',
      },
    });
    expect(result.youtubeUrl).toBe(`https://www.youtube.com/watch?v=${VIDEO_ID}`);
  });

  it('videoId가 아니라 등수만 기록한다 (30일 보관 제한 대응)', async () => {
    const { service, attemptUpdate } = createHarness({ candidate: { rank: 2, videoId: VIDEO_ID } });

    await service.approve(ATTEMPT_ID, VIDEO_ID);

    const [args] = attemptUpdate.mock.calls[0];
    expect(args.data).toMatchObject({ reviewState: 'approved', approvedRank: 2 });
    expect(JSON.stringify(args.data)).not.toContain(VIDEO_ID);
  });

  it('후보 행을 전부 지운다', async () => {
    const { service, recommendationDeleteMany } = createHarness();

    await service.approve(ATTEMPT_ID, VIDEO_ID);

    expect(recommendationDeleteMany).toHaveBeenCalledWith({ where: { attemptId: ATTEMPT_ID } });
  });

  it('잠금 순서가 Setlist → Attempt다', async () => {
    const { service, $queryRaw } = createHarness();

    await service.approve(ATTEMPT_ID, VIDEO_ID);

    const texts = $queryRaw.mock.calls.map(([strings]) => (strings as TemplateStringsArray).join(''));
    expect(texts[0]).toContain('"Setlist"');
    expect(texts[0]).toContain('FOR UPDATE');
    expect(texts[1]).toContain('"YoutubeSearchAttempt"');
    expect(texts[1]).toContain('FOR UPDATE');
  });

  it('없는 시도면 404이고 트랜잭션을 열지 않는다', async () => {
    const { service, prisma } = createHarness({ attempt: null });

    await expect(service.approve(ATTEMPT_ID, VIDEO_ID)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('그 사이 F013 수동 입력이 끼어들면 409다', async () => {
    const { service, setlistUpdate } = createHarness({
      song: { youtube_url: 'https://www.youtube.com/watch?v=uC56MsZ8J8M', youtube_review_status: 'approved' },
    });

    await expect(service.approve(ATTEMPT_ID, VIDEO_ID)).rejects.toBeInstanceOf(ConflictException);
    expect(setlistUpdate).not.toHaveBeenCalled();
  });

  it('이미 처리된 추천을 다시 승인하면 409다 (멱등 200이 아니다)', async () => {
    const { service, setlistUpdate } = createHarness({ lockedState: 'approved' });

    await expect(service.approve(ATTEMPT_ID, VIDEO_ID)).rejects.toBeInstanceOf(ConflictException);
    expect(setlistUpdate).not.toHaveBeenCalled();
  });

  it('후보 목록에 없는 영상은 400이다', async () => {
    const { service, setlistUpdate } = createHarness({ candidate: null });

    await expect(service.approve(ATTEMPT_ID, 'uC56MsZ8J8M')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(setlistUpdate).not.toHaveBeenCalled();
  });

  it('DB에 예약어가 들어 있어도 저장 직전에 막는다', async () => {
    // §14의 예약어 결함이 "형식이 맞으면 영상이 존재한다"는 가정에서 나왔다.
    const { service, setlistUpdate } = createHarness({
      candidate: { rank: 1, videoId: 'videoseries' },
    });

    await expect(service.approve(ATTEMPT_ID, 'videoseries')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(setlistUpdate).not.toHaveBeenCalled();
  });

  it('곡이 사라졌으면 404다', async () => {
    const { service } = createHarness({ song: null });

    await expect(service.approve(ATTEMPT_ID, VIDEO_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('YoutubeReviewService.reject', () => {
  it('곡 상태를 rejected로 바꾸고 URL은 건드리지 않는다', async () => {
    const { service, setlistUpdate } = createHarness();

    await service.reject(ATTEMPT_ID, '다른 밴드 영상');

    expect(setlistUpdate).toHaveBeenCalledWith({
      where: { id: SONG_ID },
      data: { youtubeReviewStatus: 'rejected' },
    });
  });

  it('사유를 저장한다', async () => {
    const { service, attemptUpdate } = createHarness();

    await service.reject(ATTEMPT_ID, '다른 밴드 영상');

    expect(attemptUpdate).toHaveBeenCalledWith({
      where: { id: ATTEMPT_ID },
      data: expect.objectContaining({ reviewState: 'rejected', rejectedReason: '다른 밴드 영상' }),
    });
  });

  it('사유가 없으면 null로 저장한다 (CHECK를 위반하지 않는다)', async () => {
    const { service, attemptUpdate } = createHarness();

    await service.reject(ATTEMPT_ID, undefined);

    expect(attemptUpdate).toHaveBeenCalledWith({
      where: { id: ATTEMPT_ID },
      data: expect.objectContaining({ rejectedReason: null }),
    });
  });

  it('후보 행을 지운다', async () => {
    const { service, recommendationDeleteMany } = createHarness();

    await service.reject(ATTEMPT_ID, undefined);

    expect(recommendationDeleteMany).toHaveBeenCalledWith({ where: { attemptId: ATTEMPT_ID } });
  });

  it('이미 처리된 추천이면 409다', async () => {
    const { service, setlistUpdate } = createHarness({ lockedState: 'rejected' });

    await expect(service.reject(ATTEMPT_ID, undefined)).rejects.toBeInstanceOf(ConflictException);
    expect(setlistUpdate).not.toHaveBeenCalled();
  });
});

describe('YoutubeReviewService.requeue', () => {
  it('반려된 곡을 pending으로 되돌린다', async () => {
    const { service, setlistUpdate } = createHarness({
      song: { youtube_url: null, youtube_review_status: 'rejected' },
    });

    await service.requeue(SONG_ID);

    expect(setlistUpdate).toHaveBeenCalledWith({
      where: { id: SONG_ID },
      data: { youtubeReviewStatus: 'pending' },
    });
  });

  it('결과 0건이었던 곡도 받는다', async () => {
    const { service, setlistUpdate } = createHarness({
      song: { youtube_url: null, youtube_review_status: 'pending' },
      noResultsCount: 1,
    });

    await service.requeue(SONG_ID);

    expect(setlistUpdate).toHaveBeenCalled();
  });

  it('이력 전체에 invalidatedAt을 찍어 제외 조건을 푼다', async () => {
    const { service, attemptUpdateMany } = createHarness({
      song: { youtube_url: null, youtube_review_status: 'rejected' },
    });

    await service.requeue(SONG_ID);

    expect(attemptUpdateMany).toHaveBeenCalledWith({
      where: { songId: SONG_ID, invalidatedAt: null },
      data: expect.objectContaining({ invalidatedAt: expect.any(Date) }),
    });
  });

  it('되돌릴 이유가 없는 곡은 400이다', async () => {
    const { service, setlistUpdate } = createHarness({
      song: { youtube_url: null, youtube_review_status: 'pending' },
      noResultsCount: 0,
    });

    await expect(service.requeue(SONG_ID)).rejects.toBeInstanceOf(BadRequestException);
    expect(setlistUpdate).not.toHaveBeenCalled();
  });

  it('URL이 이미 있는 곡은 400이다', async () => {
    // 되돌려도 배치 대상 조건(url IS NULL)에 걸려 아무 일도 일어나지 않는다.
    const { service } = createHarness({
      song: { youtube_url: 'https://www.youtube.com/watch?v=BTo-I-gCAxk', youtube_review_status: 'approved' },
    });

    await expect(service.requeue(SONG_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('없는 곡이면 404다', async () => {
    const { service } = createHarness({ song: null });

    await expect(service.requeue(SONG_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('YoutubeReviewService.list', () => {
  const baseQuery: ListRecommendationsQuery = {
    state: 'open',
    limit: 2,
  } as ListRecommendationsQuery;

  function createListHarness(rows: unknown[]) {
    const findMany = vi.fn(async () => rows);
    const prisma = {
      youtubeSearchAttempt: { findMany },
    } as unknown as PrismaService;

    return { service: new YoutubeReviewService(prisma), findMany };
  }

  const attemptRow = (id: bigint, searchedAt: Date) => ({
    id,
    songId: SONG_ID,
    query: '사랑의 미학 리도어 (Redoor)',
    searchedAt,
    outcome: 'searched' as const,
    reviewState: 'open' as const,
    candidateCount: 1,
    approvedRank: null,
    rejectedReason: null,
    reviewedAt: null,
    song: { title: '사랑의 미학', singer: '리도어 (Redoor)' },
    recommendations: [
      {
        rank: 1,
        score: 200,
        videoId: VIDEO_ID,
        title: '사랑의 미학 Official MV',
        channelTitle: 'Redoor',
        thumbnailUrl: 'https://i.ytimg.com/vi/x/mqdefault.jpg',
      },
    ],
  });

  it('BigInt를 문자열로 직렬화한다', async () => {
    const { service } = createListHarness([attemptRow(100n, new Date())]);

    const result = await service.list(baseQuery);

    expect(result.items[0].attemptId).toBe('100');
    expect(result.items[0].songId).toBe('27');
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('limit + 1을 읽어 다음 커서를 만든다', async () => {
    const { service, findMany } = createListHarness([
      attemptRow(100n, new Date()),
      attemptRow(99n, new Date()),
      attemptRow(98n, new Date()),
    ]);

    const result = await service.list(baseQuery);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 3 }));
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe('98');
  });

  it('더 없으면 커서가 null이다', async () => {
    const { service } = createListHarness([attemptRow(100n, new Date())]);

    await expect(service.list(baseQuery)).resolves.toMatchObject({ nextCursor: null });
  });

  it('30일이 지난 시도의 후보는 응답에서 뺀다', async () => {
    // 정리가 아직 돌지 않았어도 보관 제한이 "정리가 언제 돌았는가"에 좌우되면 안 된다.
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const { service } = createListHarness([attemptRow(100n, old)]);

    const result = await service.list(baseQuery);

    expect(result.items[0].candidates).toEqual([]);
    // 몇 개였는지는 남는다 — 우리 처리 통계이지 유튜브가 준 데이터가 아니다.
    expect(result.items[0].candidateCount).toBe(1);
  });

  it('29일 된 시도의 후보는 보여 준다', async () => {
    const recent = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
    const { service } = createListHarness([attemptRow(100n, recent)]);

    const result = await service.list(baseQuery);

    expect(result.items[0].candidates).toHaveLength(1);
  });

  it('커서 형식이 틀리면 400이다', async () => {
    const { service, findMany } = createListHarness([]);

    await expect(
      service.list({ ...baseQuery, cursor: '0' } as ListRecommendationsQuery),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(findMany).not.toHaveBeenCalled();
  });
});
