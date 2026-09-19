import { Module } from '@nestjs/common';
import { TeamsController } from './teams.controller.js';
import { TeamsService } from './teams.service.js';

// PrismaModule이 @Global이라 여기서 따로 import하지 않는다.
@Module({
  controllers: [TeamsController],
  providers: [TeamsService],
})
export class TeamsModule {}
