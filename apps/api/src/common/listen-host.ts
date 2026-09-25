import { isIP } from 'node:net';

export const LISTEN_HOST_ENV = 'LISTEN_HOST';

/** 기본 바인딩 주소. 배포 구성(Caddy → 127.0.0.1:PORT)에서 앱 포트가 프록시를 거치지 않고 열리지 않게 한다 */
export const DEFAULT_LISTEN_HOST = '127.0.0.1';

const IPV4_LOOPBACK_PATTERN = /^127(?:\.\d{1,3}){3}$/;

function isLoopbackAddress(host: string): boolean {
  return host === '::1' || IPV4_LOOPBACK_PATTERN.test(host);
}

/**
 * `LISTEN_HOST`를 검증해 서버가 바인딩할 주소로 바꾼다.
 *
 * - 미설정/빈 값 → **127.0.0.1(루프백만)**. 호스트를 생략하면 Node가 모든 인터페이스에 바인딩해
 *   리버스 프록시(HTTPS·요청 제한 전제)를 거치지 않는 경로가 생기므로 기본은 닫혀 있다
 * - 컨테이너 안에서 실행해 포트를 밖으로 내보내야 할 때만 `0.0.0.0`(또는 `::`)으로 연다
 * - **IP 리터럴만 받는다.** `localhost` 같은 이름은 OS·설정에 따라 `::1`/`127.0.0.1` 중 어디로 풀릴지 달라
 *   어느 주소에 열렸는지 설정만 보고 알 수 없다
 * 형식이 잘못되면 첫 요청이 아니라 기동 시점에 실패시킨다(JWT_SECRET 선례).
 *
 * 오류 메시지에 입력 값을 출력하지 않는다(기동 오류는 stderr·journal에 남는다 — TRUST_PROXY_HOPS와 같은 방침).
 */
export function parseListenHost(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) {
    return DEFAULT_LISTEN_HOST;
  }

  if (isIP(value) === 0) {
    throw new Error(
      `${LISTEN_HOST_ENV}는 IP 주소여야 합니다. (입력 값은 보안상 출력하지 않습니다) ` +
        '예) 127.0.0.1(기본, 로컬만), 0.0.0.0(컨테이너에서 포트를 내보낼 때)',
    );
  }

  return value;
}

/**
 * 루프백이 아닌 주소로 기동할 때 남기는 경고 한 줄. 루프백이면 경고할 것이 없어 `undefined`다.
 * 내용은 주소와 고정 문장뿐이다(비밀 없음).
 */
export function buildListenHostWarning(host: string): string | undefined {
  if (isLoopbackAddress(host)) {
    return undefined;
  }

  return (
    `${LISTEN_HOST_ENV}=${host}: 루프백이 아닌 주소에 바인딩합니다. ` +
    '앱 포트가 리버스 프록시를 거치지 않고 외부에 노출되지 않도록 방화벽을 확인하세요.'
  );
}
