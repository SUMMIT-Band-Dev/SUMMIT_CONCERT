import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ParseBigIntPipe } from '../common/parse-bigint.pipe.js';
import { TeamsService } from './teams.service.js';
import { CreateTeamDto } from './dto/create-team.dto.js';
import { UpdateTeamDto } from './dto/update-team.dto.js';
import { ReorderTeamsDto } from './dto/reorder-teams.dto.js';
import type { TeamResponse } from './dto/team-response.js';

/**
 * 팀(Line Up) 관리 API (PRD F003~F006).
 *
 * `@Public()`을 붙이지 않는다 — `AuthModule`이 등록한 전역 Guard 덕분에
 * 네 엔드포인트 모두 기본으로 인증이 필요하다. 삭제는 MVP 스코프 밖이라
 * 만들지 않는다(오입력은 수정으로 대응).
 */
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  findAll(): Promise<TeamResponse[]> {
    return this.teamsService.findAll();
  }

  @Post()
  create(@Body() dto: CreateTeamDto): Promise<TeamResponse> {
    return this.teamsService.create(dto);
  }

  /**
   * ⚠️ 반드시 `@Patch(':id')`보다 **먼저** 선언해야 한다.
   * 순서가 뒤집히면 `reorder`가 id 파라미터로 매칭돼 400이 난다.
   * (teams.controller.spec.ts가 선언 순서를 고정하고 있다)
   */
  @Patch('reorder')
  reorder(@Body() dto: ReorderTeamsDto): Promise<TeamResponse[]> {
    return this.teamsService.reorder(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateTeamDto,
  ): Promise<TeamResponse> {
    return this.teamsService.update(id, dto);
  }
}
