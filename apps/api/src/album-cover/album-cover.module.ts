import { Module } from '@nestjs/common';
import { AlbumCoverController } from './album-cover.controller.js';
import { AlbumCoverService } from './album-cover.service.js';
import { HttpItunesClient, ITUNES_CLIENT } from './itunes.client.js';
import { OutboundRateLimiter } from './outbound-rate-limiter.js';

/**
 * 앨범 커버 자동 매칭 모듈 (PRD F010).
 *
 * `SongsModule`과 분리했다 — 곡 CRUD는 DB만 다루는데 이쪽은 외부 API와 호출 상한을
 * 함께 들고 있어서, 섞으면 곡 CRUD 테스트가 외부 의존성까지 끌고 오게 된다.
 * 커밋과 PR도 이 경계로 쪼갤 수 있다.
 *
 * `OutboundRateLimiter`를 팩토리로 등록하는 이유: 생성자가 기본값 있는 일반 인자를
 * 받는데, `@Injectable()`을 붙이면 `emitDecoratorMetadata`가 그 자리를 `Number`/`Function`
 * 으로 기록해 Nest가 주입을 시도하다 실패한다. 상태(호출 시각 목록)를 들고 있으므로
 * 싱글턴이어야 한다는 점도 중요하다 — 요청마다 새로 만들면 상한이 아무 의미가 없다.
 */
@Module({
  controllers: [AlbumCoverController],
  providers: [
    AlbumCoverService,
    { provide: ITUNES_CLIENT, useClass: HttpItunesClient },
    { provide: OutboundRateLimiter, useFactory: () => new OutboundRateLimiter() },
  ],
})
export class AlbumCoverModule {}
