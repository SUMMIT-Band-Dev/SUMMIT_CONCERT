import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { TrimString } from '../../common/trim.transform.js';
import {
  YOUTUBE_URL_MAX_LENGTH,
  YOUTUBE_URL_REQUIRED_MESSAGE,
  YOUTUBE_URL_TOO_LONG_MESSAGE,
} from '../youtube.constants.js';

/**
 * 유튜브 URL 등록·수정 요청 (F025). URL 하나만 받는다.
 * 다른 필드는 전역 whitelist가 거부하고, 빈 값은 DELETE로 연결을 해제한다.
 * 호스트·경로·영상 ID 검증은 사유별 안내를 위해 서비스에서 수행한다.
 */
export class UpdateYoutubeUrlDto {
  @MaxLength(YOUTUBE_URL_MAX_LENGTH, { message: YOUTUBE_URL_TOO_LONG_MESSAGE })
  @IsString({ message: YOUTUBE_URL_REQUIRED_MESSAGE })
  @IsNotEmpty({ message: YOUTUBE_URL_REQUIRED_MESSAGE })
  @TrimString()
  url: string;
}
