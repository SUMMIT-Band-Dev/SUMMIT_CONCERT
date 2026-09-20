import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TrimString } from '../../common/trim.transform.js';
import { YOUTUBE_VIDEO_ID_PATTERN } from '../youtube.constants.js';
import {
  YOUTUBE_LIST_DEFAULT_LIMIT,
  YOUTUBE_LIST_MAX_LIMIT,
  YOUTUBE_REJECT_REASON_MAX_LENGTH,
} from '../youtube-search.constants.js';

/**
 * 추천 승인 (PRD F012).
 *
 * 등수(`rank`)가 아니라 **영상 ID**로 지목한다. 관리자가 화면에서 본 것은 영상이지 등수가
 * 아니고, 목록을 새로 고치는 사이에 등수가 가리키는 대상이 달라질 여지를 없애기 위해서다.
 * 서버는 이 ID가 그 시도의 후보 목록에 실제로 있는지 확인한 뒤에만 저장한다.
 *
 * 형식 검사를 여기서도 하는 이유는 DB 조회를 아끼기 위해서다. 저장 직전에 `isStorableVideoId`가
 * 예약어까지 포함해 다시 본다 — 여기서 통과해도 그쪽이 최종 관문이다.
 */
export class ApproveRecommendationDto {
  @Matches(YOUTUBE_VIDEO_ID_PATTERN, {
    message: '영상 ID 형식이 올바르지 않습니다. 영상 ID는 11자(영문·숫자·-·_)여야 합니다.',
  })
  @IsString({ message: '승인할 영상 ID를 입력해 주세요.' })
  @IsNotEmpty({ message: '승인할 영상 ID를 입력해 주세요.' })
  @TrimString()
  videoId: string;
}

/**
 * 추천 반려 (PRD F012).
 *
 * 사유는 선택 입력이다. 저장하는 이유는 나중에 재큐할지 판단할 때 "왜 반려했는가"가
 * 유일한 근거이기 때문이다. 관리자 자신의 입력이라 외부 문자열과 달리 신뢰할 수 있다.
 */
export class RejectRecommendationDto {
  // 데코레이터는 아래에서 위로 적용되므로 `stopAtFirstError` 아래에서는 "비어 있음"이
  // 맨 먼저 보여야 한다 — 팀/곡/앨범 커버/F013 DTO와 같은 컨벤션이다.
  @MaxLength(YOUTUBE_REJECT_REASON_MAX_LENGTH, {
    message: `반려 사유는 ${YOUTUBE_REJECT_REASON_MAX_LENGTH}자를 넘을 수 없습니다.`,
  })
  @IsString({ message: '반려 사유는 문자열이어야 합니다.' })
  @IsNotEmpty({ message: '반려 사유를 비워 두려면 항목 자체를 보내지 마세요.' })
  @IsOptional()
  @TrimString()
  reason?: string;
}

/** 목록 조회 필터. 기본값은 리뷰 대기(`open`)다 — 관리자가 실제로 할 일이 있는 상태. */
export const RECOMMENDATION_LIST_STATES = [
  'open',
  'approved',
  'rejected',
  'superseded',
  'expired',
  'closed',
] as const;

export type RecommendationListState = (typeof RECOMMENDATION_LIST_STATES)[number];

export class ListRecommendationsQuery {
  @IsIn(RECOMMENDATION_LIST_STATES, {
    message: `조회 상태는 ${RECOMMENDATION_LIST_STATES.join(', ')} 중 하나여야 합니다.`,
  })
  @IsOptional()
  @TrimString()
  state: RecommendationListState = 'open';

  @Max(YOUTUBE_LIST_MAX_LIMIT, {
    message: `한 번에 조회할 수 있는 항목은 최대 ${YOUTUBE_LIST_MAX_LIMIT}개입니다.`,
  })
  @Min(1, { message: '조회 개수는 1 이상이어야 합니다.' })
  @IsInt({ message: '조회 개수는 정수여야 합니다.' })
  @IsOptional()
  @Type(() => Number)
  limit: number = YOUTUBE_LIST_DEFAULT_LIMIT;

  /** 이전 페이지의 `nextCursor`. 형식 검사는 `parseBigIntId`가 한다. */
  @Matches(/^\d{1,19}$/, { message: '커서 형식이 올바르지 않습니다.' })
  @IsOptional()
  @TrimString()
  cursor?: string;
}
