/**
 * 유튜브 추천 보관 정리 스크립트 (PRD F011/F012의 부수 요구).
 *
 *   npm run youtube:cleanup
 *
 * 두 가지를 정리한다.
 *   1. 10분 넘게 `reserved`로 남은 예약 → `failed` (크래시 잔재)
 *   2. 30일 넘게 `open`인 시도의 후보 삭제 + 시도를 `expired`로 닫기
 *
 * ## 왜 스크립트가 따로 있나
 *
 * 같은 정리가 **배치 실행 시작 시점에도** 돌지만, 배치를 한동안 돌리지 않으면 정리도
 * 돌지 않는다. 그러면 후보 행이 30일을 넘겨 남아 있게 된다 — 조회 응답에서는 제외되므로
 * 화면에 노출되지는 않지만, 보관 자체가 제한을 넘는다.
 *
 * ⚠️ **스케줄러가 없다.** 지금은 사람이 실행하거나 배치가 트리거하는 것이 전부다.
 * 크론(또는 배포 플랫폼의 스케줄 기능) 연결은 7단계 항목으로 남겼다 — REFACTOR_NOTES §10 참조.
 *
 * ## 30일 기준의 근거
 *
 * YouTube 개발자 정책이 비인증 데이터를 *"not longer than 30 calendar days"* 보관하도록 하고
 * 이후 *"must either delete or refresh"* 를 요구한다. **이 조항이 검색 결과 메타데이터에
 * 적용된다는 것은 구현자의 해석이며 법적 확인을 받지 않았다.**
 *
 * `AppModule`을 쓰지 않고 축소 모듈을 띄운다 — `seed-admin`과 같은 이유로, 정리 작업이
 * `JWT_SECRET`이나 `YOUTUBE_BATCH_API_KEY` 설정에 묶일 이유가 없다. 이 스크립트는
 * 외부 API를 호출하지 않으므로 **쿼터를 한 번도 쓰지 않는다.**
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaModule } from '../prisma/prisma.module.js';
import { YoutubeMaintenanceService } from '../youtube/youtube-maintenance.service.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
  providers: [YoutubeMaintenanceService],
})
class YoutubeCleanupModule {}

async function main(): Promise<void> {
  const context = await NestFactory.createApplicationContext(YoutubeCleanupModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const maintenance = context.get(YoutubeMaintenanceService);
    const result = await maintenance.run();

    console.log('유튜브 추천 정리 결과');
    console.log(`  예약 만료 정리(reserved → failed): ${result.staleReservations}건`);
    console.log(`  30일 경과 시도 닫기(open → expired): ${result.expiredAttempts}건`);
    console.log(`  삭제한 후보 행: ${result.deletedCandidates}행`);
  } finally {
    await context.close();
  }
}

try {
  await main();
} catch (error) {
  // §13 트러블슈팅 4: Windows에서 process.exit()를 부르면 pg 풀이 닫히는 중에
  // libuv 어서션이 나고 종료 코드가 오염된다. exitCode만 정해 두고 Node가 끝나게 둔다.
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
