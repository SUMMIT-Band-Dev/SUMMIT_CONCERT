import { SetMetadata } from '@nestjs/common';

export const LOGIN_THROTTLE_KEY = 'loginThrottle';

/**
 * 로그인처럼 무차별 대입 대상이 되는 핸들러에 붙인다.
 *
 * 이 표시가 있는 핸들러는 엄격한 `login` throttler만 적용받고, 나머지 핸들러는
 * `default` throttler만 적용받는다. 두 throttler가 겹치면 로그인 응답에 default의
 * `X-RateLimit-*` 헤더가 섞여 남은 시도 횟수를 알려 주게 된다.
 */
export const LoginThrottle = () => SetMetadata(LOGIN_THROTTLE_KEY, true);
