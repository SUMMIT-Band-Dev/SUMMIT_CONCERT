import 'reflect-metadata';
import {
  Body,
  ConflictException,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  UseFilters,
} from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { IsNotEmpty, IsString } from 'class-validator';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { OutboundRateLimitFilter } from '../album-cover/outbound-rate-limit.filter.js';
import { OutboundRateLimitException } from '../album-cover/outbound-rate-limiter.js';
import { configureHttp, createHttpAdapter } from '../app.setup.js';
import {
  BODY_TOO_LARGE_MESSAGE,
  INTERNAL_ERROR_MESSAGE,
  INVALID_BODY_MESSAGE,
  INVALID_URL_MESSAGE,
  ROUTE_NOT_FOUND_MESSAGE,
  UNSUPPORTED_ENCODING_MESSAGE,
} from './http-messages.js';
import { ParseBigIntPipe } from './parse-bigint.pipe.js';

/**
 * 오류 응답 계약을 **실제 Nest 앱**으로 확인한다. 운영과 같은 어댑터·`configureHttp`를 그대로 쓴다.
 *
 * 단위 테스트로는 볼 수 없는 것들이다:
 * - 깨진 JSON이 필터에 도착하기 전에 `SyntaxError → BadRequestException(원본 메시지)`로 바뀌는 경로
 * - 미지정 라우트의 404 핸들러, Express의 경로 파라미터 디코딩 오류
 * - 컨트롤러에 붙은 `@UseFilters()`와 전역 필터의 공존
 */
class EchoDto {
  @IsString({ message: '값은 문자열이어야 합니다.' })
  @IsNotEmpty({ message: '값을 입력해 주세요.' })
  value!: string;
}

/** 실제 Prisma 오류와 같은 모양(클래스명·code·메시지에 값이 실림) */
class PrismaClientKnownRequestError extends Error {
  code = 'P2002';
  constructor() {
    super('Invalid `prisma.song.create()` invocation: title = "PRISMA_SECRET_VALUE"');
  }
}

@Controller()
class ProbeController {
  @Post('echo')
  echo(@Body() dto: EchoDto) {
    return { value: dto.value };
  }

  @Get('teams/:id')
  team(@Param('id', ParseBigIntPipe) id: bigint) {
    return { id: id.toString() };
  }

  @Get('conflict')
  conflict() {
    throw new ConflictException('이미 존재하는 항목입니다.');
  }

  @Get('boom')
  boom() {
    throw new Error('BOOM_SECRET_VALUE at db-host-does-not-exist.invalid');
  }

  @Get('typeerr')
  typeerr() {
    // 진짜 TypeError를 만든다: 코드 버그(undefined 접근)의 전형
    const song = undefined as { title: string } | undefined;
    return song!.title.length;
  }

  @Get('prisma')
  prisma() {
    throw new PrismaClientKnownRequestError();
  }

  // 앨범 커버 컨트롤러와 같은 방식: 컨트롤러 범위 필터가 전역 필터보다 먼저 이 예외를 잡는다
  @UseFilters(OutboundRateLimitFilter)
  @Get('limited')
  limited() {
    throw new OutboundRateLimitException(7);
  }
}

let app: NestExpressApplication;
let errorLog: ReturnType<typeof vi.spyOn>;
let warnLog: ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile();
  app = moduleRef.createNestApplication<NestExpressApplication>(createHttpAdapter());
  configureHttp(app, { trustProxyHops: 0, corsAllowedOrigins: [] });
  await app.init();
});

afterAll(async () => {
  await app?.close();
});

beforeEach(() => {
  errorLog = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  warnLog = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  // 같은 스파이가 재사용되므로 호출 기록을 테스트마다 비운다(비우지 않으면 앞선 테스트의 호출이 섞인다)
  errorLog.mockClear();
  warnLog.mockClear();
});

const server = () => app.getHttpServer();
const json = (body: string) =>
  request(server()).post('/echo').set('Content-Type', 'application/json').send(body);

