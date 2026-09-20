import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';

export const CORS_ALLOWED_ORIGINS_ENV = 'CORS_ALLOWED_ORIGINS';

/** `http:` 오리진을 허용하는 호스트. 개발용 루프백뿐이다 */
const IPV4_LOOPBACK_PATTERN = /^127(?:\.\d{1,3}){3}$/;

/** `new URL().hostname`이 돌려주는 형태(IPv6는 대괄호 포함)의 루프백 호스트인지 */
export function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '[::1]' || IPV4_LOOPBACK_PATTERN.test(hostname);
}

/**
 * `CORS_ALLOWED_ORIGINS`(콤마 구분)를 검증해 오리진 목록으로 바꾼다.
 *
 * - **미설정/빈 값 → 빈 목록 = 크로스 오리진 요청을 전부 거부한다(fail-closed).** 열어 두고 잊는 사고를 막는다.
 *   같은 오리진 요청과 서버 간 호출(브라우저가 아니라 Origin 헤더가 없음)은 CORS와 무관해 영향이 없다
 * - 각 항목은 `http(s)://호스트[:포트]` 형태의 **오리진 그대로**여야 한다. 경로·끝의 슬래시·쿼리·기본 포트·
 *   대문자 호스트는 브라우저가 보내는 `Origin` 값과 문자열이 달라져 조용히 매칭에 실패하므로 기동 시점에 막는다
 * - 와일드카드(`*`)는 허용하지 않는다. 관리자 API에 임의 오리진을 여는 설정이 되기 때문이다
 * - **`http:`는 루프백(`localhost`, `127.x.x.x`, `[::1]`)만 허용한다.** 토큰이 브라우저 JS에 있는 구조라
 *   평문 오리진이 허용되면 네트워크 중간자가 그 오리진의 스크립트를 바꿔 토큰을 빼 갈 수 있다
 * - 자격증명(`user:pass@`)이 든 항목은 거부한다
 *
 * **오류 메시지에 입력 값을 출력하지 않는다.** 잘못 붙여 넣은 값이 자격증명이나 비밀일 수 있고, 기동 오류는
 * stderr·journal에 남는다. 항목의 위치(빈 항목 제외, 1부터)와 이유 범주만 알린다.
 */
export function parseCorsAllowedOrigins(raw: string | undefined): string[] {
  const entries = (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const origins: string[] = [];
  entries.forEach((entry, index) => {
    const origin = normalizeOrigin(entry, index + 1);
    if (!origins.includes(origin)) {
      origins.push(origin);
    }
  });

  return origins;
}

function invalidEntry(position: number, reason: string): never {
  throw new Error(
    `${CORS_ALLOWED_ORIGINS_ENV}의 ${position}번째 항목(빈 항목 제외)이 올바르지 않습니다: ${reason}. ` +
      '(입력 값은 보안상 출력하지 않습니다) 예) https://admin.example.com',
  );
}

function normalizeOrigin(entry: string, position: number): string {
  if (entry.includes('*')) {
    return invalidEntry(position, '와일드카드(*)는 쓸 수 없습니다. 허용할 오리진을 하나씩 적으세요');
  }

  let url: URL;
  try {
    url = new URL(entry);
  } catch {
    return invalidEntry(position, '오리진 형식(스킴://호스트[:포트])이 아닙니다');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return invalidEntry(position, 'http 또는 https 오리진만 받습니다');
  }

  if (url.username !== '' || url.password !== '') {
    return invalidEntry(position, '자격증명(사용자:비밀번호@)을 포함할 수 없습니다');
  }

  // 브라우저는 Origin을 이 정규형으로 보낸다. 다르면 (경로, 끝 슬래시, 기본 포트, 대문자 등) 절대 매칭되지 않는다.
  if (url.origin !== entry) {
    return invalidEntry(
      position,
      '정규형이 아닙니다(경로·쿼리·해시·끝 슬래시·기본 포트·대문자 없이 스킴://호스트[:포트]만 적으세요)',
    );
  }

  if (url.protocol === 'http:' && !isLoopbackHostname(url.hostname)) {
    return invalidEntry(
      position,
      'http 오리진은 루프백(localhost, 127.0.0.1, [::1])에서만 허용합니다. 그 밖의 오리진은 https를 사용하세요',
    );
  }

  return url.origin;
}

/**
 * CORS 옵션.
 *
 * - `origin`은 **항상 배열**로 넘긴다. `cors` 패키지는 origin이 falsy면 미들웨어 자체를 건너뛰는데,
 *   빈 배열은 truthy라 "허용 목록이 비어 있음"으로 정상 처리되어 어떤 오리진도 허용하지 않는다
 * - `credentials: false` — 인증은 `Authorization` 헤더로 하고 쿠키를 쓰지 않는다(JWT 방식 결정과 묶여 있음).
 *   쿠키 방식으로 바꾸면 CSRF 설계가 함께 필요해진다
 * - `methods`: PRD에서 삭제 기능을 제외했으므로 `DELETE`는 열지 않는다
 * - `exposedHeaders: Retry-After` — 없으면 브라우저 JS가 429의 `Retry-After`를 읽지 못해
 *   관리자 화면이 "몇 초 뒤에 다시 시도"를 안내할 수 없다
 * - `maxAge: 600` — preflight 결과를 10분 캐시. 오리진 설정을 바꿨을 때 반영이 크게 늦지 않는 선이다
 */
export function buildCorsOptions(origins: string[]): CorsOptions {
  return {
    origin: origins,
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    exposedHeaders: ['Retry-After'],
    maxAge: 600,
  };
}
