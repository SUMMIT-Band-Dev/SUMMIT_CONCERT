/**
 * 공연일자 형식.
 *
 * 실제 데이터는 `"day1"`(7팀) / `"day2"`(8팀) 두 값뿐이고, 공개 프론트도
 * 이 문자열을 그대로 비교한다(`src/app/setlist/page.tsx`). 형식을 열어 두면
 * 관리자가 "1일차" 같은 값을 넣는 순간 공개 페이지에서 해당 팀이 사라지므로
 * API 단에서 막는다.
 */
export const DAY_PATTERN = /^day[1-9]\d*$/;

export const DAY_FORMAT_MESSAGE = '공연일자는 day1, day2 형식으로 입력해 주세요.';
export const DAY_REQUIRED_MESSAGE = '공연일자를 입력해 주세요.';

/** `"day"` + 숫자 7자리. 정규식만으로는 길이가 무한이라 상한을 따로 둔다. */
export const DAY_MAX_LENGTH = 10;

export const TEAM_NAME_MAX_LENGTH = 100;
export const TEAM_NAME_REQUIRED_MESSAGE = '팀명을 입력해 주세요.';

/** `performanceOrder`는 int2(smallint)다. 이 값을 넘기면 Postgres가 범위 초과로 실패한다. */
export const PERFORMANCE_ORDER_MAX = 32767;

/** 한 번에 재정렬할 수 있는 팀 수 상한. 현재 최대 8팀/일자라 여유 있게 잡았다. */
export const REORDER_MAX_TEAMS = 100;

export const TEAM_NOT_FOUND_MESSAGE = '해당 팀을 찾을 수 없습니다.';
