import 'reflect-metadata';
import { Controller, Get, HttpCode, Post, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthController } from '../auth/auth.controller.js';
import { IS_PUBLIC_KEY } from '../auth/public.decorator.js';
import { HealthController } from '../health/health.controller.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AppThrottlerGuard,
  createThrottlerOptions,
  type ThrottleOverrides,
} from './app-throttler.guard.js';
import { LOGIN_THROTTLE_KEY, LoginThrottle } from './login-throttle.decorator.js';
import { DEFAULT_THROTTLE, LOGIN_THROTTLE, THROTTLED_MESSAGE } from './throttling.constants.js';

/**
 * 실제 Nest 앱으로 요청 제한을 검증한다. DB에는 붙지 않는다.
 * 운영 상수(5회/5분, 300회/분)는 별도 테스트로 고정하고, 동작 검증은 창을 줄인 설정으로 돌린다.
 */
@Controller()
class ProbeController {
  @LoginThrottle()
  @Post('login')
  @HttpCode(200)
  login() {
    return { ok: true };
  }

  @Get('other')
  other() {
    return { ok: true };
  }
}

const count = async () => 0;
const PRISMA_STUB = { lineUp: { count }, setlist: { count }, adminUser: { count } };

let app: INestApplication | undefined;

async function createApp(options: {
  overrides?: ThrottleOverrides;
  trustProxy?: number | false;
  withHealth?: boolean;
}): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [ThrottlerModule.forRoot(createThrottlerOptions(options.overrides))],
    controllers: options.withHealth ? [ProbeController, HealthController] : [ProbeController],
    providers: [
      { provide: APP_GUARD, useClass: AppThrottlerGuard },
      // 헬스 컨트롤러가 요구하는 의존성. 제한 제외만 보므로 값은 의미 없다.
      { provide: PrismaService, useValue: PRISMA_STUB },
      { provide: ConfigService, useValue: { get: () => undefined } },
    ],
  }).compile();

  const created = moduleRef.createNestApplication<NestExpressApplication>();
  created.set('trust proxy', options.trustProxy ?? false);
  await created.init();
  app = created;
  return created;
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

const SMALL = {
  default: { limit: 4, ttlMs: 60_000 },
  login: { limit: 2, ttlMs: 60_000, blockMs: 60_000 },
} satisfies ThrottleOverrides;

const login = (server: INestApplication, ip?: string) => {
  const req = request(server.getHttpServer()).post('/login');
  return ip ? req.set('X-Forwarded-For', ip) : req;
};

const getOther = (server: INestApplication) => request(server.getHttpServer()).get('/other');

describe('운영 상수 고정', () => {
  it('로그인은 5분에 5회, 초과하면 15분 차단이다', () => {
    expect(LOGIN_THROTTLE).toEqual({ limit: 5, ttlMs: 300_000, blockMs: 900_000 });
  });

  it('기본은 IP당 분당 300회다', () => {
    expect(DEFAULT_THROTTLE).toEqual({ limit: 300, ttlMs: 60_000 });
  });

  it('createThrottlerOptions() 기본값이 상수를 그대로 쓴다', () => {
    const options = createThrottlerOptions();
    const throttlers = Array.isArray(options) ? options : options.throttlers;

    expect(throttlers.map((t) => [t.name, t.limit, t.ttl, t.blockDuration])).toEqual([
      ['default', 300, 60_000, undefined],
      ['login', 5, 300_000, 900_000],
    ]);
  });
});

