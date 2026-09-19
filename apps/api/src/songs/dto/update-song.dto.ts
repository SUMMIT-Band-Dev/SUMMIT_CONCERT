import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { TrimString } from '../../common/trim.transform.js';
import {
  SINGER_MAX_LENGTH,
  SINGER_REQUIRED_MESSAGE,
  SONG_TITLE_MAX_LENGTH,
  SONG_TITLE_REQUIRED_MESSAGE,
} from '../songs.constants.js';

/**
 * 곡 수정 요청 (PRD F009). 제목과 가수만 개별 수정한다.
 *
 * 값을 보냈다면 등록과 **같은 규칙**으로 검사한다 — 빈 문자열이나 공백만 있는
 * 값으로 덮어쓰는 것을 막기 위해서다. 따라서 이 API로 `singer`를 NULL로
 * 되돌릴 수는 없다(의도된 한계).
 *
 * 둘 다 생략된 본문은 서비스에서 400으로 막는다 — `whitelist`는 "없는 필드"를
 * 막을 뿐 "아무 필드도 없는 본문"은 통과시키기 때문이다 (팀 수정과 동일).
 */
export class UpdateSongDto {
  @MaxLength(SONG_TITLE_MAX_LENGTH, {
    message: `곡 제목은 ${SONG_TITLE_MAX_LENGTH}자를 넘을 수 없습니다.`,
  })
  @IsString({ message: SONG_TITLE_REQUIRED_MESSAGE })
  @IsNotEmpty({ message: SONG_TITLE_REQUIRED_MESSAGE })
  @IsOptional()
  @TrimString()
  title?: string;

  @MaxLength(SINGER_MAX_LENGTH, {
    message: `가수는 ${SINGER_MAX_LENGTH}자를 넘을 수 없습니다.`,
  })
  @IsString({ message: SINGER_REQUIRED_MESSAGE })
  @IsNotEmpty({ message: SINGER_REQUIRED_MESSAGE })
  @IsOptional()
  @TrimString()
  singer?: string;
}
