import { HttpException, HttpStatus, Injectable, type ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerModuleOptions } from '@nestjs/throttler';
import { LOGIN_THROTTLE_KEY } from './login-throttle.decorator.js';
import {
  DEFAULT_THROTTLE,
  LOGIN_THROTTLE,
  LOGIN_THROTTLER_NAME,
  THROTTLED_MESSAGE,
} from './throttling.constants.js';

/** 핸들러에 `@LoginThrottle()`이 붙어 있는지. 컨트롤러 전체가 아니라 핸들러 단위로만 본다. */
export function isLoginHandler(context: ExecutionContext): boolean {
  return Reflect.getMetadata(LOGIN_THROTTLE_KEY, context.getHandler()) === true;
}

export interface ThrottleOverrides {
  default?: { limit: number; ttlMs: number };
  login?: { limit: number; ttlMs: number; blockMs: number };
}

/**
 * throttler 설정을 만든다. 운영은 인자 없이 호출하고, 테스트만 창을 줄여서 호출한다.
 *
 * - `default`: 로그인이 아닌 모든 핸들러. `X-RateLimit-*`/`Retry-After` 헤더를 낸다.
 * - `login`: `@LoginThrottle()` 핸들러만. 남은 횟수를 알려 주지 않도록 라이브러리 헤더를 끄고,
 *   `Retry-After`는 가드에서 직접 낸다(라이브러리는 `setHeaders:false`면 `Retry-After`도 끈다).
 */
export function createThrottlerOptions(overrides: ThrottleOverrides = {}): ThrottlerModuleOptions {
  const base = overrides.default ?? DEFAULT_THROTTLE;
  const login = overrides.login ?? LOGIN_THROTTLE;

  return {
    throttlers: [
      {
        name: 'default',
        limit: base.limit,
        ttl: base.ttlMs,
        skipIf: isLoginHandler,
      },
      {
        name: LOGIN_THROTTLER_NAME,
        limit: login.limit,
        ttl: login.ttlMs,
        blockDuration: login.blockMs,
        setHeaders: false,
        skipIf: (context) => !isLoginHandler(context),
      },
    ],
  };
}

/**
 * 인바운드 요청 제한 Guard.
 *
 * 429 응답을 우리 계약(`{message, error, statusCode}` + 한국어 메시지 + `Retry-After`)으로 고정한다.
 * 카운트 키에 클래스·핸들러 이름이 들어가므로 한도는 **라우트별**로 센다 — 로그인이 막혀도
 * 다른 라우트는 영향받지 않는다.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(
    context: ExecutionContext,
    detail: { timeToBlockExpire: number },
  ): Promise<void> {
    const { res } = this.getRequestResponse(context);
    // 0초로 나가면 클라이언트가 즉시 재시도하므로 최소 1초
    res.header('Retry-After', String(Math.max(1, detail.timeToBlockExpire)));

    throw new HttpException(
      {
        message: THROTTLED_MESSAGE,
        error: 'Too Many Requests',
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
