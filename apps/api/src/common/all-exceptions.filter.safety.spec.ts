import 'reflect-metadata';
import { HttpException, type ArgumentsHost } from '@nestjs/common';
import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import { INTERNAL_ERROR_MESSAGE } from './http-messages.js';

/**
 * 필터 내부 안전망(교차 리뷰 L3): 응답을 결정·작성하는 과정이 실패해도 필터가 던지지 않고
 * 최소 응답(미리 만든 500 본문)으로 끝나는지 확인한다.
 */
const INTERNAL_BODY = { message: INTERNAL_ERROR_MESSAGE, error: 'Internal Server Error', statusCode: 500 };

interface ResponseOptions {
  headersSent?: boolean;
  setHeaderThrows?: boolean;
  endThrows?: boolean;
  destroyThrows?: boolean;
}

/** Express 응답을 흉내 낸다. `status()`는 실제 Express처럼 범위 밖 상태코드에서 던지고, `json()`은 실제로 직렬화한다 */
function createResponse(options: ResponseOptions = {}) {
  const state = {
    headersSent: options.headersSent ?? false,
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    ended: undefined as string | undefined,
    endCalls: 0,
    destroyed: false,
  };
  const response = {
    get headersSent() {
      return state.headersSent;
    },
    set statusCode(code: number) {
      state.statusCode = code;
    },
    get statusCode() {
      return state.statusCode;
    },
    status(code: number) {
      if (code < 100 || code > 999) {
        throw new RangeError(`Invalid status code: ${code}. Status code must be greater than 99 and less than 1000.`);
      }
      state.statusCode = code;
      return response;
    },
    json(body: unknown) {
      state.ended = JSON.stringify(body); // BigInt 등이면 여기서 던진다
      state.body = body;
      return response;
    },
    setHeader(name: string, value: string) {
      if (options.setHeaderThrows) {
        throw new Error('setHeader failed');
      }
      state.headers[name] = value;
    },
    end(chunk?: string) {
      state.endCalls += 1;
      if (options.endThrows) {
        throw new Error('end failed');
      }
      state.ended = chunk;
    },
    destroy() {
      if (options.destroyThrows) {
        throw new Error('destroy failed');
      }
      state.destroyed = true;
    },
  };
  return { response, state };
}

function setup(responseOptions: ResponseOptions = {}, logger = { error: vi.fn(), warn: vi.fn() }) {
  const { response, state } = createResponse(responseOptions);
  const request = { method: 'POST', originalUrl: '/songs/5?token=QUERY_SECRET_VALUE' } as unknown as Request;
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ArgumentsHost;
  const filter = new AllExceptionsFilter(logger);
  return { run: (exception: unknown) => filter.catch(exception, host), state, logger };
}

const hostileObject = () =>
  new Proxy(
    {},
    {
      get() {
        throw new Error('trap');
      },
      getPrototypeOf() {
        throw new Error('trap');
      },
    },
  );

