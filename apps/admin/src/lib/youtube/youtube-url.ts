// 유튜브 URL 검증 (PRD F013). 서버(apps/api/src/youtube/youtube-url.ts, youtube.constants.ts)와
// **같은 판정**을 한다.
//
// 서버는 사유별로 문구를 나눠 주지만(YOUTUBE_URL_REJECTION_MESSAGES), 화면이 제출 전에
// 같은 판정을 미리 해 두면 "제출 → 400 → 문구 확인"의 왕복 없이 바로 안내할 수 있다.
// ⚠️ 보안 경계가 아니라 안내용이다. 실제 판정은 서버가 다시 한다(album-cover-url.ts와 같은 방침).

export const YOUTUBE_ALLOWED_HOSTS: readonly string[] = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
];

export const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/** 형식은 맞지만 영상이 아닌 예약어. 미러링: apps/api/src/youtube/youtube.constants.ts */
const YOUTUBE_RESERVED_VIDEO_IDS: ReadonlyMap<string, string> = new Map([
  ["videoseries", "재생목록 주소는 저장할 수 없습니다. 재생목록이 아니라 영상 하나의 주소를 입력해 주세요."],
  ["live_stream", "영상 주소가 아닙니다. 채널이나 검색 결과가 아닌 영상 주소를 입력해 주세요."],
]);

export const YOUTUBE_VIDEO_PATH_PREFIXES: readonly string[] = ["shorts", "embed", "live"];

export const YOUTUBE_URL_MAX_LENGTH = 512;

/**
 * 거부 사유를 한국어로 돌려준다(통과하면 null). 서버 `checkYoutubeUrl`과 판정 순서·기준이 같다.
 * 문구에 입력값을 끼워 넣지 않는다 — 그대로 화면에 반사되는 값이 되기 때문이다(서버와 동일 방침).
 */
export function checkYoutubeUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw) return "유튜브 영상 주소를 입력해 주세요.";

  if (raw.length > YOUTUBE_URL_MAX_LENGTH) {
    return `유튜브 영상 주소는 ${YOUTUBE_URL_MAX_LENGTH}자를 넘을 수 없습니다.`;
  }

  const url = parseUrl(raw);
  if (!url) {
    return looksLikeYoutubeWithoutScheme(raw)
      ? "주소가 https:// 로 시작해야 합니다. 유튜브에서 복사한 주소를 그대로 붙여 넣어 주세요."
      : "주소 형식이 올바르지 않습니다. 유튜브 영상 주소를 다시 확인해 주세요.";
  }

  if (url.protocol === "http:") {
    return "http 주소는 저장할 수 없습니다. https:// 로 시작하는 주소를 입력해 주세요.";
  }
  if (url.protocol !== "https:") {
    return "주소 형식이 올바르지 않습니다. 유튜브 영상 주소를 다시 확인해 주세요.";
  }
  if (url.username !== "" || url.password !== "" || url.port !== "") {
    return "유튜브 주소가 아닙니다. youtube.com 또는 youtu.be 주소만 저장할 수 있습니다.";
  }
  if (!YOUTUBE_ALLOWED_HOSTS.includes(url.hostname)) {
    return "유튜브 주소가 아닙니다. youtube.com 또는 youtu.be 주소만 저장할 수 있습니다.";
  }

  const extracted = extractVideoId(url);
  if (!extracted.ok) {
    return extracted.reason;
  }
  if (!YOUTUBE_VIDEO_ID_PATTERN.test(extracted.videoId)) {
    return "영상 ID 형식이 올바르지 않습니다. 영상 ID는 11자(영문·숫자·-·_)여야 합니다.";
  }

  const reserved = YOUTUBE_RESERVED_VIDEO_IDS.get(extracted.videoId);
  if (reserved) return reserved;

  return null;
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function looksLikeYoutubeWithoutScheme(value: string): boolean {
  const url = parseUrl(`https://${value}`);
  return url !== null && YOUTUBE_ALLOWED_HOSTS.includes(url.hostname);
}

type ExtractResult = { ok: true; videoId: string } | { ok: false; reason: string };

function extractVideoId(url: URL): ExtractResult {
  const segments = url.pathname.split("/").filter((segment) => segment !== "");

  if (url.hostname === "youtu.be") {
    if (segments.length !== 1) {
      return { ok: false, reason: "영상 주소가 아닙니다. 채널이나 검색 결과가 아닌 영상 주소를 입력해 주세요." };
    }
    return { ok: true, videoId: segments[0] };
  }

  if (segments.length === 1 && segments[0] === "watch") {
    const ids = url.searchParams.getAll("v");
    if (ids.length > 1) {
      return { ok: false, reason: "영상 ID가 여러 개 들어 있습니다. 영상 하나의 주소를 입력해 주세요." };
    }
    if (ids.length === 0) {
      return {
        ok: false,
        reason: url.searchParams.has("list")
          ? "재생목록 주소는 저장할 수 없습니다. 재생목록이 아니라 영상 하나의 주소를 입력해 주세요."
          : "영상 ID 형식이 올바르지 않습니다. 영상 ID는 11자(영문·숫자·-·_)여야 합니다.",
      };
    }
    return { ok: true, videoId: ids[0] };
  }

  if (segments.length === 1 && segments[0] === "playlist") {
    return { ok: false, reason: "재생목록 주소는 저장할 수 없습니다. 재생목록이 아니라 영상 하나의 주소를 입력해 주세요." };
  }

  if (segments.length === 2 && YOUTUBE_VIDEO_PATH_PREFIXES.includes(segments[0])) {
    return { ok: true, videoId: segments[1] };
  }

  return { ok: false, reason: "영상 주소가 아닙니다. 채널이나 검색 결과가 아닌 영상 주소를 입력해 주세요." };
}
