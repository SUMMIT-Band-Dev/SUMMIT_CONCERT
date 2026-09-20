import { Body, Controller, Param, Put } from '@nestjs/common';
import { ParseBigIntPipe } from '../common/parse-bigint.pipe.js';
import { YoutubeUrlService } from './youtube-url.service.js';
import { UpdateYoutubeUrlDto } from './dto/update-youtube-url.dto.js';
import type { SongResponse } from '../songs/dto/song-response.js';

/**
 * 유튜브 URL 수동 수정 (PRD F013).
 *
 * 경로를 `songs/:id/youtube-url`로 둔 것은 앨범 커버(`songs/:id/album-cover`)와 같은
 * 이유다 — `PATCH /songs/:id`(제목·가수)와 메서드·경로가 모두 달라 충돌하지 않고,
 * "이 곡의 유튜브 링크"라는 하위 리소스를 통째로 교체하는 의미라 `PUT`이 맞다.
 *
 * 6단계 2/2의 배치 추천 검색·리뷰(F011/F012)는 곡 하나가 아니라 여러 곡을 다루므로
 * 이 컨트롤러가 아니라 별도 경로로 붙는다. 그래서 컨트롤러 이름도 모듈 이름(`Youtube`)이
 * 아니라 다루는 리소스(`YoutubeUrl`) 기준이다.
 *
 * `@Public()`을 붙이지 않는다 — 전역 `GlobalGuard`(요청 제한 → 인증)가 기본으로 인증을 요구한다.
 */
@Controller('songs/:id/youtube-url')
export class YoutubeUrlController {
  constructor(private readonly youtubeUrlService: YoutubeUrlService) {}

  @Put()
  update(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateYoutubeUrlDto,
  ): Promise<SongResponse> {
    return this.youtubeUrlService.update(id, dto.url);
  }
}
