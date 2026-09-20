import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import { YOUTUBE_QUOTA_EXHAUSTED_MESSAGE } from './youtube-search.constants.js';

/**
 * 오늘 쓸 수 있는 검색 횟수가 바닥나 **아무것도 처리하지 못했다**는 응답 (429).
 *
 * `Retry-After`를 실어야 해서 전용 예외로 둔다. `OutboundRateLimitException`(앨범 커버)은
 * 메시지가 그 기능 전용이라 재사용하지 않았다.
 */
export class YoutubeQuotaExhaustedException extends HttpException {
  constructor(readonly retryAfterSeconds: number) {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: YOUTUBE_QUOTA_EXHAUSTED_MESSAGE,
        error: 'Too Many Requests',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

/**
 * 429에 `Retry-After`를 붙인다. 서비스는 응답 객체를 모르므로 헤더는 여기서만 실을 수 있다.
 *
 * `@Catch`가 이 예외 타입 하나만 잡는다는 점이 중요하다. 상태코드(429)로 잡으면 다른 출처의
 * 429까지 가로챈다 (`OutboundRateLimitFilter`와 같은 이유).
 */
@Catch(YoutubeQuotaExhaustedException)
export class YoutubeQuotaExhaustedFilter implements ExceptionFilter {
  catch(exception: YoutubeQuotaExhaustedException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    response.setHeader('Retry-After', String(exception.retryAfterSeconds));
    response.status(exception.getStatus()).json(exception.getResponse());
  }
}
