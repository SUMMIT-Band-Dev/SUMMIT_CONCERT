import 'reflect-metadata';
import {
  Controller,
  Get,
  Global,
  HttpException,
  Module,
  UnauthorizedException,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../app.module.js';
import { configureHttp, createHttpAdapter } from '../app.setup.js';
import { Public } from '../auth/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DEFAULT_THROTTLE } from '../throttling/throttling.constants.js';
import { GlobalGuard } from './global.guard.js';
import { GlobalGuardsModule } from './global-guards.module.js';

/**
 * 전역 Guard 순서 회귀: **요청 제한 → 인증**.
 *
 * 순서가 뒤집히면(인증이 먼저) 토큰 없는 요청은 언제나 401에서 끝나 요청 제한에 세어지지 않는다.
 * 그래서 아래 통합 테스트는 "토큰 없는 요청이 한도를 넘으면 401이 아니라 429"를 요구한다 — 순서가
 * 뒤집히면 이 테스트가 실패한다.
 */

// ── 단위: 호출 순서 ─────────────────────────────────────────────────────────

function createFakes(outcomes: { throttler?: boolean | Error; auth?: boolean | Error } = {}) {
  const calls: string[] = [];
  const make = (name: string, outcome: boolean | Error = true) => ({
    canActivate: vi.fn(async () => {
      calls.push(name);
      if (outcome instanceof Error) {
        throw outcome;
      }
      return outcome;
    }),
  });
  const throttler = make('throttler', outcomes.throttler);
  const auth = make('auth', outcomes.auth);
  const guard = new GlobalGuard(throttler as never, auth as never);
  return { guard, calls, throttler, auth };
}

const context = {} as ExecutionContext;

describe('GlobalGuard — 호출 순서 (단위)', () => {
  it('요청 제한을 먼저, 인증을 나중에 호출한다', async () => {
    const { guard, calls } = createFakes();

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(calls).toEqual(['throttler', 'auth']);
  });

  it('한도 초과(429)로 던져지면 인증은 호출하지 않고 예외를 그대로 올린다', async () => {
    const tooMany = new HttpException('too many', 429);
    const { guard, calls, auth } = createFakes({ throttler: tooMany });

    await expect(guard.canActivate(context)).rejects.toBe(tooMany);

    expect(calls).toEqual(['throttler']);
    expect(auth.canActivate).not.toHaveBeenCalled();
  });

  it('요청 제한이 false를 돌려주면 인증을 호출하지 않고 false다', async () => {
    const { guard, calls } = createFakes({ throttler: false });

    await expect(guard.canActivate(context)).resolves.toBe(false);

    expect(calls).toEqual(['throttler']);
  });

  it('인증의 결과(통과/거부)를 그대로 돌려준다', async () => {
    const denied = new UnauthorizedException('인증이 필요합니다.');

    await expect(createFakes({ auth: false }).guard.canActivate(context)).resolves.toBe(false);
    await expect(createFakes({ auth: denied }).guard.canActivate(context)).rejects.toBe(denied);
  });
});

// ── 통합: 실제 모듈 배선 + 실제 Guard 둘 ──────────────────────────────────────

@Global()
@Module({
  providers: [
    // AuthService.login이 부르는 조회만 흉내 낸다: 계정이 없다
    { provide: PrismaService, useValue: { adminUser: { findUnique: async () => null } } },
  ],
  exports: [PrismaService],
})
class FakePrismaModule {}

@Controller()
class ProbeController {
  @Get('probe')
  probe() {
    return { ok: true };
  }

  @Public()
  @Get('open')
  open() {
    return { ok: true };
  }
}

let app: INestApplication | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function createRealApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [() => ({ JWT_SECRET: 'global-guard-spec-secret-0123456789-abcdefghijklmnop' })],
      }),
      FakePrismaModule,
      GlobalGuardsModule,
    ],
    controllers: [ProbeController],
  }).compile();

  const created = moduleRef.createNestApplication<NestExpressApplication>(createHttpAdapter());
  configureHttp(created, { trustProxyHops: 0, corsAllowedOrigins: [] });
  await created.init();
  app = created;
  return { server: created.getHttpServer(), jwt: moduleRef.get(JwtService) };
}