describe('깨진 JSON — 본문이 응답으로 되돌아가지 않는다', () => {
  // 실측: 기존에는 `Unexpected token 'P', "PASSWORD_L"... is not valid JSON`처럼 본문 앞 10자가 에코됐다
  it.each([
    ['따옴표 없는 토큰으로 시작', 'PASSWORD_LEAK_MARKER_abcdef1234567890'],
    ['배열 안 잘못된 토큰', '[SECRET_TOKEN_IN_BODY_99]'],
    ['미종료 문자열', '{"username":"admin","password":"LEAK_MARKER_XYZ'],
    ['객체 안 쉼표 오류', '{"username":"admin","password":"LEAK_MARKER_PW",,}'],
  ])('%s → 400 고정 문구', async (_label, body) => {
    const res = await json(body).expect(400);

    expect(res.body).toEqual({
      message: INVALID_BODY_MESSAGE,
      error: 'Bad Request',
      statusCode: 400,
    });
    expect(res.text).not.toMatch(/LEAK_MARKER|SECRET_TOKEN|PASSWORD_L|Unexpected|position|JSON/);
  });

  it('파서 오류는 서버 로그에도 남기지 않는다 (HttpException으로 변환돼 도착)', async () => {
    await json('PASSWORD_LEAK_MARKER').expect(400);

    expect(errorLog).not.toHaveBeenCalled();
    expect(warnLog).not.toHaveBeenCalled();
  });
});

describe('본문 파서의 그 밖의 오류', () => {
  it('본문이 너무 크면 413이고 {message, error, statusCode}를 갖는다 (기존에는 error가 없었다)', async () => {
    const res = await json(JSON.stringify({ value: 'a'.repeat(200_000) })).expect(413);

    expect(res.body).toEqual({
      message: BODY_TOO_LARGE_MESSAGE,
      error: 'Payload Too Large',
      statusCode: 413,
    });
  });

  it('지원하지 않는 charset(utf-로 시작하지 않는 것)은 415 고정 문구다 (charset 이름이 응답에 실리지 않는다)', async () => {
    const res = await request(server())
      .post('/echo')
      .set('Content-Type', 'application/json; charset=iso-8859-1')
      .send('{"value":"x"}')
      .expect(415);

    expect(res.body).toEqual({
      message: UNSUPPORTED_ENCODING_MESSAGE,
      error: 'Unsupported Media Type',
      statusCode: 415,
    });
    expect(res.text.toLowerCase()).not.toContain('iso-8859-1');
  });

  it('경로 파라미터의 잘못된 퍼센트 인코딩은 400 고정 문구다 (값이 응답에 실리지 않는다)', async () => {
    const res = await request(server()).get('/teams/%E0%A4%A_PARAM_LEAK').expect(400);

    expect(res.body).toEqual({
      message: INVALID_URL_MESSAGE,
      error: 'Bad Request',
      statusCode: 400,
    });
    expect(res.text).not.toContain('PARAM_LEAK');
  });
});

describe('미지정 라우트 404 — 경로를 되돌려 주지 않는다', () => {
  it.each([
    ['GET', '/nope'],
    ['GET', '/nope?token=QUERY_SECRET_VALUE'],
    ['POST', '/nope/deeper'],
    ['PATCH', '/nope'],
  ])('%s %s', async (method, path) => {
    const res = await request(server())[method.toLowerCase() as 'get'](path).expect(404);

    expect(res.body).toEqual({
      message: ROUTE_NOT_FOUND_MESSAGE,
      error: 'Not Found',
      statusCode: 404,
    });
    expect(res.text).not.toMatch(/nope|QUERY_SECRET_VALUE|Cannot/);
  });
});

