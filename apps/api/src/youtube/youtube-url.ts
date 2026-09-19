import { BadRequestException } from '@nestjs/common';
import {
  YOUTUBE_ALLOWED_HOSTS,
  YOUTUBE_URL_MAX_LENGTH,
  YOUTUBE_URL_REJECTION_MESSAGES,
  YOUTUBE_VIDEO_ID_PATTERN,
  YOUTUBE_VIDEO_PATH_PREFIXES,
  type YoutubeUrlRejection,
} from './youtube.constants.js';

/**
 * 검사 결과. 통과하면 **저장할 값**까지 함께 돌려준다 —
 * 호출자가 입력 문자열을 그대로 쓰지 못하게 하려는 의도다.
 */
export type YoutubeUrlCheck =
  | { ok: true; url: string; videoId: string }
  | { ok: false; reason: YoutubeUrlRejection };

const fail = (reason: YoutubeUrlRejection): YoutubeUrlCheck => ({
  ok: false,
  reason,
});

/**
 * 유튜브 영상 URL 검증 + 정규화 (PRD F013).
 *
 * **저장 형식은 `https://www.youtube.com/watch?v=<11자>` 하나다.** 입력이
 * `youtu.be`든 `/shorts/`든 전부 이 형태로 바꿔 저장한다. 프론트와의 계약이기 때문이다 —
 * `src/lib/open-track-video.ts`가 저장값을 `new URL(...)`에 **try/catch 없이** 넣고
 * `autoplay=1`을 붙여 새 탭으로 연다. 파싱만 되면 되는 게 아니라 "재생 페이지"여야 한다.
 * 기존 5건도 전부 이 형식이고 길이가 43자로 같다.
 *
 * 재생목록(`list`)·타임스탬프(`t`)·추적 파라미터(`si`, `pp`, `feature`, `utm_*`)는
 * 전부 버린다. `list`를 남기면 클릭 시 영상이 아니라 재생목록이 열려, 관리자가 확인한
 * 영상과 방문자가 보는 영상이 갈린다.
 *
 * 사유를 코드로 돌려주는 함수와 예외를 던지는 함수를 나눈 이유는 `YOUTUBE_URL_REJECTION_MESSAGES`
 * 주석 참조 — 사유별로 다른 안내가 나가야 하고, 단위 테스트가 문구가 아니라 사유를 고정해야 한다.
 */
export function checkYoutubeUrl(value: string): YoutubeUrlCheck {
  if (value.length > YOUTUBE_URL_MAX_LENGTH) {
    return fail('TOO_LONG');
  }

  const url = parseUrl(value);
  if (!url) {
    // 스킴만 빠진 것인지(흔한 실수) 애초에 주소가 아닌지 구분해서 안내한다.
    return fail(looksLikeYoutubeWithoutScheme(value) ? 'NO_SCHEME' : 'MALFORMED');
  }

  if (url.protocol === 'http:') {
    return fail('INSECURE_SCHEME');
  }
  if (url.protocol !== 'https:') {
    // javascript:, data: 등. 스킴 누락과 달리 고쳐 쓸 여지가 없다.
    return fail('MALFORMED');
  }

  // `https://youtube.com@evil.example/watch?v=...`는 hostname이 evil.example이라
  // 아래 allowlist에서 이미 걸린다. 사용자 정보·포트를 따로 막는 것은 allowlist를
  // 통과한 호스트에 붙은 경우(`https://someone@www.youtube.com/...`)를 위해서다.
  if (url.username !== '' || url.password !== '' || url.port !== '') {
    return fail('NOT_YOUTUBE');
  }

  if (!YOUTUBE_ALLOWED_HOSTS.includes(url.hostname)) {
    return fail('NOT_YOUTUBE');
  }

  const extracted = extractVideoId(url);
  if (!extracted.ok) {
    return extracted;
  }

  if (!YOUTUBE_VIDEO_ID_PATTERN.test(extracted.videoId)) {
    return fail('INVALID_VIDEO_ID');
  }

  return {
    ok: true,
    videoId: extracted.videoId,
    url: `https://www.youtube.com/watch?v=${extracted.videoId}`,
  };
}

/** 검증 실패 시 400. 사유에 맞는 안내 문구를 그대로 내보낸다. */
export function normalizeYoutubeUrl(value: string): string {
  const checked = checkYoutubeUrl(value);
  if (!checked.ok) {
    throw new BadRequestException(YOUTUBE_URL_REJECTION_MESSAGES[checked.reason]);
  }

  return checked.url;
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/**
 * `www.youtube.com/watch?v=...`처럼 스킴만 빠진 입력인지 본다.
 *
 * `https://`를 붙여 파싱한 뒤 호스트가 allowlist에 있을 때만 참이다. 아무 문자열에나
 * 스킴을 붙이면 `new URL("https://아무말")`이 성공해 버리므로 호스트까지 확인해야 한다.
 */
function looksLikeYoutubeWithoutScheme(value: string): boolean {
  const url = parseUrl(`https://${value}`);

  return url !== null && YOUTUBE_ALLOWED_HOSTS.includes(url.hostname);
}

type ExtractResult = { ok: true; videoId: string } | { ok: false; reason: YoutubeUrlRejection };

/** 호스트·경로 형태별로 영상 ID를 뽑는다. 형식 검사는 호출자가 한다. */
function extractVideoId(url: URL): ExtractResult {
  const segments = url.pathname.split('/').filter((segment) => segment !== '');

  // 단축 주소: `youtu.be/<id>`. `?si=...`(공유 추적 파라미터)가 붙어 오는 게 기본이다.
  if (url.hostname === 'youtu.be') {
    if (segments.length !== 1) {
      return { ok: false, reason: 'NOT_A_VIDEO' };
    }
    return { ok: true, videoId: segments[0] };
  }

  if (segments.length === 1 && segments[0] === 'watch') {
    // `?v=a&v=b`는 유튜브가 첫 값을 쓰지만 우리는 거부한다. 어느 쪽을 의도했는지
    // 서버가 고를 근거가 없고, 조용히 하나를 고르면 관리자가 확인한 영상과 달라질 수 있다.
    const ids = url.searchParams.getAll('v');
    if (ids.length > 1) {
      return { ok: false, reason: 'DUPLICATE_VIDEO_ID' };
    }
    if (ids.length === 0) {
      // `/watch?list=...`는 재생목록 첫 영상으로 열리는 주소다. 영상 ID가 없어서
      // 저장 형식으로 바꿀 수 없다.
      return {
        ok: false,
        reason: url.searchParams.has('list') ? 'PLAYLIST' : 'INVALID_VIDEO_ID',
      };
    }
    return { ok: true, videoId: ids[0] };
  }

  if (segments.length === 1 && segments[0] === 'playlist') {
    return { ok: false, reason: 'PLAYLIST' };
  }

  if (segments.length === 2 && YOUTUBE_VIDEO_PATH_PREFIXES.includes(segments[0])) {
    return { ok: true, videoId: segments[1] };
  }

  // `/@handle`, `/channel/...`, `/results?search_query=...`, 루트 등
  return { ok: false, reason: 'NOT_A_VIDEO' };
}
