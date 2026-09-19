/**
 * 곡 제목 길이 상한.
 *
 * DB 컬럼은 `text`라 길이 제한이 없다. 실제 64행의 최댓값은 24자이지만,
 * 여유를 크게 두되 비정상적으로 긴 본문은 DB에 닿기 전에 막는 것이 목적이다.
 */
export const SONG_TITLE_MAX_LENGTH = 200;
export const SONG_TITLE_REQUIRED_MESSAGE = '곡 제목을 입력해 주세요.';

/** 가수 길이 상한. 실제 64행의 최댓값은 21자다. */
export const SINGER_MAX_LENGTH = 100;

/**
 * 가수는 등록 시 필수다.
 *
 * DB 컬럼은 nullable이지만 실제 64행은 전부 값이 채워져 있고, 비어 있으면
 * 공개 프론트가 `"SUMMIT Band"`로 대체 표시해 잘못된 정보가 노출된다
 * (`src/app/setlist/page.tsx`). F010(앨범 커버 자동 매칭)도 제목+가수를 함께 쓴다.
 */
export const SINGER_REQUIRED_MESSAGE = '가수를 입력해 주세요.';

export const SONG_NOT_FOUND_MESSAGE = '해당 곡을 찾을 수 없습니다.';

/**
 * PK 충돌(P2002) 시 내보내는 메시지.
 *
 * 같은 409라도 "곡 중복"(입력 문제)과 원인이 완전히 다르므로 입력 오류로
 * 읽히지 않게 쓴다 (§11 팀 등록과 같은 방침).
 */
export const SONG_ID_CONFLICT_MESSAGE =
  '서버 측 id 발급이 충돌해 곡을 등록하지 못했습니다. 입력값 문제가 아니며, id 시퀀스 재동기화가 필요할 수 있습니다.';
