import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  OutboundRateLimitException,
  OutboundRateLimiter,
} from './outbound-rate-limiter.js';
import {
  OUTBOUND_MAX_PER_MINUTE,
  OUTBOUND_WINDOW_MS,
} from './album-cover.constants.js';

/** 실제 시간을 기다리지 않도록 시계를 주입한다. */
function createLimiter(max = 3, windowMs = 60_000) {
  let now = 1_000_000;
  const limiter = new OutboundRateLimiter(max, windowMs, () => now);

  return {
    limiter,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('OutboundRateLimiter', () => {
  it('상한까지는 허용한다', () => {
    const { limiter } = createLimiter(3);

    expect(limiter.tryAcquire().allowed).toBe(true);
    expect(limiter.tryAcquire().allowed).toBe(true);
    expect(limiter.tryAcquire().allowed).toBe(true);
  });

  it('상한을 넘으면 거절하고 재시도 시각을 알려준다', () => {
    const { limiter, advance } = createLimiter(2, 60_000);

    limiter.tryAcquire();
    advance(10_000);
    limiter.tryAcquire();

    const result = limiter.tryAcquire();

    expect(result.allowed).toBe(false);
    // 가장 오래된 호출이 10초 전이므로 50초 뒤에 자리가 난다
    expect(result.allowed === false && result.retryAfterSeconds).toBe(50);
  });

  it('창이 지나면 다시 허용한다', () => {
    const { limiter, advance } = createLimiter(1, 60_000);

    expect(limiter.tryAcquire().allowed).toBe(true);
    expect(limiter.tryAcquire().allowed).toBe(false);

    advance(60_000);

    expect(limiter.tryAcquire().allowed).toBe(true);
  });

  it('고정 창이 아니라 슬라이딩 창이다', () => {
    // 고정 창이었다면 분 경계에서 상한의 두 배가 한꺼번에 나갈 수 있다.
    // 두 호출의 시각을 벌려 둬야 "하나씩 만료된다"는 성질이 드러난다.
    const { limiter, advance } = createLimiter(2, 60_000);

    limiter.tryAcquire(); // t+0
    advance(30_000);
    limiter.tryAcquire(); // t+30초

    advance(29_999); // t+59.999초 — 아직 둘 다 창 안
    expect(limiter.tryAcquire().allowed).toBe(false);

    advance(1); // t+60초 — 첫 호출만 만료
    expect(limiter.tryAcquire().allowed).toBe(true);

    // 두 번째 호출(t+30초)은 아직 창 안이라 자리가 더 나지 않는다
    expect(limiter.tryAcquire().allowed).toBe(false);
  });

  it('재시도 시각은 최소 1초다', () => {
    const { limiter, advance } = createLimiter(1, 60_000);

    limiter.tryAcquire();
    advance(59_999);

    const result = limiter.tryAcquire();
    // 0초를 주면 즉시 재시도해도 된다는 뜻이 되어버린다
    expect(result.allowed === false && result.retryAfterSeconds).toBe(1);
  });

  it('거절된 호출은 예산을 소모하지 않는다', () => {
    const { limiter, advance } = createLimiter(1, 60_000);

    limiter.tryAcquire();
    limiter.tryAcquire();
    limiter.tryAcquire();
    advance(60_000);

    expect(limiter.tryAcquire().allowed).toBe(true);
  });

  it('기본값은 Apple 안내(20/분)보다 낮다', () => {
    expect(OUTBOUND_MAX_PER_MINUTE).toBeLessThan(20);
    expect(OUTBOUND_WINDOW_MS).toBe(60_000);
  });
});

describe('OutboundRateLimitException', () => {
  it('429와 재시도 초를 함께 들고 있다', () => {
    const exception = new OutboundRateLimitException(42);

    expect(exception.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(exception.retryAfterSeconds).toBe(42);
    expect(exception.getResponse()).toMatchObject({
      statusCode: 429,
      message: expect.stringContaining('요청이 너무 많습니다'),
    });
  });
});
