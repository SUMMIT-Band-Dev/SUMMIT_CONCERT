import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { mapRecordNotFound } from '../common/prisma-error.js';
import { SONG_NOT_FOUND_MESSAGE } from '../songs/songs.constants.js';
import { toSongResponse, type SongResponse } from '../songs/dto/song-response.js';
import { YoutubeReviewStatus } from '../generated/prisma/enums.js';
import { checkYoutubeUrl } from './youtube-url.js';
import { supersedeOpenAttempts } from './youtube-attempt.js';
import { YOUTUBE_URL_REJECTION_MESSAGES } from './youtube.constants.js';

@Injectable()
export class YoutubeUrlService {
  private readonly logger = new Logger(YoutubeUrlService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 유튜브 URL 수동 입력·교정 (PRD F013).
   *
   * **URL과 검토 상태를 한 번의 UPDATE로 함께 바꾼다.** 두 문으로 나누면 사이에서
   * 실패했을 때 "URL은 들어갔는데 pending으로 남은" 행이 생기고, 그 행은 6단계 2/2의
   * 배치 재검색 대상에 다시 잡힌다 — 사람이 확정한 링크가 자동 추천으로 덮일 수 있다.
   *
   * 상태는 현재 값과 무관하게 항상 `approved`다. pending(미검토)이든 rejected(추천 반려)든,
   * 사람이 직접 주소를 넣었다는 사실이 자동 추천에 대한 판단보다 우선한다. 특히 rejected는
   * "추천이 틀렸다"는 뜻이지 "이 곡에는 영상이 없다"는 뜻이 아니라서, 교정 입력이 들어오면
   * 되돌아와야 맞다 (PRD F013이 "추천이 틀렸을 경우 직접 URL 입력해 교정"으로 정의한 흐름).
   *
   * 존재 확인 쿼리를 따로 돌리지 않고 `P2025`를 404로 매핑한다 — 같은 팀 안을 훑는
   * 중복 검사가 없어 잠금도 트랜잭션도 필요 없기 때문이다 (F010과 같은 구조).
   *
   * `title`/`singer`/`albumCoverUrl`은 건드리지 않는다. DTO에 없어서 전역
   * `forbidNonWhitelisted`가 막고, `data`에도 넣지 않는다.
   *
   * URL 중복은 허용한다 — 다른 팀이 같은 곡을 연주할 수 있다.
   *
   * **열린 추천을 함께 닫는다 (work02-6b에서 추가).** 사람이 직접 주소를 넣은 순간 자동
   * 추천은 의미를 잃는데, 그대로 두면 URL이 채워진 곡의 추천이 리뷰 목록에 계속 남아
   * 관리자가 이미 끝난 일을 다시 본다. 후보 행도 함께 지운다 — YouTube 개발자 정책의
   * 30일 보관 제한 대응으로 "리뷰가 끝나는 모든 경로에서 후보를 삭제"하기 때문이다.
   *
   * 곡 갱신과 추천 정리를 **한 트랜잭션**으로 묶는다. 나누면 사이에서 실패했을 때
   * "URL은 approved인데 추천은 열려 있는" 행이 남아, F012 승인이 그 곡을 다시 건드릴 수 있다.
   * 잠금 순서는 `Setlist` → `YoutubeSearchAttempt`로 전역 규칙을 따른다
   * (`common/lock-order.ts`). 역순으로 잡는 경로가 없어 데드락이 성립하지 않는다.
   */
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

    return this.prisma.$transaction(async (tx) => {
      const updated = await mapRecordNotFound(
        tx.setlist.update({
          where: { id: songId },
          data: {
            youtubeUrl: checked.url,
            youtubeReviewStatus: YoutubeReviewStatus.approved,
          },
        }),
        SONG_NOT_FOUND_MESSAGE,
      );

      await supersedeOpenAttempts(tx, songId);

      return toSongResponse(updated);
    });
  }
}
