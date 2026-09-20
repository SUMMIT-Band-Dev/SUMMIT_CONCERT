import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AlbumCoverModule } from './album-cover/album-cover.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SongsModule } from './songs/songs.module.js';
import { ThrottlingModule } from './throttling/throttling.module.js';
import { TeamsModule } from './teams/teams.module.js';
import { YoutubeModule } from './youtube/youtube.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    // 요청 제한은 인증보다 먼저 실행돼야 한다(전역 Guard는 등록 순서대로 실행). 반드시 AuthModule 앞에 둔다.
    ThrottlingModule,
    // AuthModule이 전역 Guard(APP_GUARD)를 등록하므로, 이후 추가되는 모든 라우트는
    // 기본적으로 인증이 필요한 상태가 된다. 공개 라우트는 @Public()으로 표시한다.
    AuthModule,
    HealthModule,
    TeamsModule,
    SongsModule,
    AlbumCoverModule,
    YoutubeModule,
  ],
})
export class AppModule {}
