import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * 인증 없이 접근할 수 있는 엔드포인트임을 표시한다.
 *
 * `JwtAuthGuard`는 전역으로 걸려 있어 기본값이 "인증 필요"다(fail-closed).
 * 공개해야 하는 라우트에만 이 데코레이터를 붙인다 — 지금은 `/health`와
 * `POST /auth/login` 둘뿐이다.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
