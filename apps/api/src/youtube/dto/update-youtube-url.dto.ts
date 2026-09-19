import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { TrimString } from '../../common/trim.transform.js';
import {
  YOUTUBE_URL_MAX_LENGTH,
  YOUTUBE_URL_REQUIRED_MESSAGE,
  YOUTUBE_URL_TOO_LONG_MESSAGE,
} from '../youtube.constants.js';

/**
 * 유튜브 URL 수동 입력·교정 요청 (PRD F013).
 *
 * `url` 하나만 받는다. 검토 상태(`youtubeReviewStatus`)를 본문으로 받지 않는 것이
 * 중요한데, 사람이 직접 입력한 URL은 **항상 approved**로 확정되기 때문이다
 * (`YoutubeUrlService` 주석 참조). 상태를 클라이언트가 정할 수 있으면 "URL은 넣었는데
 * pending으로 남아 배치 재검색 대상이 되는" 모순된 행이 생긴다.
 *
 * 곡 제목·가수도 받지 않는다 — DTO에 없는 필드는 전역 `forbidNonWhitelisted`가 400으로 막는다.
 *
 * 형식 검증(호스트·경로·영상 ID)은 여기가 아니라 `youtube-url.ts`에서 한다.
 * 사유별로 다른 안내 문구가 나가야 해서 class-validator의 단일 메시지로는 부족하다.
 * 여기서는 길이 상한만 걸어 비정상적으로 긴 본문을 파싱 전에 자른다.
 *
 * 데코레이터는 아래에서 위로 적용되므로 `stopAtFirstError` 아래에서는 "비어 있음"
 * 검사가 맨 먼저 보여야 한다 — 그래서 맨 아래에 둔다 (팀/곡/앨범 커버 DTO와 동일).
 */
export class UpdateYoutubeUrlDto {
  @MaxLength(YOUTUBE_URL_MAX_LENGTH, { message: YOUTUBE_URL_TOO_LONG_MESSAGE })
  @IsString({ message: YOUTUBE_URL_REQUIRED_MESSAGE })
  @IsNotEmpty({ message: YOUTUBE_URL_REQUIRED_MESSAGE })
  @TrimString()
  url: string;
}
