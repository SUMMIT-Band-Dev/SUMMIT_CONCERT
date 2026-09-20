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
 *
 * 오류 메시지에 입력 값을 출력하지 않는다(기동 오류는 stderr·journal에 남고, 잘못 붙여 넣은 값이 비밀일 수 있다).
 */
export function parseTrustProxyHops(raw: string | undefined): number {
  const value = raw?.trim();
  if (!value) {
    return 0;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error(
      `${TRUST_PROXY_HOPS_ENV}는 0 이상의 정수여야 합니다 (0~${MAX_TRUST_PROXY_HOPS}). ` +
        '(입력 값은 보안상 출력하지 않습니다) 예) 0, 1',
    );
  }

  const hops = Number(value);
  if (hops > MAX_TRUST_PROXY_HOPS) {
    throw new Error(
      `${TRUST_PROXY_HOPS_ENV}가 너무 큽니다. 최대 ${MAX_TRUST_PROXY_HOPS}까지 허용합니다. ` +
        '(입력 값은 보안상 출력하지 않습니다)',
    );
  }

  return hops;
}

/**
 * 0이 아닌 값으로 기동할 때 남기는 경고 한 줄. 0(기본)이면 경고할 것이 없어 `undefined`다.
 *
 * 값이 실제 배포와 다르면 조용히 위험해진다: 실제 프록시 수보다 크거나 앱 포트가 프록시를 거치지 않고
 * 열려 있으면 `X-Forwarded-For` 위조로 요청 제한을 피할 수 있고, 프록시가 있는데 0이면 모든 사용자가
 * 한 IP로 집계된다. 내용은 숫자와 고정 문장뿐이다(비밀 없음).
 */
export function buildTrustProxyWarning(hops: number): string | undefined {
  if (hops <= 0) {
    return undefined;
  }

  return (
    `${TRUST_PROXY_HOPS_ENV}=${hops}: X-Forwarded-For를 프록시 ${hops}단계까지 신뢰합니다. ` +
    '앱 포트는 프록시에서만 접근할 수 있어야 하며, 값이 실제 프록시 수와 다르면 ' +
    '요청 제한이 우회되거나 모든 사용자가 한 IP로 집계되어 관리자 로그인이 잠길 수 있습니다.'
  );
}
