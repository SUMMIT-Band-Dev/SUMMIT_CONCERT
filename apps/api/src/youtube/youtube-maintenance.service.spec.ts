import { describe, expect, it, vi } from 'vitest';
import { YoutubeMaintenanceService } from './youtube-maintenance.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const NOW = new Date('2026-09-20T12:00:00.000Z');

function createHarness(staleOpenIds: bigint[] = []) {
  // 인자 타입을 명시하지 않으면 mock.calls가 `[]` 튜플로 추론돼 호출 인자를 꺼낼 수 없다.
  const attemptUpdateMany = vi.fn(
    async (_args: { where: unknown; data: Record<string, unknown> }) => ({ count: 2 }),
  );
  const attemptFindMany = vi.fn(async () => staleOpenIds.map((id) => ({ id })));
  const recommendationDeleteMany = vi.fn(async () => ({ count: staleOpenIds.length * 3 }));

  const tx = {
    youtubeSearchAttempt: { findMany: attemptFindMany, updateMany: attemptUpdateMany },
    youtubeRecommendation: { deleteMany: recommendationDeleteMany },
  };

  const prisma = {
    youtubeSearchAttempt: { updateMany: attemptUpdateMany, findMany: attemptFindMany },
    youtubeRecommendation: { deleteMany: recommendationDeleteMany },
    $transaction: vi.fn(async (run: (client: typeof tx) => unknown) => run(tx)),
  } as unknown as PrismaService;

  return {
    service: new YoutubeMaintenanceService(prisma),
    attemptUpdateMany,
    attemptFindMany,
    recommendationDeleteMany,
    prisma,
  };
}

describe('YoutubeMaintenanceService — 예약 정리', () => {
  it('10분 넘은 reserved를 failed로 바꾼다', async () => {
    const { service, attemptUpdateMany } = createHarness();

    await service.run(NOW);

    expect(attemptUpdateMany).toHaveBeenCalledWith({
      where: {
        outcome: 'reserved',
        searchedAt: { lt: new Date('2026-09-20T11:50:00.000Z') },
      },
      data: { outcome: 'failed' },
    });
  });

  it('completedAt을 채우지 않는다 (곡 탓이 아닌 실패)', async () => {
    // 채우면 크래시 한 번이 멀쩡한 곡을 연속 실패수로 밀어내 배치에서 영구 제외한다.
    const { service, attemptUpdateMany } = createHarness();

    await service.run(NOW);

    const [args] = attemptUpdateMany.mock.calls[0];
    expect(args.data).not.toHaveProperty('completedAt');
  });
});

describe('YoutubeMaintenanceService — 30일 경과 정리', () => {
  it('30일 지난 open 시도의 후보를 지우고 expired로 닫는다', async () => {
    const { service, attemptFindMany, recommendationDeleteMany, attemptUpdateMany } =
      createHarness([7n, 8n]);

    const result = await service.run(NOW);

    expect(attemptFindMany).toHaveBeenCalledWith({
      where: {
        reviewState: 'open',
        searchedAt: { lt: new Date('2026-08-21T12:00:00.000Z') },
      },
      select: { id: true },
    });
    expect(recommendationDeleteMany).toHaveBeenCalledWith({
      where: { attemptId: { in: [7n, 8n] } },
    });
    expect(attemptUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: [7n, 8n] } },
      data: { reviewState: 'expired', reviewedAt: NOW },
    });
    expect(result.expiredAttempts).toBe(2);
  });

  it('outcome은 searched 그대로 둔다 (CHECK 제약 때문)', async () => {
    // state_valid가 "searched가 아니면 closed"를 강제하므로 expired는 searched인 행만 가질 수 있다.
    const { service, attemptUpdateMany } = createHarness([7n]);

    await service.run(NOW);

    const expireArgs = attemptUpdateMany.mock.calls
      .map(([args]) => args)
      .find((args) => args.data.reviewState === 'expired');

    expect(expireArgs).toBeDefined();
    expect(expireArgs?.data).not.toHaveProperty('outcome');
  });

  it('대상이 없으면 아무것도 지우지 않는다', async () => {
    const { service, recommendationDeleteMany } = createHarness([]);

    const result = await service.run(NOW);

    expect(recommendationDeleteMany).not.toHaveBeenCalled();
    expect(result).toMatchObject({ expiredAttempts: 0, deletedCandidates: 0 });
  });

  it('후보 삭제와 상태 전환이 한 트랜잭션 안에서 일어난다', async () => {
    // 나누면 "후보는 지워졌는데 여전히 open"인 시도가 남아 후보 0개짜리 리뷰 화면이 뜬다.
    const { service, prisma } = createHarness([7n]);

    await service.run(NOW);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
