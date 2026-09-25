import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { TeamsController } from './teams.controller.js';
import { TeamsService } from './teams.service.js';
import { TeamCardImageController } from './team-card-image.controller.js';
import { TeamCardImageService } from './team-card-image.service.js';

// PrismaModule이 @Global이라 여기서 따로 import하지 않는다.
// StorageModule은 전역이 아니라 명시적으로 들인다 — 저장소를 쓰는 곳이
// 카드뉴스 업로드 하나뿐이라, 어디서 쓰이는지가 import에 드러나는 편이 낫다.
@Module({
  imports: [StorageModule],
  controllers: [TeamsController, TeamCardImageController],
  providers: [TeamsService, TeamCardImageService],
})
export class TeamsModule {}
