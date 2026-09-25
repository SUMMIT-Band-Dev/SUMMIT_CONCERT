import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProcessMutex } from '../common/process-mutex.js';
import { YoutubeUrlController } from './youtube-url.controller.js';
import { YoutubeUrlService } from './youtube-url.service.js';
import { YoutubeRecommendationsController } from './youtube-recommendations.controller.js';
import { YoutubeBatchService } from './youtube-batch.service.js';
import { YoutubeReviewService } from './youtube-review.service.js';
import { YoutubeQuotaService } from './youtube-quota.service.js';
import { YoutubeMaintenanceService } from './youtube-maintenance.service.js';
import {
  HttpYoutubeSearchClient,
  YOUTUBE_SEARCH_CLIENT,
} from './youtube-search.client.js';
import { YOUTUBE_BATCH_API_KEY_ENV } from './youtube-search.constants.js';

/** 구글 API 키의 최소 길이. 실제 키는 39자이지만 형식이 바뀔 여지를 두고 하한만 건다. */
export const MIN_API_KEY_LENGTH = 20;

/**
 * 유튜브 연결 관리 모듈 (PRD F011~F013).
 *
 * `SongsModule`과 분리한 이유는 이 모듈만 **외부 API와 일일 쿼터**를 들고 있기 때문이다 —
 * 곡 CRUD 테스트가 그 의존성까지 짊어지게 할 이유가 없다(`AlbumCoverModule`과 같은 판단).
 *
 * `PrismaModule`이 `@Global`이라 여기서 따로 import하지 않는다.
 *
 * ## 분당 아웃바운드 상한을 두지 않았다
 *
 * iTunes(§13)에는 `OutboundRateLimiter`를 붙였지만 여기엔 없다. 확인된 할당량이
 * `Search Queries per day = 100`, `per minute = 100`이라 **하루 총합(80)을 1분에 다 쏟아부어도
 * 분당 한도에 닿지 못한다.** 발동할 수 없는 장치를 넣으면 읽는 사람이 그게 지켜 주는 줄 안다.
 * iTunes는 분당 제한만 있고 일일 제한이 없어 상황이 정반대였다.
 */
@Module({
  controllers: [YoutubeUrlController, YoutubeRecommendationsController],
  providers: [
    YoutubeUrlService,
    YoutubeBatchService,
    YoutubeReviewService,
    YoutubeQuotaService,
    YoutubeMaintenanceService,
    // 상태(실행 중 여부)를 들고 있으므로 반드시 싱글턴이어야 한다.
    // 요청마다 새로 만들면 중복 실행 방지가 아무 의미가 없다.
    { provide: ProcessMutex, useFactory: () => new ProcessMutex() },
    {
      provide: YOUTUBE_SEARCH_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new HttpYoutubeSearchClient(readBatchApiKey(config)),
    },
  ],
})
export class YoutubeModule {}

/**
 * 배치용 API 키를 읽는다. **없거나 이상하면 기동 자체를 실패시킨다.**
 *
 * `JWT_SECRET`(§10)·Storage 시크릿(§13)과 같은 방침이다. 기본값을 두거나 런타임까지 미루면
 * 키 없이 뜬 서버가 첫 배치에서야 실패하는데, 그때는 이미 예약 행이 쌓인 뒤다.
 *
 * **환경변수 이름이 프론트와 다르다.** 프론트 실시간 폴백은 `YOUTUBE_API_KEY`(루트
 * `.env.local`)를 쓰고, 배치는 `YOUTUBE_BATCH_API_KEY`(`apps/api/.env`)를 쓴다.
 * 쿼터는 키가 아니라 **Cloud 프로젝트**에 귀속되므로(구글 문서: "the project associated with
 * the API key is used as the quota project"), 같은 프로젝트에서 키만 두 개 만들면 버킷을
 * 공유해 아무 보호가 되지 않는다. 두 키는 **서로 다른 Cloud 프로젝트**의 것이어야 한다.
 *
 * 값은 어디에도 출력하지 않는다 — 길이만 본다.
 */
export function readBatchApiKey(config: ConfigService): string {
  const key = config.getOrThrow<string>(YOUTUBE_BATCH_API_KEY_ENV).trim();

  if (key.length < MIN_API_KEY_LENGTH) {
    throw new Error(
      `${YOUTUBE_BATCH_API_KEY_ENV}가 너무 짧습니다 (${key.length}자). ` +
        '배치 전용 Cloud 프로젝트에서 발급한 API 키를 설정하세요.',
    );
  }

  return key;
}
