import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { OutboundRateLimitException } from './outbound-rate-limiter.js';

/**
 * 상한 초과 응답에 `Retry-After`를 붙인다 (PRD F010).
 *
 * 필터를 쓰는 이유는 헤더 때문이다 — 서비스는 응답 객체를 모르므로 예외만 던질 수 있고,
 * 상태코드 외의 헤더를 실으려면 여기서 붙이는 수밖에 없다.
 *
 * `@Catch`가 이 예외 타입 하나만 잡는다는 점이 중요하다. 상태코드(429)로 잡았다면
 * 다른 출처의 429까지 이 필터가 가로채게 된다.
 */
@Catch(OutboundRateLimitException)
export class OutboundRateLimitFilter implements ExceptionFilter {
  catch(exception: OutboundRateLimitException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    response.setHeader('Retry-After', String(exception.retryAfterSeconds));
    response.status(exception.getStatus()).json(exception.getResponse());
  }
}
