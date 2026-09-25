import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { TrimString } from '../../common/trim.transform.js';
import {
  ALBUM_COVER_URL_MAX_LENGTH,
  ALBUM_COVER_URL_REQUIRED_MESSAGE,
  ALBUM_COVER_URL_TOO_LONG_MESSAGE,
} from '../album-cover.constants.js';

/**
 * 앨범 커버 반영 요청 (PRD F010).
 *
 * 후보 조회 응답의 `artworkUrl`을 그대로 넣으면 된다. 곡 제목·가수는 받지 않는다 —
 * 이 엔드포인트로 곡 정보를 고칠 수 있으면 "커버만 바꾸려다 제목이 덮어써지는" 경로가
 * 생긴다. DTO에 없는 필드는 전역 `forbidNonWhitelisted`가 400으로 막는다.
 *
 * 형식 검증(https·호스트·경로)은 여기가 아니라 `album-cover-url.ts`에서 한다.
 * 벤치마크 스크립트가 **같은 함수**로 후보를 판정해야 하기 때문이다.
 *
 * 데코레이터는 아래에서 위로 적용되므로 `stopAtFirstError` 아래에서는 "비어 있음"
 * 검사가 맨 먼저 보여야 한다 — 그래서 맨 아래에 둔다 (팀/곡 DTO와 동일).
 */
export class UpdateAlbumCoverDto {
  @MaxLength(ALBUM_COVER_URL_MAX_LENGTH, {
    message: ALBUM_COVER_URL_TOO_LONG_MESSAGE,
  })
  @IsString({ message: ALBUM_COVER_URL_REQUIRED_MESSAGE })
  @IsNotEmpty({ message: ALBUM_COVER_URL_REQUIRED_MESSAGE })
  @TrimString()
  url: string;
}
