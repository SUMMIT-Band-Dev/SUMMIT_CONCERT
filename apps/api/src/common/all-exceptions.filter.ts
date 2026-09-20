import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  FIXED_MESSAGE_BY_STATUS,
  GENERIC_CLIENT_ERROR_MESSAGE,
  INTERNAL_ERROR_MESSAGE,
  ROUTE_NOT_FOUND_MESSAGE,
  STATUS_PHRASE,
} from './http-messages.js';

/** 모든 오류 응답의 형태. 기존 Nest 내장 예외 응답과 같다 */
export interface ErrorBody {
  message: string | string[];
  error: string;
  statusCode: number;
  [extra: string]: unknown;
}

/** 로그에 남겨도 되는 최소한의 식별자만 통과시키는 패턴 */
const CLASS_NAME_PATTERN = /^[A-Za-z0-9_]{1,80}$/;
const ERROR_CODE_PATTERN = /^(P\d{4}|[A-Z][A-Z0-9_]{1,40})$/;
const METHOD_PATTERN = /^[A-Z]{3,10}$/;
const MAX_LOGGED_PATH_LENGTH = 200;

const errorPhrase = (status: number): string => STATUS_PHRASE[status] ?? 'Error';

/** 본문 파서 등이 만드는 http-errors 형태(`expose`, 숫자 `status`)의 4xx 오류인지 */
function isClientHttpError(exception: unknown): exception is Error & { status: number } {
  if (!(exception instanceof Error)) {
    return false;
  }
  const candidate = exception as Error & { status?: unknown; expose?: unknown };
  return (
    candidate.expose === true &&
    typeof candidate.status === 'number' &&
    candidate.status >= 400 &&
    candidate.status < 500
  );
}

/** 요청 경로. 쿼리스트링·해시는 토큰 등이 실릴 수 있어 로그와 비교 모두에서 제외한다 */
function requestPath(request: Request | undefined): string {
  const raw = request?.originalUrl ?? request?.url ?? '';
  return raw.split(/[?#]/, 1)[0].slice(0, MAX_LOGGED_PATH_LENGTH);
}

function requestMethod(request: Request | undefined): string {
  const method = request?.method ?? '';
  return METHOD_PATTERN.test(method) ? method : 'UNKNOWN';
}

/**
 * 전역 예외 필터.
 *
 * ## 응답 계약
 * - **`HttpException`은 `message`·`statusCode`를 바꾸지 않는다.** 빠진 `error` 필드만 상태코드에서 채운다.
 *   기존 400/401/404/409/413/429 계약과 multer 한국어 치환, 404/409 매핑은 이미 `HttpException`이 되어
 *   도착하므로 그대로 통과한다. 응답에 실린 추가 필드도 유지한다
 * - `HttpException`이 아닌 오류는 **원본 메시지를 응답에 쓰지 않는다.** 본문 파서의 4xx는 상태코드별 고정 문구,
 *   그 밖의 모든 오류(Prisma·연결 실패·알 수 없는 오류)는 `500` 고정 문구다
 * - 존재하지 않는 경로의 404(`Cannot GET /경로`)는 경로를 되돌려 주지 않는 한국어 문구로 바꾼다.
 *   **현재 요청의 method+URL과 메시지가 정확히 같을 때만** 바꾸므로 앱이 던진 404는 건드리지 않는다
 *
 * ## 로그
 * `HttpException`이 아닌 오류만 남기며, 내용은 **클래스명·오류 코드(Prisma 등)·method·path·상태코드뿐**이다.
 * 스택, `meta`, 요청 본문·헤더·쿼리스트링, 접속 호스트, 오류 메시지는 남기지 않는다 — Nest 기본 핸들러는
 * 오류 객체 전체를 로깅해서 연결 실패 시 DB 호스트와 절대 경로가 그대로 찍혔다.
 *
 * 컨트롤러에 `@UseFilters()`로 붙은 필터(`OutboundRateLimitFilter` 등)는 전역 필터보다 먼저 실행되므로
 * 그쪽이 잡는 예외는 여기까지 오지 않는다.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly logger: Pick<Logger, 'error' | 'warn'> = new Logger('ExceptionsHandler'),
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      return;
    }

    const http = host.switchToHttp();
    const request = http.getRequest<Request | undefined>();
    const response = http.getResponse<Response>();

    const { status, body } = this.toResponse(exception, request);
    this.log(exception, status, request);

    if (response.headersSent) {
      response.end();
      return;
    }
    response.status(status).json(body);
  }

  private toResponse(
    exception: unknown,
    request: Request | undefined,
  ): { status: number; body: ErrorBody } {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception, request);
    }

    if (isClientHttpError(exception)) {
      const status = exception.status;
      return {
        status,
        body: {
          message: FIXED_MESSAGE_BY_STATUS[status] ?? GENERIC_CLIENT_ERROR_MESSAGE,
          error: errorPhrase(status),
          statusCode: status,
        },
      };
    }

    return {
      status: 500,
      body: { message: INTERNAL_ERROR_MESSAGE, error: errorPhrase(500), statusCode: 500 },
    };
  }

  private fromHttpException(
    exception: HttpException,
    request: Request | undefined,
  ): { status: number; body: ErrorBody } {
    const status = exception.getStatus();
    const raw = exception.getResponse();
    const source: Record<string, unknown> =
      typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : { message: raw };

    const { message, error, statusCode, ...extras } = source;
    let finalMessage = (message ?? exception.message) as string | string[];

    if (status === 404 && finalMessage === `Cannot ${request?.method} ${request?.originalUrl ?? request?.url}`) {
      finalMessage = ROUTE_NOT_FOUND_MESSAGE;
    }

    return {
      status,
      body: {
        message: finalMessage,
        error: typeof error === 'string' && error.length > 0 ? error : errorPhrase(status),
        statusCode: typeof statusCode === 'number' ? statusCode : status,
        ...extras,
      },
    };
  }

  private log(exception: unknown, status: number, request: Request | undefined): void {
    if (exception instanceof HttpException) {
      return;
    }

    const line = `예외 처리: ${describeError(exception)} ${requestMethod(request)} ${requestPath(request)} → ${status}`;
    if (status >= 500) {
      this.logger.error(line);
    } else {
      this.logger.warn(line);
    }
  }
}

/** `클래스명` 또는 `클래스명(code=P2002)`. 메시지·스택·meta는 절대 포함하지 않는다 */
function describeError(exception: unknown): string {
  if (typeof exception !== 'object' || exception === null) {
    return 'NonObjectThrown';
  }

  const name = exception.constructor?.name;
  const className = typeof name === 'string' && CLASS_NAME_PATTERN.test(name) ? name : 'UnknownError';

  const code = (exception as { code?: unknown }).code;
  return typeof code === 'string' && ERROR_CODE_PATTERN.test(code)
    ? `${className}(code=${code})`
    : className;
}
