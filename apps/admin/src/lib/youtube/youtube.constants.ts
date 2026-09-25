// 유튜브 연결 관리 화면 상수. 서버(apps/api/src/youtube/youtube-search.constants.ts,
// apps/api/src/youtube/youtube.constants.ts)와 같은 값이어야 한다 — 규칙이 어긋나면
// "화면은 통과시켰는데 서버가 400/타임아웃"이 되므로, 서버 상수를 바꾸면 이 파일도 함께 바꾼다
// (곡 쪽 song-schema.ts·앨범 커버 쪽 album-cover-url.ts와 같은 방침).

/** 배치 1회 처리 곡 수의 기본값과 상한. 곡당 최악 5초라 10곡이면 최악 50초다 */
export const YOUTUBE_BATCH_DEFAULT_LIMIT = 5;
export const YOUTUBE_BATCH_MAX_LIMIT = 10;

/**
 * 배치 요청 타임아웃(ms). 곡당 최악 5초 × 최대 10곡 = 50초에 여유를 더한다.
 * `apiRequest`의 기본 15초로는 부족하므로 배치 호출에서만 이 값을 넘긴다(client.ts 주석 참조).
 */
export const YOUTUBE_BATCH_TIMEOUT_MS = 60_000;

/** 반려 사유 길이 상한. 미러링: youtube-search.constants.ts `YOUTUBE_REJECT_REASON_MAX_LENGTH` */
export const YOUTUBE_REJECT_REASON_MAX_LENGTH = 200;

/** 추천 목록 조회 페이지 크기. 서버 상한(50)과 같은 값으로 고정해 "더 보기" 클릭 수를 줄인다 */
export const YOUTUBE_LIST_PAGE_SIZE = 50;

/**
 * 저장을 허용하는 썸네일 호스트. 미러링: apps/api/src/youtube/youtube-search.constants.ts
 * `YOUTUBE_THUMBNAIL_ALLOWED_HOSTS` — 서버가 이 호스트로만 썸네일을 저장하므로 CSP img-src도
 * 정확히 같은 값으로 고정한다(환경변수로 빼지 않는 이유는 csp.ts의 `ALBUM_COVER_IMAGE_ORIGIN`과 동일).
 */
export const YOUTUBE_THUMBNAIL_HOST = "i.ytimg.com";
