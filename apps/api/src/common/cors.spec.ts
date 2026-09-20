import 'reflect-metadata';
import { Controller, Get, Post, type INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { configureHttp } from '../app.setup.js';
import { buildCorsOptions, parseCorsAllowedOrigins } from './cors.js';

describe('parseCorsAllowedOrigins — 기동 시 검증', () => {
  it.each([
    ['미설정', undefined],
    ['빈 문자열', ''],
    ['공백만', '   '],
    ['콤마만', ' , ,'],
  ])('%s이면 빈 목록이다 (= 크로스 오리진 전부 거부, fail-closed)', (_label, raw) => {
    expect(parseCorsAllowedOrigins(raw)).toEqual([]);
  });

  it('콤마로 구분한 여러 오리진을 순서대로 읽고 공백을 무시한다', () => {
    expect(
      parseCorsAllowedOrigins(' https://admin.example.com , http://localhost:3010,\r\n'),
    ).toEqual(['https://admin.example.com', 'http://localhost:3010']);
  });

  it('중복은 하나로 합친다', () => {
    expect(parseCorsAllowedOrigins('http://localhost:3010,http://localhost:3010')).toEqual([
      'http://localhost:3010',
    ]);
  });

  it.each([
    ['와일드카드', '*'],
    ['와일드카드가 섞인 서브도메인', 'https://*.example.com'],
    ['null 오리진', 'null'],
    ['스킴 없음', 'admin.example.com'],
    ['스킴 없이 포트만', 'localhost:3010'],
    ['http/https가 아닌 스킴', 'ftp://example.com'],
    ['끝 슬래시', 'https://admin.example.com/'],
    ['경로', 'https://admin.example.com/app'],
    ['쿼리', 'https://admin.example.com?x=1'],
    ['기본 포트 명시(브라우저는 Origin에 기본 포트를 붙이지 않는다)', 'https://admin.example.com:443'],
    ['대문자 호스트', 'https://ADMIN.example.com'],
    ['사용자 정보', 'https://user:pass@admin.example.com'],
  ])('%s는 기동을 막는다', (_label, raw) => {
    expect(() => parseCorsAllowedOrigins(raw)).toThrow();
  });

  it('항목 하나만 잘못돼도 전체가 실패한다 (일부만 적용되어 조용히 넘어가지 않는다)', () => {
    expect(() =>
      parseCorsAllowedOrigins('https://admin.example.com,https://admin.example.com/'),
    ).toThrow('2번째 항목');
  });

  it('와일드카드 오류는 이유를 말해 준다', () => {
    expect(() => parseCorsAllowedOrigins('*')).toThrow('와일드카드');
  });

  it('정규형이 아닌 항목은 이유 범주를 알려 준다 (값을 되돌려 주지 않는다)', () => {
    expect(() => parseCorsAllowedOrigins('https://admin.example.com/')).toThrow('정규형이 아닙니다');
  });
});

describe('parseCorsAllowedOrigins — http는 루프백만 (교차 리뷰 L8)', () => {
  it.each([
    'http://localhost:3010',
    'http://localhost',
    'http://127.0.0.1:3010',
    'http://127.0.0.2:3010',
    'http://[::1]:3010',
  ])('%s는 허용한다', (origin) => {
    expect(parseCorsAllowedOrigins(origin)).toEqual([origin]);
  });

  it.each([
    'http://admin.example.com',
    'http://10.0.0.5:3010',
    'http://192.168.0.2:3010',
    'http://0.0.0.0:3010',
    'http://[::2]:3010',
    'http://localhost.evil.com',
    'http://127.0.0.1.evil.com',
    'http://mylocalhost',
    'http://172.16.0.1',
  ])('%s는 기동을 막는다 (평문 오리진은 토큰 탈취 경로가 된다)', (origin) => {
    expect(() => parseCorsAllowedOrigins(origin)).toThrow('루프백');
  });

  it('https는 루프백이 아니어도 허용한다', () => {
    expect(parseCorsAllowedOrigins('https://admin.example.com,https://localhost:3010')).toEqual([
      'https://admin.example.com',
      'https://localhost:3010',
    ]);
  });

  it('http 루프백과 https 운영 오리진을 함께 쓸 수 있다', () => {
    expect(parseCorsAllowedOrigins('http://localhost:3010,https://admin.example.com')).toEqual([
      'http://localhost:3010',
      'https://admin.example.com',
    ]);
  });
});

describe('parseCorsAllowedOrigins — 오류 메시지에 입력 값을 출력하지 않는다 (교차 리뷰 L10)', () => {
  // ECHOMARK는 입력에만 있는 표식이다. 메시지에 나오면 입력이 되돌려진 것이다.
  it.each([
    ['와일드카드', '*ECHOMARK'],
    ['오리진 형식 아님', 'ECHOMARK'],
    ['스킴 없음', 'ECHOMARK.example.com'],
    ['http/https 아님', 'ftp://ECHOMARK.example.com'],
    ['자격증명 포함(비밀번호)', 'https://user:ECHOMARKPW@admin.example.com'],
    ['자격증명 포함(사용자만)', 'https://ECHOMARKUSER@admin.example.com'],
    ['끝 슬래시', 'https://ECHOMARK.example.com/'],
    ['경로', 'https://admin.example.com/ECHOMARK'],
    ['쿼리', 'https://admin.example.com?x=ECHOMARK'],
    ['기본 포트', 'https://ECHOMARK.example.com:443'],
    ['대문자', 'HTTPS://ECHOMARK.EXAMPLE.COM'],
    ['비루프백 http', 'http://ECHOMARK.example.com'],
    ['null', 'null-ECHOMARK'],
  ])('%s: 메시지에 입력이 없고 항목 위치가 있다', (_label, input) => {
    let message = '';
    try {
      parseCorsAllowedOrigins(input);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).not.toBe('');
    expect(message).not.toMatch(/ECHOMARK/i);
    expect(message).not.toContain('user:');
    expect(message).toContain('1번째 항목');
  });

  it('자격증명 항목의 이유는 알려 주되 값은 알려 주지 않는다', () => {
    expect(() => parseCorsAllowedOrigins('https://user:ECHOMARKPW@admin.example.com')).toThrow('자격증명');
  });

  it('항목 위치는 빈 항목을 뺀 순서다', () => {
    expect(() => parseCorsAllowedOrigins('https://a.example.com, ,,https://b.example.com/')).toThrow('2번째 항목');
  });
});

describe('buildCorsOptions — 결정 사항 고정', () => {
  it('credentials=false, 허용 메서드·헤더, preflight 캐시 600초, Retry-After 노출', () => {
    expect(buildCorsOptions(['http://localhost:3010'])).toEqual({
      origin: ['http://localhost:3010'],
      credentials: false,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type'],
      exposedHeaders: ['Retry-After'],
      maxAge: 600,
    });
  });

  it('DELETE는 허용하지 않는다 (PRD에서 삭제 기능 제외)', () => {
    expect(buildCorsOptions([]).methods).not.toContain('DELETE');
  });

  it('허용 목록이 비어도 origin은 falsy가 아니라 빈 배열이다 (cors는 falsy면 미들웨어를 건너뛴다)', () => {
    expect(buildCorsOptions([]).origin).toEqual([]);
  });
});

@Controller()
class EchoController {
  @Get('ping')
  ping() {
    return { ok: true };
  }

  @Post('ping')
  pong() {
    return { ok: true };
  }
}

const ALLOWED = 'https://admin.example.com';
const LOCAL = 'http://localhost:3010';
const EVIL = 'https://evil.example';

let app: NestExpressApplication | undefined;

async function createApp(origins: string[]): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({ controllers: [EchoController] }).compile();
  const created = moduleRef.createNestApplication<NestExpressApplication>();
  // main.ts와 같은 함수를 그대로 쓴다 — 설정을 복사해 흉내 내지 않는다
  configureHttp(created, { trustProxyHops: 0, corsAllowedOrigins: origins });
  await created.init();
  app = created;
  return created;
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

const preflight = (server: INestApplication, origin: string, method = 'POST', headers = 'authorization,content-type') =>
  request(server.getHttpServer())
    .options('/ping')
    .set('Origin', origin)
    .set('Access-Control-Request-Method', method)
    .set('Access-Control-Request-Headers', headers);

describe('실제 앱의 CORS 동작', () => {
  it('허용 오리진의 실제 요청에는 그 오리진을 그대로 돌려준다 (와일드카드 아님)', async () => {
    const server = await createApp([ALLOWED, LOCAL]);

    const res = await request(server.getHttpServer()).get('/ping').set('Origin', LOCAL).expect(200);

    expect(res.headers['access-control-allow-origin']).toBe(LOCAL);
    expect(res.headers['vary']).toContain('Origin');
  });

  it('credentials는 허용하지 않는다 (Access-Control-Allow-Credentials 없음)', async () => {
    const server = await createApp([ALLOWED]);

    const res = await request(server.getHttpServer()).get('/ping').set('Origin', ALLOWED);
    const pre = await preflight(server, ALLOWED);

    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    expect(pre.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('Retry-After를 브라우저에 노출한다', async () => {
    const server = await createApp([ALLOWED]);

    const res = await request(server.getHttpServer()).get('/ping').set('Origin', ALLOWED);

    expect(res.headers['access-control-expose-headers']).toBe('Retry-After');
  });

  it('허용되지 않은 오리진에는 Access-Control-Allow-Origin을 주지 않는다', async () => {
    const server = await createApp([ALLOWED]);

    const res = await request(server.getHttpServer()).get('/ping').set('Origin', EVIL);

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('허용 오리진의 preflight: 204와 허용 메서드·헤더·캐시 시간을 돌려준다', async () => {
    const server = await createApp([ALLOWED]);

    const res = await preflight(server, ALLOWED).expect(204);

    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(res.headers['access-control-allow-methods']).toBe('GET,POST,PATCH,PUT,OPTIONS');
    expect(res.headers['access-control-allow-headers']).toBe('Authorization,Content-Type');
    expect(res.headers['access-control-max-age']).toBe('600');
  });

  it('허용되지 않은 오리진의 preflight에는 허용 헤더를 주지 않는다', async () => {
    const server = await createApp([ALLOWED]);

    const res = await preflight(server, EVIL);

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('허용 목록에 있어도 DELETE preflight는 메서드 허용 목록에 DELETE가 없다', async () => {
    const server = await createApp([ALLOWED]);

    const res = await preflight(server, ALLOWED, 'DELETE');

    expect(res.headers['access-control-allow-methods']).not.toContain('DELETE');
  });

  it('CORS_ALLOWED_ORIGINS 미설정(빈 목록)이면 어떤 오리진도 허용하지 않는다 (fail-closed)', async () => {
    const server = await createApp([]);

    for (const origin of [ALLOWED, LOCAL, EVIL, 'null']) {
      const actual = await request(server.getHttpServer()).get('/ping').set('Origin', origin);
      const pre = await preflight(server, origin);

      expect(actual.headers['access-control-allow-origin']).toBeUndefined();
      expect(pre.headers['access-control-allow-origin']).toBeUndefined();
    }
  });

  it('빈 목록이어도 Origin 헤더가 없는 요청(서버 간 호출·같은 오리진)은 정상 동작한다', async () => {
    const server = await createApp([]);

    await request(server.getHttpServer()).get('/ping').expect(200);
  });

  it('목록에 있는 오리진을 대소문자·끝 슬래시만 바꿔 보내도 허용하지 않는다', async () => {
    const server = await createApp([ALLOWED]);

    for (const origin of ['https://ADMIN.example.com', `${ALLOWED}/`, 'http://admin.example.com']) {
      const res = await request(server.getHttpServer()).get('/ping').set('Origin', origin);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    }
  });
});

describe('configureHttp — 응답 헤더', () => {
  it('x-powered-by를 내보내지 않는다', async () => {
    const server = await createApp([]);

    const res = await request(server.getHttpServer()).get('/ping').expect(200);

    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