describe('AllExceptionsFilter — 응답 작성이 실패해도 던지지 않고 최소 응답으로 끝난다', () => {
  it('범위 밖 상태코드(HttpException 1000): 500 미리 만든 본문으로 응답하고 원인을 한 줄 남긴다', () => {
    const { run, state, logger } = setup();

    expect(() => run(new HttpException('x', 1000))).not.toThrow();

    expect(state.statusCode).toBe(500);
    expect(state.headers['Content-Type']).toBe('application/json; charset=utf-8');
    expect(JSON.parse(state.ended as string)).toEqual(INTERNAL_BODY);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect((logger.error.mock.calls[0][0] as string).startsWith('응답 작성 실패: RangeError (원본: HttpException) POST /songs/5')).toBe(true);
  });

  it('직렬화할 수 없는 값(BigInt)이 든 HttpException: 500 최소 응답', () => {
    const { run, state, logger } = setup();

    expect(() => run(new HttpException({ message: 'm', id: 10n }, 400))).not.toThrow();

    expect(state.statusCode).toBe(500);
    expect(JSON.parse(state.ended as string)).toEqual(INTERNAL_BODY);
    expect((logger.error.mock.calls[0][0] as string).startsWith('응답 작성 실패: TypeError (원본: HttpException)')).toBe(true);
  });

  it('응답을 결정하는 단계에서 던지는 예외 객체(Proxy)도 최소 응답으로 끝난다', () => {
    const { run, state, logger } = setup();

    expect(() => run(hostileObject())).not.toThrow();

    expect(state.statusCode).toBe(500);
    expect(JSON.parse(state.ended as string)).toEqual(INTERNAL_BODY);
    expect((logger.error.mock.calls[0][0] as string).startsWith('응답 작성 실패: Error (원본: UnknownError)')).toBe(true);
  });

  it('최소 응답 본문은 요청 값을 담지 않는다 (쿼리스트링·경로 미포함)', () => {
    const { run, state, logger } = setup();

    run(new HttpException('x', 1000));

    expect(state.ended).not.toContain('QUERY_SECRET_VALUE');
    expect(state.ended).not.toContain('songs');
    // 로그도 쿼리스트링을 남기지 않는다
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('QUERY_SECRET_VALUE');
  });

  it('fallback의 헤더 설정이 실패하면 연결을 끊는다 (응답 없이 매달리지 않게)', () => {
    const { run, state } = setup({ setHeaderThrows: true });

    expect(() => run(new HttpException('x', 1000))).not.toThrow();

    expect(state.destroyed).toBe(true);
  });

  it('연결을 끊는 것까지 실패해도 던지지 않는다', () => {
    const { run } = setup({ setHeaderThrows: true, destroyThrows: true });

    expect(() => run(new HttpException('x', 1000))).not.toThrow();
  });

  it('이미 헤더가 나간 응답에서 end()가 던져도 던지지 않고 연결을 끊는다', () => {
    const { run, state } = setup({ headersSent: true, endThrows: true });

    expect(() => run(new Error('x'))).not.toThrow();

    expect(state.destroyed).toBe(true);
  });

  it('원인 로깅이 실패해도 최소 응답은 나간다', () => {
    const logger = {
      error: vi.fn(() => {
        throw new Error('logger down');
      }),
      warn: vi.fn(),
    };
    const { run, state } = setup({}, logger);

    expect(() => run(new HttpException('x', 1000))).not.toThrow();

    expect(state.statusCode).toBe(500);
    expect(JSON.parse(state.ended as string)).toEqual(INTERNAL_BODY);
  });
});

describe('AllExceptionsFilter — 로깅 실패가 정상적으로 결정한 응답을 바꾸지 않는다', () => {
  it('예외 로그를 남기다 던져도 원래 결정한 500 응답이 그대로 나간다 (fallback으로 대체되지 않는다)', () => {
    const logger = {
      error: vi.fn(() => {
        throw new Error('logger down');
      }),
      warn: vi.fn(),
    };
    const { run, state } = setup({}, logger);

    expect(() => run(new Error('MESSAGE_SECRET_VALUE'))).not.toThrow();

    expect(state.statusCode).toBe(500);
    // json()으로 나간 것이지 fallback(end)이 아니다
    expect(state.body).toEqual(INTERNAL_BODY);
    expect(state.headers['Content-Type']).toBeUndefined();
    expect(state.endCalls).toBe(0);
  });

  it('정상 경로는 fallback을 타지 않는다', () => {
    const { run, state, logger } = setup();

    run(new HttpException('찾을 수 없습니다.', 404));

    expect(state.statusCode).toBe(404);
    expect(state.body).toEqual({ message: '찾을 수 없습니다.', error: 'Not Found', statusCode: 404 });
    expect(logger.error).not.toHaveBeenCalled();
    expect(state.endCalls).toBe(0);
  });
});
