import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ParseBigIntPipe } from '../common/parse-bigint.pipe.js';
import { SongsService } from './songs.service.js';
import { CreateSongDto } from './dto/create-song.dto.js';
import type { SongResponse } from './dto/song-response.js';

/**
 * 팀에 속한 곡 조회·등록 (PRD F008/F009).
 *
 * 경로를 팀 하위에 중첩한 이유는 PRD의 관리자 흐름이 "팀 선택 → 해당 팀 곡 패널"
 * 이라 조회·등록 시 팀이 **항상** 정해져 있기 때문이다. 중첩하면 `teamId`가
 * 타입 수준에서 필수가 되고 본문에서는 사라진다 — 곡의 팀을 옮기는 경로가
 * 구조적으로 존재하지 않게 된다.
 *
 * 반면 **수정은 `SongsController`의 평탄한 `/songs/:id`** 다. 곡 id 하나로 이미
 * 유일하게 지목되므로, 중첩하면 `:teamId`와 실제 소속을 대조하는 분기가
 * 추가로 생겨 실패 모드만 늘어난다.
 *
 * `@Public()`을 붙이지 않는다 — 전역 `GlobalGuard`(요청 제한 → 인증) 덕분에
 * 기본으로 인증이 필요하다. 곡 삭제는 MVP 스코프 밖이라 만들지 않는다.
 */
@Controller('teams/:teamId/songs')
export class TeamSongsController {
  constructor(private readonly songsService: SongsService) {}

  @Get()
  findAllByTeam(
    @Param('teamId', ParseBigIntPipe) teamId: bigint,
  ): Promise<SongResponse[]> {
    return this.songsService.findAllByTeam(teamId);
  }

  @Post()
  create(
    @Param('teamId', ParseBigIntPipe) teamId: bigint,
    @Body() dto: CreateSongDto,
  ): Promise<SongResponse> {
    return this.songsService.create(teamId, dto);
  }
}
