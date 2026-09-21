// API 기준 주소 설정. NEXT_PUBLIC_API_BASE_URL(공개 값, 비밀 아님)을 읽어 검증한다.

export class ApiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiConfigError";
  }
}

const IPV4_LOOPBACK = /^127(?:\.\d{1,3}){3}$/;

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "[::1]" || IPV4_LOOPBACK.test(hostname);
}

/**
 * 환경변수 값을 검증해 오리진 문자열(끝 슬래시 없음)로 돌려준다.
 *
 * - http(s)만 허용. **http는 루프백(로컬 개발)에서만** — API의 CORS 규칙(apps/api/src/common/cors.ts)과 같은 방침이다.
 *   평문 http 위에서는 토큰이 든 요청이 그대로 노출된다
 * - 경로·쿼리·해시·자격증명이 든 값은 거부한다(붙여 넣다 실수한 값이 조용히 다른 곳으로 요청을 보내지 않게)
 * - **오류 메시지에 입력 값을 넣지 않는다**(잘못 붙여 넣은 값이 비밀일 수 있다)
 */
export function parseApiBaseUrl(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) {
    throw new ApiConfigError(
      "NEXT_PUBLIC_API_BASE_URL이 설정되지 않았습니다. apps/admin/.env.local에 관리자 API 주소를 넣고 다시 빌드하세요.",
    );
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ApiConfigError("NEXT_PUBLIC_API_BASE_URL이 올바른 주소 형식이 아닙니다. 예) http://localhost:3001");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ApiConfigError("NEXT_PUBLIC_API_BASE_URL은 http 또는 https 주소여야 합니다.");
  }
  if (url.username !== "" || url.password !== "") {
    throw new ApiConfigError("NEXT_PUBLIC_API_BASE_URL에 사용자·비밀번호를 넣을 수 없습니다.");
  }
  if ((url.pathname !== "/" && url.pathname !== "") || url.search !== "" || url.hash !== "") {
    throw new ApiConfigError("NEXT_PUBLIC_API_BASE_URL에는 경로·쿼리·해시 없이 스킴://호스트[:포트]만 적으세요.");
  }
  if (url.protocol === "http:" && !isLoopbackHost(url.hostname)) {
    throw new ApiConfigError(
      "NEXT_PUBLIC_API_BASE_URL의 http 주소는 로컬(localhost, 127.0.0.1)에서만 쓸 수 있습니다. 그 밖에는 https를 쓰세요.",
    );
  }

  return url.origin;
}

let cached: string | undefined;

/**
 * 빌드 시점에 번들에 박힌 값을 읽는다. Next.js가 `process.env.NEXT_PUBLIC_*`를 **문자 그대로의 표현**일 때만 치환하므로
 * 동적 키(`process.env[name]`)로 바꾸면 브라우저에서 undefined가 된다.
 */
export function getApiBaseUrl(): string {
  cached ??= parseApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
  return cached;
}
