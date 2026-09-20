/** YouTube Data API v3 검색 엔드포인트. 키는 URL이 아니라 헤더로 보낸다(아래 참조). */
export const YOUTUBE_SEARCH_ENDPOINT = 'https://www.googleapis.com/youtube/v3/search';

/**
 * API 키를 싣는 헤더 이름.
 *
 * 구글 문서가 쿼리 파라미터 방식(`?key=`)에 대해 *"this method includes your API key in
 * the URL, exposing your key to theft through URL scans"* 라고 명시적으로 경고한다.
 * 프론트의 실시간 폴백(`src/app/api/youtube/top-video`)은 아직 쿼리 방식이지만
 * 이번 스코프가 아니라 건드리지 않았다(7단계 점검 항목).
 *
 * 부수 효과가 하나 더 있다: 키가 URL에 없으므로 요청 URL이 에러 메시지나 로그에
 * 섞여도 키가 새지 않는다.
 */
export const YOUTUBE_API_KEY_HEADER = 'X-goog-api-key';

/** 키를 읽어 오는 환경변수 이름. 프론트의 `YOUTUBE_API_KEY`와 **다른 값**이어야 한다. */
export const YOUTUBE_BATCH_API_KEY_ENV = 'YOUTUBE_BATCH_API_KEY';

/**
 * 일일 배치 검색 상한.
 *
 * YouTube Data API는 `search.list`에 **별도 쿼터 버킷**을 두고 기본 한도가 하루 100회다
 * (문서: "The search.list and videos.insert methods have their own quota buckets",
 * "Each of these methods has a default daily limit of 100 per day").
 * 배치는 방문자 폴백과 **다른 Cloud 프로젝트**의 키를 쓰므로 버킷을 공유하지 않지만,
 * 업스트림 거절에 기대지 않고 우리 쪽에서 먼저 막는다(§13 iTunes와 같은 방침).
 * 100의 80%를 상한으로 두어 수동 재시도·검증용 여유를 남긴다.
 *
 * 리셋은 **태평양 시간 자정**이다 (문서: "Daily quotas reset at midnight Pacific Time (PT)").
 */
export const YOUTUBE_DAILY_SEARCH_LIMIT = 80;

/** 일일 사용량을 세는 기준 시간대. 위 리셋 시각과 맞춘다. */
export const YOUTUBE_QUOTA_TIME_ZONE = 'America/Los_Angeles';

// 분당 아웃바운드 상한은 **두지 않는다.**
//
// 확인된 할당량이 `Search Queries per day = 100`, `per minute = 100`이다.
// 우리는 하루 총합을 80으로 막으므로 **하루치를 전부 1분 안에 쏟아부어도 100/분을 넘지 못한다.**
// 분당 상한은 수학적으로 발동할 수 없는 장치라 넣지 않았다 — iTunes(분당 20 제한,
// 일일 상한 없음)와 상황이 반대다.

/** 검색 1회에 요청하는 결과 수. 프론트 폴백과 동일하게 맞춘다(특성 테스트의 전제). */
export const YOUTUBE_SEARCH_MAX_RESULTS = 10;

/** 저장할 후보 수. 관리자가 한눈에 비교할 수 있는 수이고 30일 정리 부담도 작다. */
export const YOUTUBE_CANDIDATE_LIMIT = 3;

/** 검색 응답 대기 상한. 프론트 폴백에는 타임아웃이 없지만 배치는 곡 수만큼 반복되므로 건다. */
export const YOUTUBE_SEARCH_TIMEOUT_MS = 5_000;

/** 한 요청이 처리하는 곡 수의 기본값과 상한. 곡당 최악 5초라 10곡이면 최악 50초다. */
export const YOUTUBE_BATCH_DEFAULT_LIMIT = 5;
export const YOUTUBE_BATCH_MAX_LIMIT = 10;

/**
 * 예약(`reserved`) 행이 이 시간을 넘기면 크래시 잔재로 보고 `failed`로 정리한다.
 * 타임아웃 5초의 120배 여유. 정리된 행은 `completedAt`이 NULL이라 곡별 연속 실패수에
 * 들어가지 않는다(`youtube-attempt.ts`의 판정 규칙 참조).
 */
export const YOUTUBE_RESERVATION_STALE_MINUTES = 10;

/**
 * 후보 보관 상한(일).
 *
 * ⚠️ **해석 주의**: YouTube 개발자 정책이 비인증 데이터를 *"not longer than 30 calendar days"*
 * 보관하도록 하고 이후 *"must either delete or refresh"* 를 요구한다. 이 조항이 검색 결과
 * 메타데이터에 적용된다는 것은 **구현자의 해석이며 법적 확인을 받지 않았다.**
 */
