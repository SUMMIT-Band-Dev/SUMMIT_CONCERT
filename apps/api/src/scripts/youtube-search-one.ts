/**
 * 곡 하나만 지정해 유튜브 배치 검색을 실행하는 검증 전용 스크립트 (work02-7c-4).
 *
 *   npm run youtube:search-one -- <songId>
 *
 * ## 왜 필요한가
 *
 * `YoutubeBatchService.searchForSong()`은 "프로덕션에서 임시 곡만으로 쓰기 검증을 하기
 * 위한 진입점"이라고 스스로 주석에 밝히고 있지만, 공개 라우트가 없다(컨트롤러에 노출하지
 * 않는다 — `youtube-batch.service.ts` 주석). `POST /youtube/recommendations/batch`는
 * 대상을 서버가 자동 선정하고 미시도 곡을 항상 먼저 처리하므로, `limit=1`을 줘도
 * `__verify__` 곡이 아니라 실제 59곡 중 하나가 걸린다 — 이 스크립트가 유일한 단일 곡
 * 검증 경로다.
 *
 * ## 쿼터
 *
 * **실제 YouTube Data API 쿼터를 1회 소모한다.** 되돌릴 수 없다. 검증용 임시 곡
 * (`__verify__`로 시작하는 제목 등) 하나에만, 딱 1회만 실행한다. 실제 59곡을 지정해
 * 돌리지 않는다 — 그건 이 스크립트가 아니라 관리자 UI의 배치 버튼(사용자가 별도로
 * 판단해서 진행)이 할 일이다.
 *
 * `youtube-cleanup.ts`와 같은 이유로 `AppModule`을 쓰지 않고 축소 모듈을 띄운다 —
 * 다만 이 스크립트는 실제로 외부 API를 호출하므로 `YOUTUBE_BATCH_API_KEY`가 필요하다
 * (`YoutubeModule`과 동일한 프로바이더 구성).
 */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ProcessMutex } from '../common/process-mutex.js';
import { YoutubeBatchService } from '../youtube/youtube-batch.service.js';
import { YoutubeQuotaService } from '../youtube/youtube-quota.service.js';
import { YoutubeMaintenanceService } from '../youtube/youtube-maintenance.service.js';
import {
  HttpYoutubeSearchClient,
  YOUTUBE_SEARCH_CLIENT,
} from '../youtube/youtube-search.client.js';
import { readBatchApiKey } from '../youtube/youtube.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
  providers: [
    YoutubeBatchService,
    YoutubeQuotaService,
    YoutubeMaintenanceService,
    { provide: ProcessMutex, useFactory: () => new ProcessMutex() },
    {
      provide: YOUTUBE_SEARCH_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new HttpYoutubeSearchClient(readBatchApiKey(config)),
    },
  ],
})
class YoutubeSearchOneModule {}

function readSongIdArg(): bigint {
  // "npm run youtube:search-one -- 123" 형태로 넘긴 인자만 받는다. npm이 스크립트 자체
  // 인자를 앞에 끼워 넣지 않으므로 process.argv[2]가 곧 songId다.
  const raw = process.argv[2];
  if (!raw || !/^\d+$/.test(raw)) {
    throw new Error('사용법: npm run youtube:search-one -- <songId>  (songId는 양의 정수)');
  }

  return BigInt(raw);
}

async function main(): Promise<void> {
  const songId = readSongIdArg();

  const context = await NestFactory.createApplicationContext(YoutubeSearchOneModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    console.log(`⚠️  songId=${songId} 곡 1개로 유튜브 검색을 실행합니다. 쿼터 1회를 소모하며 되돌릴 수 없습니다.`);

    const batchService = context.get(YoutubeBatchService);
    const summary = await batchService.searchForSong(songId);

    console.log('실행 결과');
    console.log(`  처리: ${summary.processed}곡 (성공 ${summary.searched} / 결과없음 ${summary.noResults} / 실패 ${summary.failed})`);
    console.log(`  중단 사유: ${summary.abortedBy ?? '없음'}`);
    console.log(`  오늘 사용량: ${summary.quota.usedToday}/${summary.quota.limit} (남은 ${summary.quota.remaining}회)`);
  } finally {
    await context.close();
  }
}

try {
  await main();
} catch (error) {
  // §13 트러블슈팅 4와 같은 이유로 process.exit()를 부르지 않는다 (youtube-cleanup.ts 참조).
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
