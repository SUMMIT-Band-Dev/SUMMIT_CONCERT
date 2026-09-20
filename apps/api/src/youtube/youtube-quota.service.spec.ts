import { describe, expect, it, vi } from 'vitest';
import { YoutubeQuotaService } from './youtube-quota.service.js';
import { YOUTUBE_DAILY_SEARCH_LIMIT } from './youtube-search.constants.js';
import type { PrismaService } from '../prisma/prisma.service.js';

function createService(row: { used: number; resets_at: Date } | undefined) {
  const $queryRaw = vi.fn(async (_strings: TemplateStringsArray, ..._values: unknown[]) =>
    row ? [row] : [],
  );
  const prisma = { $queryRaw } as unknown as PrismaService;

  return { service: new YoutubeQuotaService(prisma), $queryRaw };
}

const RESETS = new Date('2026-09-21T07:00:00.000Z');

describe('YoutubeQuotaService.getStatus — 응답 조립', () => {
  it('사용량에서 남은 횟수를 계산한다', async () => {
    const { service } = createService({ used: 30, resets_at: RESETS });

    await expect(service.getStatus()).resolves.toEqual({
      usedToday: 30,
      limit: YOUTUBE_DAILY_SEARCH_LIMIT,
      remaining: YOUTUBE_DAILY_SEARCH_LIMIT - 30,
      resetsAt: '2026-09-21T07:00:00.000Z',
      timeZone: 'America/Los_Angeles',
    });
  });

  it('상한을 넘겨도 남은 횟수는 음수가 되지 않는다', async () => {
    // 수동 재시도·검증 호출이 상한 80을 넘겨 쌓일 수 있다. 음수가 화면에 나가면 안 된다.
    const { service } = createService({ used: YOUTUBE_DAILY_SEARCH_LIMIT + 5, resets_at: RESETS });

    const status = await service.getStatus();

    expect(status.remaining).toBe(0);
    expect(status.usedToday).toBe(YOUTUBE_DAILY_SEARCH_LIMIT + 5);
  });

  it('사용량이 없으면 상한 전체가 남는다', async () => {
    const { service } = createService({ used: 0, resets_at: RESETS });

    await expect(service.getStatus()).resolves.toMatchObject({
      usedToday: 0,
      remaining: YOUTUBE_DAILY_SEARCH_LIMIT,
    });
  });

  it('결과 행이 없어도 예외 없이 0으로 돌려준다', async () => {
    const { service } = createService(undefined);

    await expect(service.getStatus()).resolves.toMatchObject({
      usedToday: 0,
      remaining: YOUTUBE_DAILY_SEARCH_LIMIT,
    });
  });
});

describe('YoutubeQuotaService.getStatus — SQL 회귀 고정', () => {
  // 이 테스트는 DB를 실행하지 못한다. 실제 결함(리셋 시각이 세션 시간대에 흔들림)이 프로덕션
  // 검증에서 잡혔으므로, 같은 실수가 조용히 돌아오지 않게 SQL 문자열만이라도 고정한다.
  // 값 검증은 실DB 고정 시각 경계 검증(REFACTOR_NOTES §15)이 맡는다.
  async function sqlOf() {
    const { service, $queryRaw } = createService({ used: 0, resets_at: RESETS });
    await service.getStatus();

    return {
      text: ($queryRaw.mock.calls[0][0] as TemplateStringsArray).join('?'),
      values: $queryRaw.mock.calls[0].slice(1),
    };
  }

  it('date + 1을 timestamp로 캐스팅한 뒤 AT TIME ZONE을 적용한다', async () => {
    const { text } = await sqlOf();

    expect(text).toContain('::date + 1)::timestamp');
  });

  it('시간대를 서버 설정이 아니라 바인딩된 상수로 준다', async () => {
    const { values } = await sqlOf();

    expect(values.filter((value) => value === 'America/Los_Angeles').length).toBeGreaterThanOrEqual(4);
  });

  it('집계가 outcome·invalidatedAt으로 걸러내지 않는다', async () => {
    // 이미 쓴 호출은 되돌릴 수 없다. 무효화된 행도, 실패한 행도, 크래시 잔재도 모두 센다.
    const { text } = await sqlOf();

    expect(text).not.toContain('"outcome"');
    expect(text).not.toContain('"invalidatedAt"');
  });
});
