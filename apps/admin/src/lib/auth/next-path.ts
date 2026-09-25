export const DEFAULT_AFTER_LOGIN_PATH = "/teams";

/**
 * 로그인 후 돌아갈 경로(`?next=`)를 검증한다. **같은 사이트 안의 경로만** 허용한다(오픈 리다이렉트 방지).
 * 로그인 페이지 자신으로 돌아가는 값(무한 루프)과 형식이 이상한 값은 기본 경로로 바꾼다.
 */
export function sanitizeNextPath(raw: string | null | undefined, fallback: string = DEFAULT_AFTER_LOGIN_PATH): string {
  if (!raw) return fallback;
  // `//evil.example`, `/\evil.example`, `https://…`, `javascript:…` 는 모두 여기서 걸린다
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  // 제어 문자(개행 등)가 든 값
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback;

  let url: URL;
  try {
    url = new URL(raw, "http://internal.invalid");
  } catch {
    return fallback;
  }
  if (url.origin !== "http://internal.invalid") return fallback;
  if (url.pathname === "/login" || url.pathname.startsWith("/login/")) return fallback;

  return `${url.pathname}${url.search}`;
}

/** 보호된 페이지에서 로그인으로 보낼 때의 주소 */
export function buildLoginRedirect(pathname: string, search: string = ""): string {
  const target = sanitizeNextPath(`${pathname}${search}`, DEFAULT_AFTER_LOGIN_PATH);
  return target === DEFAULT_AFTER_LOGIN_PATH ? "/login" : `/login?next=${encodeURIComponent(target)}`;
}
