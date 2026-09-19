import { Body, Controller, Param, Patch } from '@nestjs/common';
import { ParseBigIntPipe } from '../common/parse-bigint.pipe.js';
import { SongsService } from './songs.service.js';
import { UpdateSongDto } from './dto/update-song.dto.js';
import type { SongResponse } from './dto/song-response.js';

/**
 * 곡 단건 수정 (PRD F009).
 *
 * 팀 하위에 중첩하지 않는 이유는 `TeamSongsController` 주석 참조.
 * `@Public()`을 붙이지 않는다 — 전역 Guard가 기본으로 인증을 요구한다.
 */
@Controller('songs')
export class SongsController {
  constructor(private readonly songsService: SongsService) {}

  @Patch(':id')
  update(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateSongDto,
  ): Promise<SongResponse> {
    return this.songsService.update(id, dto);
  }
}
