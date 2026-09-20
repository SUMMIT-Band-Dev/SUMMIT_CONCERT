import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
  type ArgumentsHost,
} from '@nestjs/common';
import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { OutboundRateLimitException } from '../album-cover/outbound-rate-limiter.js';
import { CARD_IMAGE_TOO_LARGE_MESSAGE } from '../storage/storage.constants.js';
import { YoutubeQuotaExhaustedException } from '../youtube/youtube-quota-exhausted.exception.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import {
  BODY_TOO_LARGE_MESSAGE,
  GENERIC_CLIENT_ERROR_MESSAGE,
  INTERNAL_ERROR_MESSAGE,
  ROUTE_NOT_FOUND_MESSAGE,
  UNSUPPORTED_ENCODING_MESSAGE,
} from './http-messages.js';
import {
  mapForeignKeyViolation,
  mapRecordNotFound,
  mapUniqueViolation,
} from './prisma-error.js';

// ── 테스트 대역 ─────────────────────────────────────────────────────────────

interface FakeResponse {
  headersSent: boolean;
  statusCode?: number;
  body?: unknown;
  status: (code: number) => FakeResponse;
  json: (body: unknown) => FakeResponse;
  end: ReturnType<typeof vi.fn>;
}

function createResponse(headersSent = false): FakeResponse {
  const response: FakeResponse = {
    headersSent,
    end: vi.fn(),
    status(code) {
      response.statusCode = code;
      return response;
    },
    json(body) {
      response.body = body;
      return response;
    },
  };
  return response;
}

/** 로그에 남으면 안 되는 값을 전부 실어 둔 요청. 필터가 이 중 무엇이든 새어 나가게 하면 테스트가 잡는다 */
function createRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: 'POST',
    originalUrl: '/songs/5?token=QUERY_SECRET_VALUE',
    url: '/songs/5?token=QUERY_SECRET_VALUE',
    headers: { authorization: 'Bearer HEADER_SECRET_VALUE' },
    body: { password: 'BODY_SECRET_VALUE' },
    ...overrides,
  } as unknown as Request;
}

function setup(request: Request | undefined = createRequest(), response = createResponse()) {
  const logger = { error: vi.fn(), warn: vi.fn() };
  const filter = new AllExceptionsFilter(logger);
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ArgumentsHost;

  return {
    run: (exception: unknown) => filter.catch(exception, host),
    response,
    logger,
  };
}

/** 실제 Prisma 오류와 같은 모양: 클래스명·`code`·`meta`(인자·접속 정보)·스택·메시지에 값이 실린다 */
class PrismaClientKnownRequestError extends Error {
  code = 'P2002';
  meta = {
    modelName: 'AdminUser',
    driverAdapterError: { cause: { kind: 'DatabaseNotReachable', host: 'META_HOST_VALUE.invalid' } },
    target: ['META_TARGET_VALUE'],
  };
  constructor() {
    super('Invalid `prisma.adminUser.create()` invocation: data: { username: "MESSAGE_SECRET_VALUE" }');
    this.stack = `${this.name}: ${this.message}\n    at C:\\Users\\PC\\STACK_PATH_VALUE\\service.js:1:1`;
  }
}

class PrismaClientInitializationError extends Error {
  constructor() {
    super("Can't reach database server at db-host-does-not-exist.invalid:5432");
    this.stack = `Error: ${this.message}\n    at C:\\Users\\PC\\STACK_PATH_VALUE\\prisma.js:1:1`;
  }
}

const INTERNAL_BODY = {
  message: INTERNAL_ERROR_MESSAGE,
  error: 'Internal Server Error',
  statusCode: 500,
};

/** 새어 나가면 안 되는 값들 */
const LEAKS = [
  'MESSAGE_SECRET_VALUE',
  'META_HOST_VALUE',
  'META_TARGET_VALUE',
  'STACK_PATH_VALUE',
  'QUERY_SECRET_VALUE',
  'HEADER_SECRET_VALUE',
  'BODY_SECRET_VALUE',
  'db-host-does-not-exist',
  'C:\\Users',
  'Invalid `prisma',
];

// ── HttpException: 기존 계약 통과 ───────────────────────────────────────────

