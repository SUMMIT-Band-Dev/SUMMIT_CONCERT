import 'reflect-metadata';
import type { ArgumentsHost } from '@nestjs/common';
import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import { PROJECT_ROOT } from './error-log.js';
import { INTERNAL_ERROR_MESSAGE } from './http-messages.js';

/**
 * 예외 로그의 허용 목록 경로를 **필터를 통과시켜** 확인한다 (`error-log.spec.ts`는 함수 단위).
 * 응답은 언제나 500 고정 문구이고, 로그에만 허용 목록의 내장 오류 정보가 붙는다.
 */
function setup() {
  const logger = { error: vi.fn(), warn: vi.fn() };
  const response = {
    headersSent: false,
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    json(body: unknown) {
      response.body = body;
      return response;
    },
    end: vi.fn(),
  };
  // 로그에 남으면 안 되는 값을 전부 실은 요청
  const request = {
    method: 'POST',
    originalUrl: '/songs/5?token=QUERY_SECRET_VALUE',
    url: '/songs/5?token=QUERY_SECRET_VALUE',
    headers: { authorization: 'Bearer HEADER_SECRET_VALUE' },
    body: { password: 'BODY_SECRET_VALUE' },
  } as unknown as Request;
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ArgumentsHost;

  const filter = new AllExceptionsFilter(logger);
  return { run: (exception: unknown) => filter.catch(exception, host), logger, response };
}

const loggedLine = (logger: { error: ReturnType<typeof vi.fn> }) => logger.error.mock.calls[0][0] as string;

const REQUEST_LEAKS = ['QUERY_SECRET_VALUE', 'HEADER_SECRET_VALUE', 'BODY_SECRET_VALUE', 'Bearer'];

describe('AllExceptionsFilter — 허용 목록 내장 오류의 로그', () => {
  it('TypeError: 응답은 500 고정 문구이고, 로그에는 메시지와 프로젝트 상대 경로 위치가 붙는다', () => {
    const { run, logger, response } = setup();

    run(new TypeError("Cannot read properties of undefined (reading 'title')"));

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      message: INTERNAL_ERROR_MESSAGE,
      error: 'Internal Server Error',
      statusCode: 500,
    });
    expect(JSON.stringify(response.body)).not.toContain('title');

    expect(logger.error).toHaveBeenCalledTimes(1);
    const line = loggedLine(logger);
    expect(line.startsWith("예외 처리: TypeError POST /songs/5 → 500 | 메시지: Cannot read properties of undefined (reading 'title') | 위치: ")).toBe(true);
    expect(line).toContain('src/common/all-exceptions.filter.log.spec.ts');
  });

  it('요청 값(쿼리스트링·헤더·본문)과 절대 경로는 이 경로에서도 로그에 남지 않는다', () => {
    const { run, logger } = setup();

    run(new RangeError('Invalid array length'));

    const line = loggedLine(logger);
    for (const leak of [...REQUEST_LEAKS, PROJECT_ROOT, 'C:\\Users', '/Users/']) {
      expect(line).not.toContain(leak);
    }
    expect(line).not.toMatch(/[A-Za-z]:[\\/]/);
  });

  it('로그는 여전히 한 줄, 인자는 그 한 개뿐이다', () => {
    const { run, logger } = setup();

    run(new TypeError('x\nFORGED LOG LINE'));

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0]).toHaveLength(1);
    expect(loggedLine(logger)).not.toContain('\n');
  });

  it('허용 목록 밖의 오류는 기존과 같은 한 줄이다 (Prisma 모양·서브클래스·code 있는 오류)', () => {
    class PrismaClientKnownRequestError extends Error {
      code = 'P2002';
      meta = { target: ['META_TARGET_VALUE'] };
    }
    class FooError extends TypeError {}
    const cases: Array<[unknown, string]> = [
      [new PrismaClientKnownRequestError('MESSAGE_SECRET_VALUE'), '예외 처리: PrismaClientKnownRequestError(code=P2002) POST /songs/5 → 500'],
      [new FooError('MESSAGE_SECRET_VALUE'), '예외 처리: FooError POST /songs/5 → 500'],
      [Object.assign(new TypeError('MESSAGE_SECRET_VALUE'), { code: 'ERR_INVALID_ARG_TYPE' }), '예외 처리: TypeError(code=ERR_INVALID_ARG_TYPE) POST /songs/5 → 500'],
      [new Error('MESSAGE_SECRET_VALUE'), '예외 처리: Error POST /songs/5 → 500'],
    ];

    for (const [thrown, expected] of cases) {
      const { run, logger } = setup();

      run(thrown);

      expect(logger.error).toHaveBeenCalledWith(expected);
    }
  });
});

describe('AllExceptionsFilter — SyntaxError (본문 파서 유래가 아닌 것)', () => {
  it('500 고정 문구로 응답하고, 로그에는 위치만 남는다 (메시지에 입력 조각이 실릴 수 있다)', () => {
    const { run, logger, response } = setup();

    run(new SyntaxError('Unexpected token \'M\', "MESSAGE_SECRET_VALUE" is not valid JSON'));

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      message: INTERNAL_ERROR_MESSAGE,
      error: 'Internal Server Error',
      statusCode: 500,
    });
    const line = loggedLine(logger);
    expect(line).toContain('예외 처리: SyntaxError POST /songs/5 → 500 | 위치: ');
    expect(line).not.toContain('MESSAGE_SECRET_VALUE');
    expect(line).not.toContain('메시지');
  });
});
