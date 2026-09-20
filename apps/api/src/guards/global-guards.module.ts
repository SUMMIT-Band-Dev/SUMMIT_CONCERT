import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module.js';
import { ThrottlingModule } from '../throttling/throttling.module.js';
import { GlobalGuard } from './global.guard.js';

/**
 * 전역 Guard의 **유일한** 등록 지점.
 *
 * 기본값이 "인증 필요"(fail-closed)인 구조는 그대로다 — 공개 라우트만 `@Public()`으로 연다.
 * `ThrottlingModule`·`AuthModule`은 각자 `APP_GUARD`를 등록하지 않고 Guard만 export한다.
 * 순서는 `GlobalGuard`가 정한다(모듈 import 순서와 무관).
 */
@Module({
  imports: [ThrottlingModule, AuthModule],
  providers: [{ provide: APP_GUARD, useClass: GlobalGuard }],
})
export class GlobalGuardsModule {}
