import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { TrimString } from '../../common/trim.transform.js';
import {
  DAY_FORMAT_MESSAGE,
  DAY_MAX_LENGTH,
  DAY_PATTERN,
  DAY_REQUIRED_MESSAGE,
  TEAM_NAME_MAX_LENGTH,
  TEAM_NAME_REQUIRED_MESSAGE,
} from '../teams.constants.js';

/**
 * 팀 정보 수정 요청 (PRD F005). 팀명과 공연일자만 개별 수정한다.
 *
 * `performanceOrder`는 여기에 없다 — 순서 변경은 재정렬 엔드포인트 전용이고,
 * 클라이언트가 보내면 `forbidNonWhitelisted`에 걸려 400이 된다.
 * 다만 `day`가 실제로 바뀌는 경우에는 **서버가** 순서를 대상 일자의 맨 뒤로
 * 재배치한다 (이유는 `TeamsService.update` 주석 참조).
 *
 * 둘 다 생략된 본문은 서비스에서 400으로 막는다 — `whitelist`는 "없는 필드"를
 * 막을 뿐 "아무 필드도 없는 본문"은 통과시키기 때문이다.
 */
export class UpdateTeamDto {
  @MaxLength(TEAM_NAME_MAX_LENGTH, {
    message: `팀명은 ${TEAM_NAME_MAX_LENGTH}자를 넘을 수 없습니다.`,
  })
  @IsString({ message: TEAM_NAME_REQUIRED_MESSAGE })
  @IsNotEmpty({ message: TEAM_NAME_REQUIRED_MESSAGE })
  @IsOptional()
  @TrimString()
  teamName?: string;

  @Matches(DAY_PATTERN, { message: DAY_FORMAT_MESSAGE })
  @MaxLength(DAY_MAX_LENGTH, { message: DAY_FORMAT_MESSAGE })
  @IsString({ message: DAY_REQUIRED_MESSAGE })
  @IsNotEmpty({ message: DAY_REQUIRED_MESSAGE })
  @IsOptional()
  @TrimString()
  day?: string;
}
