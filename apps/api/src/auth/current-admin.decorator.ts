import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedRequest, JwtPayload } from './jwt-payload.js';

/**
 * `JwtAuthGuard`가 요청에 실어 둔 관리자 토큰 페이로드를 꺼낸다.
 * 컨트롤러가 `@Req()`로 요청 객체 전체를 받지 않아도 되게 하는 용도이며,
 * 3~6단계의 팀/곡/유튜브 라우트에서도 그대로 재사용한다.
 */
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.admin) {
      // Guard를 거치지 않은 라우트에 이 데코레이터를 붙인 경우에만 발생한다(구현 실수).
      throw new UnauthorizedException('인증이 필요합니다.');
    }
    return request.admin;
  },
);
