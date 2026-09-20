import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard, createThrottlerOptions } from './app-throttler.guard.js';

/**
 * 요청 제한 Guard와 그 저장소(인메모리). **`APP_GUARD`로 직접 등록하지 않는다** — 전역 Guard의 실행 순서를
 * 모듈 스캔 순서에 맡기지 않으려고, `GlobalGuardsModule`의 `GlobalGuard`가 이 Guard를 주입받아
 * 인증보다 먼저 호출한다(인증 실패 401 요청도 세어야 토큰 없는 요청 폭주를 막을 수 있다).
 */
@Module({
  imports: [ThrottlerModule.forRoot(createThrottlerOptions())],
  providers: [AppThrottlerGuard],
  exports: [AppThrottlerGuard],
})
export class ThrottlingModule {}
