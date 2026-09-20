import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AppThrottlerGuard } from '../throttling/app-throttler.guard.js';

/**
 * 앱 전체에 걸리는 **유일한** 전역 Guard. 요청 제한 → 인증 순서를 **코드로** 고정한다.
 *
 * ## 왜 하나로 묶었나
 * 전역 Guard를 `APP_GUARD`로 따로 등록하면 실행 순서가 모듈이 스캔된 순서에서 나온다. 이 순서는 문서화된
 * 보장이 아니고, 다른 모듈이 `AuthModule`을 먼저 import하는 리팩터링만으로도 뒤집힌다. 뒤집히면 토큰 없는
 * 401 요청이 요청 제한에 세어지지 않는다(로그인은 `@Public()`이라 티가 나지 않는다).
 * 여기서는 두 Guard를 주입받아 **직접 순서대로 호출**하므로 Nest의 등록 순서와 무관하다.
 *
 * ## 순서의 의미
 * 1. `AppThrottlerGuard` — 인증 여부와 상관없이 세어야 토큰 없는 요청 폭주도 막는다. 한도 초과는 예외(429)로 끝난다
 * 2. `JwtAuthGuard` — 통과한 요청에만 인증을 검사한다(`@Public()`이면 통과)
 *
 * 새 전역 Guard를 추가해야 하면 다른 곳에 `APP_GUARD`를 또 등록하지 말고 여기에 순서를 정해서 넣는다.
 * `global.guard.spec.ts`가 `APP_GUARD`가 이것 하나뿐임을 검사한다.
 */
@Injectable()
export class GlobalGuard implements CanActivate {
  constructor(
    private readonly throttler: AppThrottlerGuard,
    private readonly auth: JwtAuthGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!(await this.throttler.canActivate(context))) {
      return false;
    }

    return this.auth.canActivate(context);
  }
}
