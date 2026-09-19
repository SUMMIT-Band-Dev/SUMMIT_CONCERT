import {
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TrimString } from '../../common/trim.transform.js';
import {
  DAY_FORMAT_MESSAGE,
  DAY_MAX_LENGTH,
  DAY_PATTERN,
  DAY_REQUIRED_MESSAGE,
  PERFORMANCE_ORDER_MAX,
  TEAM_NAME_MAX_LENGTH,
  TEAM_NAME_REQUIRED_MESSAGE,
} from '../teams.constants.js';

/**
 * 팀 등록 요청 (PRD F004). 팀명 + 공연일자 + 공연순서를 한 세트로 받는다.
 *
 * `cardImageUrl`은 일부러 넣지 않았다. 업로드는 5단계(F007)이고, 전역
 * `ValidationPipe`의 `forbidNonWhitelisted` 덕분에 클라이언트가 보내면 400이 된다.
 *
 * 데코레이터는 아래에서 위로 적용되므로 class-validator가 보는 제약 순서는
 * 선언 순서의 역순이다. `stopAtFirstError`로 필드당 메시지가 하나만 나가기 때문에,
 * 가장 먼저 보여야 할 "비어 있음" 검사를 맨 아래에 둔다 (auth/dto/login.dto.ts와 동일).
 */
export class CreateTeamDto {
  @MaxLength(TEAM_NAME_MAX_LENGTH, {
    message: `팀명은 ${TEAM_NAME_MAX_LENGTH}자를 넘을 수 없습니다.`,
  })
  @IsString({ message: TEAM_NAME_REQUIRED_MESSAGE })
  @IsNotEmpty({ message: TEAM_NAME_REQUIRED_MESSAGE })
  @TrimString()
  teamName: string;

  @Matches(DAY_PATTERN, { message: DAY_FORMAT_MESSAGE })
  @MaxLength(DAY_MAX_LENGTH, { message: DAY_FORMAT_MESSAGE })
  @IsString({ message: DAY_REQUIRED_MESSAGE })
  @IsNotEmpty({ message: DAY_REQUIRED_MESSAGE })
  @TrimString()
  day: string;

  // 숫자 문자열("3")은 받지 않는다. 전역 ValidationPipe에 implicit conversion을
  // 켜지 않았으므로 JSON 숫자만 통과한다 — 입력 형식을 느슨하게 만들 이유가 없다.
  @Max(PERFORMANCE_ORDER_MAX, { message: '공연 순서가 너무 큽니다.' })
  @Min(1, { message: '공연 순서는 1 이상이어야 합니다.' })
  @IsInt({ message: '공연 순서는 정수로 입력해 주세요.' })
  performanceOrder: number;
}
