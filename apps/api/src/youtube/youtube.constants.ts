/**
 * 저장을 허용하는 유튜브 호스트.
 *
 * `URL`이 hostname을 소문자로 정규화해 주므로 대문자 입력은 여기서 자동으로 맞춰진다.
 * 부분일치가 아니라 **정확히 일치**만 허용한다 — `youtube.com.evil.example`처럼
 * 접미사로 흉내 낸 호스트를 통과시키지 않기 위해서다.
 *
 * `youtube-nocookie.com`은 넣지 않았다. 실제 데이터에 없고, 필요해지면 그때 넓힌다.
 */
export const YOUTUBE_ALLOWED_HOSTS: readonly string[] = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
];

/**
 * 영상 ID 형식. 유튜브 영상 ID는 11자이며 base64url 문자 집합을 쓴다.
 *
 * 기존 5건(`REAL_URLS`)이 전부 이 형태이고, 실시간 폴백(`src/app/api/youtube/top-video`)이
 * 만들어 내는 `watch?v=${videoId}`도 같다.
 */
export const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/**
 * 경로 하나로 영상 ID를 지목하는 형태들. `/shorts/<id>`처럼 두 조각이어야 한다.
 *
 * `/live/`를 포함한 이유는 공연 영상이 라이브 아카이브로 올라오는 일이 잦아서다.
 * 셋 다 `watch?v=<id>`와 같은 영상을 가리키므로 저장 형식으로 정규화된다.
 */
export const YOUTUBE_VIDEO_PATH_PREFIXES: readonly string[] = [
  'shorts',
  'embed',
  'live',
];

/**
 * 입력 URL 길이 상한.
 *
 * 저장되는 값은 항상 43자(`https://www.youtube.com/watch?v=<11자>`)지만, 입력은
 * 재생목록·타임스탬프·추적 파라미터가 붙은 긴 주소로 들어온다. 512자면 그런 주소를
 * 받아들이기에 충분하고, 비정상적으로 긴 본문은 파싱 전에 막는다.
 */
export const YOUTUBE_URL_MAX_LENGTH = 512;

export const YOUTUBE_URL_REQUIRED_MESSAGE = '유튜브 영상 주소를 입력해 주세요.';
export const YOUTUBE_URL_TOO_LONG_MESSAGE = `유튜브 영상 주소는 ${YOUTUBE_URL_MAX_LENGTH}자를 넘을 수 없습니다.`;

/** 거부 사유. 사유별로 다른 안내가 나가야 해서 코드로 구분한다. */
export type YoutubeUrlRejection =
  | 'TOO_LONG'
  | 'NO_SCHEME'
  | 'INSECURE_SCHEME'
  | 'MALFORMED'
  | 'NOT_YOUTUBE'
  | 'PLAYLIST'
  | 'NOT_A_VIDEO'
  | 'DUPLICATE_VIDEO_ID'
  | 'INVALID_VIDEO_ID';

/**
 * 거부 사유별 안내 문구. **7단계 관리자 UI가 그대로 띄우는 문장이다.**
 *
 * 앨범 커버(F010)는 공통 문구 하나로 내보냈는데 여기서는 사유를 나눈다. 두 기능의
 * 입력 경로가 다르기 때문이다 — 앨범 커버는 후보 목록에서 받은 값을 되돌려 보내는 게
 * 정상 흐름이라 거부가 곧 비정상이지만, 유튜브 URL은 **사람이 브라우저에서 복사해
 * 붙여 넣는 것이 정상 흐름**이라 재생목록 주소나 http 주소가 일상적으로 들어온다.
 * "허용되지 않은 주소입니다"만 돌려주면 관리자가 무엇을 고쳐야 할지 알 수 없다.
 *
 * 문구에 **입력값을 끼워 넣지 않는다** — 그대로 화면에 반사되는 값이 되기 때문이다.
 */
export const YOUTUBE_URL_REJECTION_MESSAGES: Record<YoutubeUrlRejection, string> = {
  TOO_LONG: YOUTUBE_URL_TOO_LONG_MESSAGE,
  NO_SCHEME:
    '주소가 https:// 로 시작해야 합니다. 유튜브에서 복사한 주소를 그대로 붙여 넣어 주세요.',
  INSECURE_SCHEME:
    'http 주소는 저장할 수 없습니다. https:// 로 시작하는 주소를 입력해 주세요.',
  MALFORMED: '주소 형식이 올바르지 않습니다. 유튜브 영상 주소를 다시 확인해 주세요.',
  NOT_YOUTUBE:
    '유튜브 주소가 아닙니다. youtube.com 또는 youtu.be 주소만 저장할 수 있습니다.',
  PLAYLIST:
    '재생목록 주소는 저장할 수 없습니다. 재생목록이 아니라 영상 하나의 주소를 입력해 주세요.',
  NOT_A_VIDEO:
    '영상 주소가 아닙니다. 채널이나 검색 결과가 아닌 영상 주소를 입력해 주세요.',
  DUPLICATE_VIDEO_ID:
    '영상 ID가 여러 개 들어 있습니다. 영상 하나의 주소를 입력해 주세요.',
  INVALID_VIDEO_ID:
    '영상 ID 형식이 올바르지 않습니다. 영상 ID는 11자(영문·숫자·-·_)여야 합니다.',
};