export const YOUTUBE_RETENTION_DAYS = 30;

/** 곡별 연속 실패 상한. 넘으면 배치 대상에서 빠지고 재큐로만 복귀한다. */
export const YOUTUBE_MAX_CONSECUTIVE_FAILURES = 3;

/** 배치 도중 연속으로 이만큼 실패하면 중단한다. 남은 곡의 쿼터를 지키기 위해서다. */
export const YOUTUBE_BATCH_ABORT_AFTER_CONSECUTIVE_ERRORS = 3;

/**
 * 저장을 허용하는 썸네일 호스트.
 *
 * 공식 문서의 `search` 리소스 스키마에는 `snippet.thumbnails.{default,medium,high}.url`이
 * 있을 뿐 예시 URL의 호스트가 나오지 않아, 게이트 2 캘리브레이션(2026-09-20, 실제 호출 5회 ·
 * 응답 150건)에서 실측했다. **관측된 호스트는 `i.ytimg.com` 하나뿐이다**
 * (`/vi/<id>/default.jpg`·`mqdefault.jpg`·`hqdefault.jpg`, 전부 https).
 *
 * **관측한 호스트만 허용한다.** 처음에는 널리 쓰이는 호스트라며 `img.youtube.com`도 추측으로
 * 넣었지만 한 번도 관측되지 않아 제거했다. 다른 호스트가 실제로 나타나면 그 호스트를 관측한 뒤에
 * 추가한다(추측으로 넓히지 않는다).
 *
 * 값을 바꿀 때는 이 상수와 `next.config.ts`의 `images.remotePatterns`를 **함께** 고친다
 * (§13에서 앨범 커버 allowlist를 remotePatterns와 같은 값으로 묶은 것과 같은 이유).
 * 지금 `remotePatterns`에는 `i.ytimg.com`이 없어 관리자 UI에서 `next/image`로 썸네일을 띄우려면
 * 추가가 필요하다(7단계).
 */
export const YOUTUBE_THUMBNAIL_ALLOWED_HOSTS: readonly string[] = ['i.ytimg.com'];

/**
 * 외부에서 온 문자열의 길이 상한.
 *
 * 상한을 넘으면 **자르지 않고 그 후보를 건너뛴다.** 잘린 제목은 관리자가 잘못 판단할
 * 근거가 되기 때문이다. 유튜브 제목은 실제로 100자 제한이라 300은 충분한 여유다.
 */
export const YOUTUBE_TITLE_MAX_LENGTH = 300;
export const YOUTUBE_CHANNEL_TITLE_MAX_LENGTH = 200;
export const YOUTUBE_THUMBNAIL_URL_MAX_LENGTH = 512;

/** 반려 사유 길이 상한. 관리자 입력이라 외부 문자열과 달리 신뢰할 수 있다. */
export const YOUTUBE_REJECT_REASON_MAX_LENGTH = 200;

/** 목록 조회 페이징. */
export const YOUTUBE_LIST_DEFAULT_LIMIT = 20;
export const YOUTUBE_LIST_MAX_LIMIT = 50;

// ── 사용자에게 나가는 메시지 ────────────────────────────────────────────────

export const YOUTUBE_BATCH_ALREADY_RUNNING_MESSAGE =
  '배치 추천 검색이 이미 실행 중입니다. 끝난 뒤에 다시 시도해 주세요.';
export const YOUTUBE_QUOTA_EXHAUSTED_MESSAGE =
  '오늘 사용할 수 있는 유튜브 검색 횟수를 모두 썼습니다. 태평양 시간 자정에 초기화됩니다.';
export const YOUTUBE_API_KEY_MESSAGE =
  '유튜브 API 키 설정에 문제가 있어 검색할 수 없습니다. 서버 설정을 확인해 주세요.';
export const YOUTUBE_ATTEMPT_NOT_FOUND_MESSAGE = '해당 추천 기록을 찾을 수 없습니다.';
export const YOUTUBE_ATTEMPT_NOT_OPEN_MESSAGE =
  '이미 처리된 추천입니다. 목록을 새로 고친 뒤 다시 확인해 주세요.';
export const YOUTUBE_SONG_ALREADY_LINKED_MESSAGE =
  '그 사이 이 곡에 유튜브 링크가 지정됐습니다. 목록을 새로 고친 뒤 다시 확인해 주세요.';
export const YOUTUBE_CANDIDATE_NOT_FOUND_MESSAGE =
  '선택한 영상이 이 추천의 후보 목록에 없습니다.';
export const YOUTUBE_REQUEUE_NOT_ALLOWED_MESSAGE =
  '재검색 대기로 되돌릴 수 있는 곡은 반려됐거나 검색 결과가 없었던 곡뿐입니다.';