describe('로그인 요청 제한', () => {
  it('한도까지는 통과하고, 그다음 요청부터 429다 (limit=N이면 N+1번째가 차단)', async () => {
    const server = await createApp({ overrides: SMALL });

    await login(server).expect(200);
    await login(server).expect(200);
    await login(server).expect(429);
  });

  it('429는 {message, error, statusCode} 한국어 계약이고 Retry-After가 있다', async () => {
    const server = await createApp({ overrides: SMALL });
    await login(server);
    await login(server);

    const res = await login(server).expect(429);

    expect(res.body).toEqual({
      message: THROTTLED_MESSAGE,
      error: 'Too Many Requests',
      statusCode: 429,
    });
    expect(Number(res.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    expect(Number(res.headers['retry-after'])).toBeLessThanOrEqual(60);
  });

  it('성공 응답과 429 응답 모두에 X-RateLimit-* 헤더가 없다 (남은 횟수를 알려 주지 않는다)', async () => {
    const server = await createApp({ overrides: SMALL });

    const ok = await login(server).expect(200);
    await login(server);
    const blocked = await login(server).expect(429);

    for (const res of [ok, blocked]) {
      const leaked = Object.keys(res.headers).filter((h) => h.startsWith('x-ratelimit'));
      expect(leaked).toEqual([]);
    }
  });

  it('로그인이 차단돼도 같은 IP의 다른 라우트는 영향받지 않는다', async () => {
    const server = await createApp({ overrides: SMALL });
    await login(server);
    await login(server);
    await login(server).expect(429);

    await getOther(server).expect(200);
  });

  it('일반 라우트 한도를 다 써도 로그인 카운트는 줄지 않는다 (두 throttler가 배타적)', async () => {
    const server = await createApp({ overrides: SMALL });
    for (let i = 0; i < SMALL.default.limit; i += 1) {
      await getOther(server).expect(200);
    }
    await getOther(server).expect(429);

    await login(server).expect(200);
    await login(server).expect(200);
    await login(server).expect(429);
  });

  it('차단 시간이 지나면 다시 통과한다 (창 경과 후 회복)', async () => {
    const server = await createApp({
      overrides: { login: { limit: 2, ttlMs: 250, blockMs: 400 } },
    });
    await login(server);
    await login(server);
    await login(server).expect(429);

    await new Promise((resolve) => setTimeout(resolve, 700));

    await login(server).expect(200);
  });
});

describe('일반 라우트 요청 제한', () => {
  it('한도 초과는 429이고 X-RateLimit-*와 Retry-After를 낸다', async () => {
    const server = await createApp({ overrides: SMALL });

    const first = await getOther(server).expect(200);
    expect(first.headers['x-ratelimit-limit']).toBe(String(SMALL.default.limit));
    expect(first.headers['x-ratelimit-remaining']).toBe(String(SMALL.default.limit - 1));

    for (let i = 1; i < SMALL.default.limit; i += 1) {
      await getOther(server).expect(200);
    }
    const blocked = await getOther(server).expect(429);

    expect(blocked.body).toEqual({
      message: THROTTLED_MESSAGE,
      error: 'Too Many Requests',
      statusCode: 429,
    });
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThanOrEqual(1);
  });
});

describe('클라이언트 IP 식별 (trust proxy)', () => {
  it('기본(믿지 않음)에서는 X-Forwarded-For를 바꿔도 한도를 피할 수 없다', async () => {
    const server = await createApp({ overrides: SMALL, trustProxy: false });

    await login(server, '203.0.113.1').expect(200);
    await login(server, '203.0.113.2').expect(200);
    // IP를 위조해도 같은 소켓 주소로 센다
    await login(server, '203.0.113.3').expect(429);
  });

  it('프록시 1단을 믿으면 X-Forwarded-For가 다른 클라이언트는 따로 센다', async () => {
    const server = await createApp({ overrides: SMALL, trustProxy: 1 });

    await login(server, '203.0.113.1').expect(200);
    await login(server, '203.0.113.1').expect(200);
    await login(server, '203.0.113.1').expect(429);

    // 다른 클라이언트는 영향받지 않는다
    await login(server, '203.0.113.2').expect(200);
  });
});

describe('헬스체크 제외', () => {
  it('@SkipThrottle()이 붙은 HealthController는 기본 한도를 넘겨도 429가 아니다', async () => {
    const server = await createApp({ overrides: SMALL, withHealth: true });

    for (let i = 0; i < SMALL.default.limit * 3; i += 1) {
      await request(server.getHttpServer()).get('/health').expect(200);
    }
  });
});

describe('실제 라우트 표시', () => {
  it('AuthController.login에 @LoginThrottle()이 붙어 있고 여전히 @Public()이다', () => {
    expect(Reflect.getMetadata(LOGIN_THROTTLE_KEY, AuthController.prototype.login)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.login)).toBe(true);
  });

  it('AuthController.me에는 @LoginThrottle()이 없다 (로그인만 엄격하게)', () => {
    expect(Reflect.getMetadata(LOGIN_THROTTLE_KEY, AuthController.prototype.me)).toBeUndefined();
  });
});