describe('AllExceptionsFilter — HttpException은 message/statusCode를 바꾸지 않는다', () => {
  it.each([
    ['400 (ParseBigIntPipe)', new BadRequestException('id는 1 이상의 정수여야 합니다.'), 400, 'Bad Request'],
    ['401 (Guard)', new UnauthorizedException('인증이 필요합니다.'), 401, 'Unauthorized'],
    ['404 (서비스)', new NotFoundException('해당 팀을 찾을 수 없습니다.'), 404, 'Not Found'],
    ['409', new ConflictException('이미 존재하는 항목입니다.'), 409, 'Conflict'],
    ['413 (multer 치환)', new PayloadTooLargeException(CARD_IMAGE_TOO_LARGE_MESSAGE), 413, 'Payload Too Large'],
  ])('%s: message·status 그대로, error 필드 유지', (_label, exception, status, phrase) => {
    const { run, response } = setup();

    run(exception);

    expect(response.statusCode).toBe(status);
    expect(response.body).toEqual({
      message: (exception.getResponse() as { message: string }).message,
      error: phrase,
      statusCode: status,
    });
  });

  it('ValidationPipe식 message 배열을 그대로 둔다', () => {
    const { run, response } = setup();

    run(new BadRequestException(['아이디를 입력해 주세요.', '비밀번호를 입력해 주세요.']));

    expect(response.body).toEqual({
      message: ['아이디를 입력해 주세요.', '비밀번호를 입력해 주세요.'],
      error: 'Bad Request',
      statusCode: 400,
    });
  });

  it('error가 없는 HttpException은 상태코드에서 error만 채운다 (413·429·502·504)', () => {
    for (const [status, phrase] of [
      [413, 'Payload Too Large'],
      [429, 'Too Many Requests'],
      [502, 'Bad Gateway'],
      [504, 'Gateway Timeout'],
    ] as const) {
      const { run, response } = setup();

      run(new HttpException('고정 한국어 문구', status));

      expect(response.statusCode).toBe(status);
      expect(response.body).toEqual({ message: '고정 한국어 문구', error: phrase, statusCode: status });
    }
  });

  it('표에 없는 상태코드는 error를 "Error"로 채운다', () => {
    const { run, response } = setup();

    run(new HttpException('x', 418));

    expect(response.body).toEqual({ message: 'x', error: 'Error', statusCode: 418 });
  });

  it('응답에 실린 추가 필드와 이미 있는 error 값을 유지한다', () => {
    const { run, response } = setup();

    run(new HttpException({ message: 'm', error: 'Custom', statusCode: 409, retryAfterSeconds: 5 }, 409));

    expect(response.body).toEqual({
      message: 'm',
      error: 'Custom',
      statusCode: 409,
      retryAfterSeconds: 5,
    });
  });

  it('기존 429 예외(앨범 커버·유튜브 쿼터)의 응답 본문이 그대로다', () => {
    for (const exception of [new OutboundRateLimitException(3), new YoutubeQuotaExhaustedException(10)]) {
      const { run, response } = setup();

      run(exception);

      expect(response.statusCode).toBe(429);
      expect(response.body).toEqual(exception.getResponse());
    }
  });

  it('기존 Prisma 매핑 헬퍼가 만든 404/409를 그대로 통과시킨다', async () => {
    const reject = (code: string) => Promise.reject(Object.assign(new Error('prisma'), { code }));
    const cases = [
      [await mapRecordNotFound(reject('P2025'), '해당 곡을 찾을 수 없습니다.').catch((e) => e), 404, '해당 곡을 찾을 수 없습니다.'],
      [await mapUniqueViolation(reject('P2002'), '이미 있는 값입니다.').catch((e) => e), 409, '이미 있는 값입니다.'],
      [await mapForeignKeyViolation(reject('P2003'), '해당 팀을 찾을 수 없습니다.').catch((e) => e), 404, '해당 팀을 찾을 수 없습니다.'],
    ] as const;

    for (const [exception, status, message] of cases) {
      const { run, response } = setup();

      run(exception);

      expect(response.statusCode).toBe(status);
      expect((response.body as { message: string }).message).toBe(message);
    }
  });

  it('매핑되지 않은 Prisma 오류(P2025 외)는 500 고정 문구가 된다', async () => {
    const unmapped = await mapRecordNotFound(
      Promise.reject(Object.assign(new PrismaClientKnownRequestError(), { code: 'P2010' })),
      '해당 곡을 찾을 수 없습니다.',
    ).catch((e) => e);
    const { run, response } = setup();

    run(unmapped);

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual(INTERNAL_BODY);
  });

  it('HttpException은 로그를 남기지 않는다 (기존 Nest 기본 동작과 같다)', () => {
    const { run, logger } = setup();

    run(new NotFoundException('해당 팀을 찾을 수 없습니다.'));
    run(new HttpException('업스트림 실패', 502));

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

// ── 존재하지 않는 경로 ──────────────────────────────────────────────────────

describe('AllExceptionsFilter — 미지정 라우트 404', () => {
  it('Nest가 만든 "Cannot METHOD URL"을 경로를 되돌려 주지 않는 한국어 문구로 바꾼다', () => {
    const request = createRequest({ method: 'GET', originalUrl: '/nope', url: '/nope' });
    const { run, response } = setup(request);

    run(new NotFoundException('Cannot GET /nope'));

    expect(response.body).toEqual({ message: ROUTE_NOT_FOUND_MESSAGE, error: 'Not Found', statusCode: 404 });
  });

  it('쿼리스트링이 붙은 요청도 바꾼다 (Nest 메시지에는 쿼리스트링이 포함된다)', () => {
    const request = createRequest({
      method: 'GET',
      originalUrl: '/nope?token=QUERY_SECRET_VALUE',
    });
    const { run, response } = setup(request);

    run(new NotFoundException('Cannot GET /nope?token=QUERY_SECRET_VALUE'));

    expect(JSON.stringify(response.body)).not.toContain('QUERY_SECRET_VALUE');
    expect((response.body as { message: string }).message).toBe(ROUTE_NOT_FOUND_MESSAGE);
  });

  it('현재 요청과 일치하지 않는 "Cannot ..."는 건드리지 않는다 (앱이 던진 404 오탐 방지)', () => {
    const request = createRequest({ method: 'GET', originalUrl: '/nope' });
    const { run, response } = setup(request);

    run(new NotFoundException('Cannot GET /other'));

    expect((response.body as { message: string }).message).toBe('Cannot GET /other');
  });

  it('앱이 던진 한국어 404는 바꾸지 않는다', () => {
    const request = createRequest({ method: 'GET', originalUrl: '/teams/9/songs' });
    const { run, response } = setup(request);

    run(new NotFoundException('해당 팀을 찾을 수 없습니다.'));

    expect((response.body as { message: string }).message).toBe('해당 팀을 찾을 수 없습니다.');
  });
});

// ── HttpException이 아닌 오류 ───────────────────────────────────────────────

describe('AllExceptionsFilter — 알 수 없는 오류는 500 고정 문구', () => {
  it.each([
    ['Prisma 오류(메시지·meta에 값이 실림)', new PrismaClientKnownRequestError()],
    ['DB 연결 실패(메시지에 호스트가 실림)', new PrismaClientInitializationError()],
    ['일반 Error', new Error('MESSAGE_SECRET_VALUE')],
    ['TypeError', new TypeError('MESSAGE_SECRET_VALUE')],
    ['문자열이 던져짐', 'MESSAGE_SECRET_VALUE'],
    ['null이 던져짐', null],
    ['undefined가 던져짐', undefined],
    ['일반 객체가 던져짐', { message: 'MESSAGE_SECRET_VALUE', statusCode: 400 }],
  ])('%s', (_label, thrown) => {
    const { run, response } = setup();

    run(thrown);

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual(INTERNAL_BODY);
    for (const leak of LEAKS) {
      expect(JSON.stringify(response.body)).not.toContain(leak);
    }
  });

  it('5xx http-error 모양이어도 원본 메시지를 쓰지 않고 500 고정 문구다', () => {
    const { run, response } = setup();

    run(Object.assign(new Error('MESSAGE_SECRET_VALUE'), { expose: false, status: 503 }));

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual(INTERNAL_BODY);
  });
});

describe('AllExceptionsFilter — 본문 파서류 4xx 오류(http-errors 모양)', () => {
  const clientError = (status: number) =>
    Object.assign(new Error('unexpected token near BODY_SECRET_VALUE'), {
      expose: true,
      status,
      statusCode: status,
      type: 'entity.parse.failed',
    });

  it.each([
    [400, '잘못된 요청입니다.', 'Bad Request'],
    [413, BODY_TOO_LARGE_MESSAGE, 'Payload Too Large'],
    [415, UNSUPPORTED_ENCODING_MESSAGE, 'Unsupported Media Type'],
    [418, GENERIC_CLIENT_ERROR_MESSAGE, 'Error'],
  ])('%i은 상태코드는 유지하고 메시지는 고정 문구로 바꾼다', (status, message, phrase) => {
    const { run, response } = setup();

    run(clientError(status));

    expect(response.statusCode).toBe(status);
    expect(response.body).toEqual({ message, error: phrase, statusCode: status });
    expect(JSON.stringify(response.body)).not.toContain('BODY_SECRET_VALUE');
  });
});

// ── 로그 (조건 A) ───────────────────────────────────────────────────────────

describe('AllExceptionsFilter — 로그에는 클래스명·code·method·path·상태코드만 남는다', () => {
  it('Prisma 오류: 정확히 이 한 줄이고 인자는 그 한 개뿐이다 (스택·meta를 두 번째 인자로 넘기지 않는다)', () => {
    const { run, logger } = setup();

    run(new PrismaClientKnownRequestError());

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      '예외 처리: PrismaClientKnownRequestError(code=P2002) POST /songs/5 → 500',
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('연결 실패: 접속 호스트·메시지·스택·절대 경로가 로그에 없다', () => {
    const { run, logger } = setup(createRequest({ method: 'GET', originalUrl: '/health/db?x=QUERY_SECRET_VALUE' }));

    run(new PrismaClientInitializationError());

    expect(logger.error).toHaveBeenCalledWith('예외 처리: PrismaClientInitializationError GET /health/db → 500');
    const logged = JSON.stringify(logger.error.mock.calls);
    for (const leak of LEAKS) {
      expect(logged).not.toContain(leak);
    }
  });

  it('메시지·스택·meta·본문·헤더·쿼리스트링 어느 것도 로그에 나오지 않는다', () => {
    const { run, logger } = setup();

    run(new PrismaClientKnownRequestError());

    const logged = JSON.stringify([...logger.error.mock.calls, ...logger.warn.mock.calls]);
    for (const leak of LEAKS) {
      expect(logged).not.toContain(leak);
    }
  });

  it('쿼리스트링과 해시를 잘라 낸 경로만 남긴다', () => {
    const { run, logger } = setup(createRequest({ method: 'GET', originalUrl: '/a/b?token=1#frag' }));

    run(new Error('x'));

    expect(logger.error).toHaveBeenCalledWith('예외 처리: Error GET /a/b → 500');
  });

  it('경로는 200자에서 자른다', () => {
    const { run, logger } = setup(createRequest({ method: 'GET', originalUrl: `/${'a'.repeat(500)}` }));

    run(new Error('x'));

    const line = logger.error.mock.calls[0][0] as string;
    expect(line.length).toBeLessThan(300);
  });

  it('4xx 오류는 error가 아니라 warn으로 남긴다', () => {
    const { run, logger } = setup();

    run(Object.assign(new Error('x'), { expose: true, status: 400 }));

    expect(logger.warn).toHaveBeenCalledWith('예외 처리: Error POST /songs/5 → 400');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('문자열·null이 던져지면 자리표시 이름만 남긴다', () => {
    const { run, logger } = setup();

    run('MESSAGE_SECRET_VALUE');
    run(null);

    expect(logger.error).toHaveBeenNthCalledWith(1, '예외 처리: NonObjectThrown POST /songs/5 → 500');
    expect(logger.error).toHaveBeenNthCalledWith(2, '예외 처리: NonObjectThrown POST /songs/5 → 500');
  });

  it('클래스명이 식별자 형태가 아니면 UnknownError로 바꾼다 (로그 주입 방지)', () => {
    class Weird extends Error {}
    Object.defineProperty(Weird, 'name', { value: 'bad name\nFORGED LOG LINE' });
    const { run, logger } = setup();

    run(new Weird('x'));

    expect(logger.error).toHaveBeenCalledWith('예외 처리: UnknownError POST /songs/5 → 500');
  });

  it('code가 식별자 형태가 아니면 남기지 않는다', () => {
    const { run, logger } = setup();

    run(Object.assign(new Error('x'), { code: 'value with spaces\nand newline' }));

    expect(logger.error).toHaveBeenCalledWith('예외 처리: Error POST /songs/5 → 500');
  });

  it('method가 비정상이면 UNKNOWN', () => {
    const { run, logger } = setup(createRequest({ method: 'bad\nmethod' }));

    run(new Error('x'));

    expect(logger.error).toHaveBeenCalledWith('예외 처리: Error UNKNOWN /songs/5 → 500');
  });
});

describe('AllExceptionsFilter — 응답 처리', () => {
  it('이미 헤더가 나간 응답에는 본문을 쓰지 않고 연결만 닫는다', () => {
    const response = createResponse(true);
    const { run } = setup(createRequest(), response);

    run(new Error('x'));

    expect(response.end).toHaveBeenCalledTimes(1);
    expect(response.body).toBeUndefined();
  });

  it('http가 아닌 컨텍스트는 건드리지 않는다', () => {
    const logger = { error: vi.fn(), warn: vi.fn() };
    const filter = new AllExceptionsFilter(logger);
    const host = { getType: () => 'rpc' } as unknown as ArgumentsHost;

    expect(() => filter.catch(new Error('x'), host)).not.toThrow();
    expect(logger.error).not.toHaveBeenCalled();
  });
});
