import { HttpException, HttpStatus } from '@nestjs/common';
import {
  ALBUM_COVER_RATE_LIMIT_MESSAGE,
  OUTBOUND_MAX_PER_MINUTE,
  OUTBOUND_WINDOW_MS,
} from './album-cover.constants.js';

/** 상한 초과. `Retry-After`를 실어야 해서 전용 예외로 둔다. */
export class OutboundRateLimitException extends HttpException {
  constructor(readonly retryAfterSeconds: number) {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: ALBUM_COVER_RATE_LIMIT_MESSAGE,
        error: 'Too Many Requests',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export type AcquireResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * 우리가 **밖으로 내보내는** 호출의 분당 상한 (PRD F010).
 *
 * 인바운드 throttler(방문자 요청 제한, 7단계)와 목적이 다르다. 이건 "iTunes에 하루에
 * 몇 번 두드릴 것인가"의 문제라, 요청자가 누구인지와 무관하게 프로세스 전체에서 센다.
 *
 * 고정 창(fixed window)이 아니라 슬라이딩 창인 이유는, 분 경계에서 순간적으로
 * 상한의 두 배가 나가는 것을 막기 위해서다.
 *
 * `now`를 주입받는 것은 테스트 때문이다 — 실제 시간을 기다리지 않고 창 경계를 검증한다.
 */
export class OutboundRateLimiter {
  private readonly hits: number[] = [];

  constructor(
    private readonly max: number = OUTBOUND_MAX_PER_MINUTE,
    private readonly windowMs: number = OUTBOUND_WINDOW_MS,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * 슬롯을 하나 소모한다. 남아 있지 않으면 몇 초 뒤에 다시 오면 되는지 알려준다.
   *
   * 호출자는 이 함수를 **외부 호출 직전에만** 불러야 한다. 곡을 찾지 못해 404로
   * 끝나는 요청이 예산을 갉아먹으면, 잘못된 id를 몇 번 친 것만으로 정상 검색이 막힌다.
   */
  tryAcquire(): AcquireResult {
    const current = this.now();

    while (this.hits.length > 0 && current - this.hits[0] >= this.windowMs) {
      this.hits.shift();
    }

    if (this.hits.length >= this.max) {
      const waitMs = this.windowMs - (current - this.hits[0]);
      return {
        allowed: false,
        // 0초를 돌려주면 즉시 재시도해도 된다는 뜻이 되어버린다. 최소 1초.
        retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)),
      };
    }

    this.hits.push(current);
    return { allowed: true };
  }
}
