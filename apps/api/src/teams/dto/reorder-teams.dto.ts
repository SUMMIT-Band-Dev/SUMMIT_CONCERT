import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
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
  REORDER_MAX_TEAMS,
} from '../teams.constants.js';

/**
 * 공연 순서 일괄 재정렬 요청 (PRD F006).
 *
 * `teamIds`는 **해당 일자 전체 팀 id의 순서 배열**이고, 서버가 배열 인덱스로
 * 1..N을 부여한다. 클라이언트가 순서 숫자를 직접 계산해 보내는 형식
 * (`{ id, performanceOrder }[]`)을 쓰지 않은 이유는, 어차피 중복·누락을 서버가
 * 전부 재검증해야 해서 검증 코드는 똑같은데 잘못된 숫자가 들어올 여지만 늘기 때문이다.
 *
 * id를 number가 아니라 문자열로 받는 이유는 응답에서 id를 문자열로 내보내기
 * 때문이다(int8 → JSON 안전). 받는 형식과 주는 형식을 일치시킨다.
 */
export class ReorderTeamsDto {
  @Matches(DAY_PATTERN, { message: DAY_FORMAT_MESSAGE })
  @MaxLength(DAY_MAX_LENGTH, { message: DAY_FORMAT_MESSAGE })
  @IsString({ message: DAY_REQUIRED_MESSAGE })
  @IsNotEmpty({ message: DAY_REQUIRED_MESSAGE })
  @TrimString()
  day: string;

  // 값 자체의 유효성(범위·중복·집합 일치)은 서비스에서 확인한다.
  // 여기서는 "문자열 숫자의 배열"이라는 모양만 본다.
  @Matches(/^\d+$/, { each: true, message: '팀 id는 숫자 문자열이어야 합니다.' })
  @IsString({ each: true, message: '팀 id는 숫자 문자열이어야 합니다.' })
  @ArrayMaxSize(REORDER_MAX_TEAMS, {
    message: `한 번에 재정렬할 수 있는 팀은 ${REORDER_MAX_TEAMS}개까지입니다.`,
  })
  @ArrayNotEmpty({ message: '재정렬할 팀을 지정해 주세요.' })
  @IsArray({ message: '재정렬할 팀 목록이 올바르지 않습니다.' })
  teamIds: string[];
}
