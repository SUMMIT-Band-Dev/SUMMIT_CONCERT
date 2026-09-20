import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AlbumCoverModule } from './album-cover/album-cover.module.js';
import { AuthModule } from './auth/auth.module.js';
import { GlobalGuardsModule } from './guards/global-guards.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SongsModule } from './songs/songs.module.js';
import { TeamsModule } from './teams/teams.module.js';
import { YoutubeModule } from './youtube/youtube.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    // 전역 Guard의 유일한 등록 지점. 요청 제한 → 인증 순서를 GlobalGuard가 코드로 정하므로 이 import의
    // 위치와 순서는 실행 순서에 영향이 없다. 이후 추가되는 모든 라우트는 기본적으로 인증이 필요하고
    // 공개 라우트만 @Public()으로 연다.
    GlobalGuardsModule,
    AuthModule,
    HealthModule,
    TeamsModule,
    SongsModule,
    AlbumCoverModule,
    YoutubeModule,
  ],
})
export class AppModule {}
