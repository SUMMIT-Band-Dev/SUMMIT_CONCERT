import { Module } from '@nestjs/common';
import { YoutubeUrlController } from './youtube-url.controller.js';
import { YoutubeUrlService } from './youtube-url.service.js';

/** 유튜브 URL 관리 (F025). 후보 정리는 독립 스크립트에서만 실행한다. */
@Module({ controllers: [YoutubeUrlController], providers: [YoutubeUrlService] })
export class YoutubeModule {}
