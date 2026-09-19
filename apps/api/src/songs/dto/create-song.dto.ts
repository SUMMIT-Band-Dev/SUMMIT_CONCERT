import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { TrimString } from '../../common/trim.transform.js';
import {
  SINGER_MAX_LENGTH,
  SINGER_REQUIRED_MESSAGE,
  SONG_TITLE_MAX_LENGTH,
  SONG_TITLE_REQUIRED_MESSAGE,
} from '../songs.constants.js';

/**
 * 곡 등록 요청 (PRD F009). 제목 + 가수만 받는다.
 *
 * `teamId`는 일부러 넣지 않았다 — 경로(`/teams/:teamId/songs`)가 소속을 정하므로
 * 본문으로 팀을 지정할 경로가 아예 없다. 즉 "곡의 팀 이동"이 구조적으로 불가능하다.
 * `albumCoverUrl`(F010)·`youtubeUrl`(F011~F013)도 마찬가지로 입력 대상이 아니며,
 * 클라이언트가 보내면 전역 `forbidNonWhitelisted`에 걸려 400이 된다.
 *
 * 데코레이터는 아래에서 위로 적용되므로 class-validator가 보는 제약 순서는
 * 선언 순서의 역순이다. `stopAtFirstError`로 필드당 메시지가 하나만 나가기 때문에,
 * 가장 먼저 보여야 할 "비어 있음" 검사를 맨 아래에 둔다 (팀 DTO와 동일).
 */
export class CreateSongDto {
  @MaxLength(SONG_TITLE_MAX_LENGTH, {
    message: `곡 제목은 ${SONG_TITLE_MAX_LENGTH}자를 넘을 수 없습니다.`,
  })
  @IsString({ message: SONG_TITLE_REQUIRED_MESSAGE })
  @IsNotEmpty({ message: SONG_TITLE_REQUIRED_MESSAGE })
  @TrimString()
  title: string;

  @MaxLength(SINGER_MAX_LENGTH, {
    message: `가수는 ${SINGER_MAX_LENGTH}자를 넘을 수 없습니다.`,
  })
  @IsString({ message: SINGER_REQUIRED_MESSAGE })
  @IsNotEmpty({ message: SINGER_REQUIRED_MESSAGE })
  @TrimString()
  singer: string;
}
