import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { TeamsModule } from './teams/teams.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    // AuthModule이 전역 Guard(APP_GUARD)를 등록하므로, 이후 추가되는 모든 라우트는
    // 기본적으로 인증이 필요한 상태가 된다. 공개 라우트는 @Public()으로 표시한다.
    AuthModule,
    HealthModule,
    TeamsModule,
  ],
})
export class AppModule {}
