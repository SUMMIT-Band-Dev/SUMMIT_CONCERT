// 앨범 커버 URL 규칙. 서버(apps/api/src/album-cover/album-cover-url.ts, album-cover.constants.ts)와
// **같은 판정**을 한다.
//
// 서버는 거부 사유를 클라이언트에 알려 주지 않고 공통 메시지("허용되지 않은 앨범 커버 URL입니다")만
// 준다. 그런데 §10이 남긴 요건은 "UI는 왜 거부됐는지를 안내해야 한다"이다 — 100x100 주소나 다른
// isN-ssl 호스트를 붙여 넣었을 때 이유를 모르면 관리자가 막힌다. 그래서 같은 규칙을 여기에 두고
// **구체적인 사유를 화면에서 만들어 낸다.**
//
// ⚠️ 보안 경계가 아니라 안내용이다. 실제 판정은 서버가 다시 한다.

export const ALBUM_COVER_ALLOWED_HOST = "is1-ssl.mzstatic.com";
export const ALBUM_COVER_URL_MAX_LENGTH = 255;
/** 저장 크기. 공개 프론트의 `shrinkAlbumCoverUrl`이 이 꼬리표를 치환해 축소한다 */
export const ALBUM_COVER_ARTWORK_SIZE = "600x600bb.jpg";
const ALBUM_COVER_PATH_PATTERN = /^\/image\/thumb\/[A-Za-z0-9/._-]+\/600x600bb\.jpg$/;
const ARTWORK_SIZE_SUFFIX_PATTERN = /\/\d+x\d+bb\.jpg$/i;

/**
 * 거부 사유를 한국어로 돌려준다(통과하면 null).
 * 서버 `checkAlbumCoverUrl`과 판정 순서·기준이 같고, 문구만 관리자용으로 구체화했다.
 */
export function checkAlbumCoverUrl(value: string): string | null {
  const url = value.trim();
  if (!url) return "앨범 커버 URL을 입력해 주세요.";

  if (url.length > ALBUM_COVER_URL_MAX_LENGTH) {
    return `주소가 너무 깁니다 (${url.length}자 / 최대 ${ALBUM_COVER_URL_MAX_LENGTH}자).`;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "URL 형식이 아닙니다. https://로 시작하는 전체 주소를 붙여 넣어 주세요.";
  }

  if (parsed.protocol !== "https:") {
    return "https 주소만 사용할 수 있습니다.";
  }
  if (parsed.username !== "" || parsed.password !== "" || parsed.port !== "") {
    return "주소에 사용자 정보나 포트가 포함돼 있습니다.";
  }
  if (parsed.hostname !== ALBUM_COVER_ALLOWED_HOST) {
    return `${ALBUM_COVER_ALLOWED_HOST} 주소만 사용할 수 있습니다 (입력한 호스트: ${parsed.hostname}).`;
  }
  if (!ALBUM_COVER_PATH_PATTERN.test(parsed.pathname)) {
    // 가장 흔한 실수가 100x100 주소를 붙여 넣는 것이라 그 경우를 따로 짚어 준다
    return ARTWORK_SIZE_SUFFIX_PATTERN.test(parsed.pathname)
      ? `주소 끝이 ${ALBUM_COVER_ARTWORK_SIZE} 여야 합니다. 크기 부분만 바꿔서 다시 시도해 주세요.`
      : `/image/thumb/… 로 시작하고 ${ALBUM_COVER_ARTWORK_SIZE} 로 끝나는 주소만 사용할 수 있습니다.`;
  }
  if (parsed.search !== "" || parsed.hash !== "") {
    return "주소에 물음표(?) 뒤 쿼리나 # 이후 부분이 포함돼 있습니다. 그 부분을 지워 주세요.";
  }

  return null;
}

/**
 * 목록·후보 썸네일용 축소 주소. 공개 사이트의 `src/lib/mzstatic.ts`와 같은 규칙이다
 * (600px 원본을 그대로 여러 장 띄우면 관리자 화면이 느려진다).
 */
export function shrinkAlbumCoverUrl(url: string, size = 112): string {
  return url.replace(ARTWORK_SIZE_SUFFIX_PATTERN, `/${size}x${size}bb.jpg`);
}
