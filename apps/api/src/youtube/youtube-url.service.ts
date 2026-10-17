import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { mapRecordNotFound } from '../common/prisma-error.js';
import { SONG_NOT_FOUND_MESSAGE } from '../songs/songs.constants.js';
import {
  toSongResponse,
  type SongResponse,
} from '../songs/dto/song-response.js';
import { checkYoutubeUrl } from './youtube-url.js';
import { YOUTUBE_URL_REJECTION_MESSAGES } from './youtube.constants.js';

@Injectable()
export class YoutubeUrlService {
  private readonly logger = new Logger(YoutubeUrlService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 유튜브 URL 등록·수정 (F025). URL만 갱신하며 추천 이력 테이블은 건드리지 않는다. */
  async update(songId: bigint, rawUrl: string): Promise<SongResponse> {
    const checked = checkYoutubeUrl(rawUrl);
    if (!checked.ok) {
      // 입력값 전문은 남기지 않는다. 사유와 길이만으로 원인 파악에 충분하고,
      // 관리자가 붙여 넣은 주소가 로그에 쌓일 이유가 없다.
      this.logger.warn(
        `유튜브 URL 거부 (songId=${songId}, reason=${checked.reason}, length=${rawUrl.length})`,
      );
      throw new BadRequestException(
        YOUTUBE_URL_REJECTION_MESSAGES[checked.reason],
      );
    }

    return this.saveUrl(songId, checked.url);
  }

  /** 빈 값 저장은 DELETE로 연결을 해제한다. 이미 미연결이어도 같은 결과를 돌려준다. */
  remove(songId: bigint): Promise<SongResponse> {
    return this.saveUrl(songId, null);
  }

  private async saveUrl(
    songId: bigint,
    youtubeUrl: string | null,
  ): Promise<SongResponse> {
    const updated = await mapRecordNotFound(
      this.prisma.setlist.update({
        where: { id: songId },
        data: { youtubeUrl },
      }),
      SONG_NOT_FOUND_MESSAGE,
    );
    return toSongResponse(updated);
  }
}