describe('기존 응답 계약 회귀 (전역 필터를 거쳐도 그대로)', () => {
  it('ValidationPipe 400: message 배열 그대로', async () => {
    const res = await json(JSON.stringify({ value: '' })).expect(400);

    expect(res.body).toEqual({
      message: ['값을 입력해 주세요.'],
      error: 'Bad Request',
      statusCode: 400,
    });
  });

  it('DTO에 없는 필드: 400', async () => {
    const res = await json(JSON.stringify({ value: 'ok', extra: 1 })).expect(400);

    expect(res.body).toEqual({
      message: ['property extra should not exist'],
      error: 'Bad Request',
      statusCode: 400,
    });
  });

  it('ParseBigIntPipe 400', async () => {
    const res = await request(server()).get('/teams/abc').expect(400);

    expect(res.body).toEqual({
      message: 'id는 1 이상의 정수여야 합니다.',
      error: 'Bad Request',
      statusCode: 400,
    });
  });

  it('정상 요청은 영향받지 않는다', async () => {
    await json(JSON.stringify({ value: 'ok' })).expect(201);
    await request(server()).get('/teams/12').expect(200, { id: '12' });
  });

  it('409 (ConflictException)', async () => {
    const res = await request(server()).get('/conflict').expect(409);

    expect(res.body).toEqual({
      message: '이미 존재하는 항목입니다.',
      error: 'Conflict',
      statusCode: 409,
    });
  });

  it('컨트롤러 범위 필터(@UseFilters)가 전역 필터보다 먼저 잡는다 — Retry-After가 유지된다', async () => {
    const res = await request(server()).get('/limited').expect(429);

    expect(res.headers['retry-after']).toBe('7');
    expect(res.body.statusCode).toBe(429);
    expect(res.body.error).toBe('Too Many Requests');
    expect(typeof res.body.message).toBe('string');
  });
});

describe('알 수 없는 오류 — 500 고정 문구, 로그에는 식별자만', () => {
  it('일반 Error: 응답에 원본 메시지가 없고 로그는 한 줄이다', async () => {
    const res = await request(server()).get('/boom?token=QUERY_SECRET_VALUE').expect(500);

    expect(res.body).toEqual({
      message: INTERNAL_ERROR_MESSAGE,
      error: 'Internal Server Error',
      statusCode: 500,
    });
    expect(res.text).not.toMatch(/BOOM_SECRET_VALUE|db-host-does-not-exist/);

    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(errorLog).toHaveBeenCalledWith('예외 처리: Error GET /boom → 500');
  });

  it('진짜 TypeError(코드 버그): 응답은 고정 문구이고 로그에는 메시지와 프로젝트 상대 경로 위치가 남는다', async () => {
    const res = await request(server()).get('/typeerr?token=QUERY_SECRET_VALUE').expect(500);

    expect(res.body).toEqual({
      message: INTERNAL_ERROR_MESSAGE,
      error: 'Internal Server Error',
      statusCode: 500,
    });
    expect(res.text).not.toContain('title');

    expect(errorLog).toHaveBeenCalledTimes(1);
    const line = errorLog.mock.calls[0][0] as string;
    expect(line).toContain("예외 처리: TypeError GET /typeerr → 500 | 메시지: Cannot read properties of undefined (reading 'title') | 위치: ");
    expect(line).toContain('src/common/http-error-contract.spec.ts');
    expect(line).not.toContain('QUERY_SECRET_VALUE');
    expect(line).not.toMatch(/[A-Za-z]:[\\/]/);
  });

  it('Prisma 오류: 응답·로그 모두에 메시지가 없고 code만 남는다', async () => {
    const res = await request(server()).get('/prisma').expect(500);

    expect(res.body.message).toBe(INTERNAL_ERROR_MESSAGE);
    expect(res.text).not.toContain('PRISMA_SECRET_VALUE');
    expect(errorLog).toHaveBeenCalledWith(
      '예외 처리: PrismaClientKnownRequestError(code=P2002) GET /prisma → 500',
    );
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('PRISMA_SECRET_VALUE');
  });
});
