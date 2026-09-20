/**
 * 인바운드 요청 제한 상수 (work02-7a).
 *
 * 저장소는 인메모리라 **단일 인스턴스 전제**다. 인스턴스가 둘 이상이 되면 한도가 인스턴스 수만큼
 * 늘어나므로, 스케일아웃 시 `ProcessMutex`·`OutboundRateLimiter`와 함께 공유 저장소로 옮긴다.
 *
 * 단위: `ttl`/`blockDuration`은 **밀리초**, 응답의 `Retry-After`는 **초**(라이브러리 규약).
 * 차단 판정은 `총 요청 수 > limit`이라 `limit=5`면 6번째 요청부터 429다.
 */

/** 로그인 전용 throttler 이름. `default`와 배타적으로 적용된다(라우트 하나에 둘 중 하나만). */
export const LOGIN_THROTTLER_NAME = 'login';

/** 기본: IP당 분당 300회. 관리자 화면이 목록·패널을 동시에 여는 것을 방해하지 않는 선(봇 방어용) */
export const DEFAULT_THROTTLE = {
  limit: 300,
  ttlMs: 60_000,
} as const;

/**
 * 로그인: 5분에 5회, 초과하면 15분 차단.
 * 차단 시간이 창보다 길어야 창이 지날 때마다 5회씩 갉아먹는 저속 공격이 의미를 잃는다.
 */
export const LOGIN_THROTTLE = {
  limit: 5,
  ttlMs: 5 * 60_000,
  blockMs: 15 * 60_000,
} as const;

/** 429 응답 메시지. 남은 시간은 본문이 아니라 `Retry-After` 헤더로 준다 */
export const THROTTLED_MESSAGE = '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
