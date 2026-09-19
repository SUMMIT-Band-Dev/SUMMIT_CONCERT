import { Module } from '@nestjs/common';
import { YoutubeUrlController } from './youtube-url.controller.js';
import { YoutubeUrlService } from './youtube-url.service.js';

/**
 * 유튜브 연결 관리 모듈 (PRD F011~F013).
 *
 * 6단계 1/2에서는 F013(수동 수정)만 들어 있다. `SongsModule`과 분리한 이유는
 * 2/2에서 붙을 배치 추천 검색(F011)이 YouTube Data API 호출과 **일일 quota** 관리를
 * 끌고 오기 때문이다 — 곡 CRUD 테스트가 그 의존성까지 짊어지게 할 이유가 없다
 * (`AlbumCoverModule`을 분리한 것과 같은 판단).
 *
 * `PrismaModule`이 `@Global`이라 여기서 따로 import하지 않는다.
 * 지금은 외부 호출이 없어 아웃바운드 상한·타임아웃 provider도 없다 — 2/2에서 추가한다.
 */
@Module({
  controllers: [YoutubeUrlController],
  providers: [YoutubeUrlService],
})
export class YoutubeModule {}