describe('전역 Guard 순서 (통합, 운영 한도와 실제 JwtAuthGuard)', () => {
  it('토큰 없는 요청은 한도까지 401이고 한도를 넘으면 429다 (인증이 먼저면 영원히 401이라 실패한다)', async () => {
    const { server } = await createRealApp();

    const statuses: number[] = [];
    for (let i = 0; i < DEFAULT_THROTTLE.limit + 3; i += 1) {
      statuses.push((await request(server).get('/probe')).status);
    }

    expect(statuses.slice(0, DEFAULT_THROTTLE.limit).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(DEFAULT_THROTTLE.limit)).toEqual([429, 429, 429]);
  }, 60_000);

  it('위조된 토큰의 요청도 한도에 세어진다', async () => {
    const { server } = await createRealApp();

    for (let i = 0; i < DEFAULT_THROTTLE.limit; i += 1) {
      await request(server).get('/probe').set('Authorization', 'Bearer forged.token.value');
    }

    await request(server)
      .get('/probe')
      .set('Authorization', 'Bearer forged.token.value')
      .expect(429);
  }, 60_000);

  it('한도 안에서는 인증이 그대로 동작한다: 유효한 토큰 200, 토큰 없음 401, 공개 라우트 200', async () => {
    const { server, jwt } = await createRealApp();
    const token = jwt.sign({ sub: '1' });

    await request(server).get('/probe').set('Authorization', `Bearer ${token}`).expect(200);
    await request(server).get('/probe').expect(401);
    await request(server).get('/open').expect(200);
  });

  it('로그인(@Public)은 인증 없이 통과하되 로그인 전용 한도(6번째 429)를 받는다', async () => {
    const { server } = await createRealApp();
    const attempt = () =>
      request(server).post('/auth/login').send({ username: 'nobody', password: 'irrelevant-1234567890' });

    for (let i = 0; i < 5; i += 1) {
      await attempt().expect(401);
    }

    const blocked = await attempt().expect(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });
});

// ── 구조: APP_GUARD가 이것 하나뿐 ─────────────────────────────────────────────

type ModuleRef = unknown;

/** `@Module()` 메타데이터를 따라 모든 모듈의 provider 선언을 모은다. 동적 모듈(`forRoot` 등)도 따라간다. */
function collectProviders(root: ModuleRef): unknown[] {
  const providers: unknown[] = [];
  const visited = new Set<ModuleRef>();

  const visit = (moduleRef: ModuleRef): void => {
    if (visited.has(moduleRef)) {
      return;
    }
    visited.add(moduleRef);

    const dynamic = moduleRef as { module?: Function; imports?: ModuleRef[]; providers?: unknown[] };
    const moduleClass = (typeof moduleRef === 'function' ? moduleRef : dynamic.module) as Function;
    if (!moduleClass) {
      return;
    }

    providers.push(...(Reflect.getMetadata('providers', moduleClass) ?? []), ...(dynamic.providers ?? []));
    [...(Reflect.getMetadata('imports', moduleClass) ?? []), ...(dynamic.imports ?? [])].forEach(visit);
  };

  visit(root);
  return providers;
}

describe('전역 Guard 등록 구조', () => {
  it('앱 전체에서 APP_GUARD로 등록된 것은 GlobalGuard 하나뿐이다', () => {
    // 다른 곳에서 APP_GUARD를 또 등록하면 그 Guard의 실행 위치가 모듈 스캔 순서에 맡겨진다.
    const registered = collectProviders(AppModule)
      .filter(
        (provider): provider is { provide: unknown; useClass?: Function; useExisting?: Function } =>
          typeof provider === 'object' &&
          provider !== null &&
          (provider as { provide?: unknown }).provide === APP_GUARD,
      )
      .map((provider) => (provider.useClass ?? provider.useExisting)?.name);

    expect(registered).toEqual(['GlobalGuard']);
  });

  it('탐색이 비어 있지 않다 (빈 목록이면 위 검사가 아무것도 검사하지 못한다)', () => {
    expect(collectProviders(AppModule).length).toBeGreaterThan(10);
  });
});
