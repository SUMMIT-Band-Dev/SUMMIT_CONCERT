import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  UseFilters,
} from '@nestjs/common';
import { ParseBigIntPipe } from '../common/parse-bigint.pipe.js';
import { AlbumCoverService } from './album-cover.service.js';
import { OutboundRateLimitFilter } from './outbound-rate-limit.filter.js';
import { UpdateAlbumCoverDto } from './dto/update-album-cover.dto.js';
import type { AlbumCoverCandidate } from './dto/album-cover-candidate.js';
import type { SongResponse } from '../songs/dto/song-response.js';

/**
 * 앨범 커버 자동 매칭 (PRD F010).
 *
 * "후보 조회"와 "반영"을 두 요청으로 나눈다. 최상위 후보를 자동으로 반영하지 않는
 * 이유는 US 스토어프런트가 한국어 곡을 영문 표기로 돌려주기 때문이다 — 자동 선택의
 * 근거가 될 만한 신뢰도 지표를 만들 수 없어서, 고르는 것은 사람이 한다.
 *
 * 경로를 `songs/:id/album-cover` 아래로 묶은 것은 두 요청이 같은 리소스를 다루기
 * 때문이다. `SongsController`의 `PATCH /songs/:id`와는 메서드도 경로도 달라 충돌하지 않는다.
 *
 * `@Public()`을 붙이지 않는다 — 전역 Guard가 기본으로 인증을 요구한다.
 */
@Controller('songs/:id/album-cover')
@UseFilters(OutboundRateLimitFilter)
export class AlbumCoverController {
  constructor(private readonly albumCoverService: AlbumCoverService) {}

  @Get('candidates')
  findCandidates(
    @Param('id', ParseBigIntPipe) id: bigint,
  ): Promise<AlbumCoverCandidate[]> {
    return this.albumCoverService.findCandidates(id);
  }

  @Put()
  update(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateAlbumCoverDto,
  ): Promise<SongResponse> {
    return this.albumCoverService.update(id, dto.url);
  }
}
