export const TRUST_PROXY_HOPS_ENV = 'TRUST_PROXY_HOPS';

/** 실제 배포에서 앞단 프록시가 이 이상 겹치는 일은 없다. 오타(`100` 등)로 신뢰 범위가 넓어지는 것을 막는다. */
export const MAX_TRUST_PROXY_HOPS = 5;

/**
 * `TRUST_PROXY_HOPS`를 검증해 숫자로 바꾼다.
 *
 * 값은 "클라이언트 쪽에서 세어 몇 번째 프록시까지 `X-Forwarded-For`를 믿을 것인가"다.
 * - 미설정/빈 값 → **0(믿지 않음)**. 잘못 켜면 헤더 위조로 요청 제한(throttler)이 무력화되므로 기본은 닫혀 있다
 * - 프록시가 없는 로컬 개발: 0
 * - nginx 한 대 뒤: 1 (배포 구성이 정해진 뒤 결정한다)
 * 형식이 잘못되면 첫 요청이 아니라 기동 시점에 실패시킨다(JWT_SECRET 선례).
 */
export function parseTrustProxyHops(raw: string | undefined): number {
  const value = raw?.trim();
  if (!value) {
    return 0;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error(
      `${TRUST_PROXY_HOPS_ENV}는 0 이상의 정수여야 합니다: "${value}". 예) 0, 1`,
    );
  }

  const hops = Number(value);
  if (hops > MAX_TRUST_PROXY_HOPS) {
    throw new Error(
      `${TRUST_PROXY_HOPS_ENV}가 너무 큽니다 (${hops}). 최대 ${MAX_TRUST_PROXY_HOPS}까지 허용합니다.`,
    );
  }

  return hops;
}
