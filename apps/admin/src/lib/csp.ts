// 관리자 앱의 Content-Security-Policy를 만든다 (next.config.ts의 headers()에서 사용).
//
// 목적: 토큰을 localStorage에 두는 구조(7c-1 결정)에서 XSS의 피해를 줄이는 방어 한 겹.
// 저장소 선택은 XSS 앞에서 큰 차이가 없으므로, 실제 방어는 "서버 문자열은 텍스트로만 렌더링 + dangerouslySetInnerHTML 금지 +
// 서드파티 스크립트 0 + 이 CSP"의 조합이다.
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
  /** 개발 서버는 React Refresh(eval)와 HMR 웹소켓이 필요하다 */
  isDev: boolean;
}

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

  // TODO(7c-2~4): 이미지 호스트는 화면이 실제로 쓰게 될 때 추가한다(미리 열어 두지 않는다 — 최소 권한).
  //   7c-2 팀 카드: Supabase Storage(https://*.supabase.co), 7c-3 앨범 커버: https://is1-ssl.mzstatic.com,
  //   7c-4 유튜브 썸네일: https://i.ytimg.com
  const imgSrc = ["'self'", "data:", "blob:", ...(siteOrigin ? [siteOrigin] : [])];
  const connectSrc = ["'self'", ...(apiOrigin ? [apiOrigin] : []), ...(options.isDev ? ["ws://localhost:*"] : [])];
  const scriptSrc = ["'self'", "'unsafe-inline'", ...(options.isDev ? ["'unsafe-eval'"] : [])];

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
