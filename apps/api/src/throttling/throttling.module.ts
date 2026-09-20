import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard, createThrottlerOptions } from './app-throttler.guard.js';

/**
 * 전역 요청 제한. **`AuthModule`보다 먼저 import해야 한다** — 전역 Guard는 등록 순서대로
 * 실행되므로, 인증 실패(401) 요청도 카운트해야 토큰 없는 요청 폭주를 막을 수 있다.
 * 실제 순서는 런타임에서 확인한다(문서화된 보장이 아니라 관측).
 */
@Module({
  imports: [ThrottlerModule.forRoot(createThrottlerOptions())],
  providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class ThrottlingModule {}
