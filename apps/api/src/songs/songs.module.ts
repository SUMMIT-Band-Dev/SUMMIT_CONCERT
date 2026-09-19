import { Module } from '@nestjs/common';
import { SongsController } from './songs.controller.js';
import { TeamSongsController } from './team-songs.controller.js';
import { SongsService } from './songs.service.js';

// PrismaModule이 @Global이라 여기서 따로 import하지 않는다.
// 컨트롤러가 둘인 이유는 경로가 팀 하위(`/teams/:teamId/songs`)와
// 평탄(`/songs/:id`)으로 나뉘기 때문이다 (team-songs.controller.ts 주석 참조).
@Module({
  controllers: [TeamSongsController, SongsController],
  providers: [SongsService],
})
export class SongsModule {}
