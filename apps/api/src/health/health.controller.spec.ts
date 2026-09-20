import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { IS_PUBLIC_KEY } from '../auth/public.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

const TEST_SECRET = 'health-spec-secret-not-used-anywhere-else-0123456789';

const prisma = {
  lineUp: { count: vi.fn(async () => 15) },
  setlist: { count: vi.fn(async () => 64) },
  adminUser: { count: vi.fn(async () => 1) },
};

const jwtService = new JwtService({ secret: TEST_SECRET, signOptions: { expiresIn: '10m' } });

let app: INestApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [
      Reflector,
      { provide: PrismaService, useValue: prisma },
      { provide: JwtService, useValue: jwtService },
      // main.ts와 같은 fail-closed 구성. @Public()이 없으면 인증이 필요하다.
      { provide: APP_GUARD, useClass: JwtAuthGuard },
    ],
  }).compile();

  app = moduleRef.createNestApplication();
  await app.init();
});

afterAll(async () => {
  await app?.close();
});

beforeEach(() => {
  prisma.lineUp.count.mockClear();
  prisma.setlist.count.mockClear();
  prisma.adminUser.count.mockClear();
});

describe('GET /health — 공개, 최소 응답', () => {
  it('토큰 없이 200이고 본문은 {status:"ok"} 하나뿐이다', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.body).toEqual({ status: 'ok' });
  });

  it('DB를 조회하지 않는다 (DB 순단이 인스턴스 교체로 번지지 않게)', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);

    expect(prisma.lineUp.count).not.toHaveBeenCalled();
    expect(prisma.setlist.count).not.toHaveBeenCalled();
    expect(prisma.adminUser.count).not.toHaveBeenCalled();
  });

  it('행 수·DB 상태 필드를 싣지 않는다', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(JSON.stringify(res.body)).not.toMatch(/rowCounts|database|lineUp|setlist|adminUser/);
  });
});

describe('GET /health/db — 인증 필요', () => {
  it('토큰이 없으면 401이고 DB를 조회하지 않는다', async () => {
    const res = await request(app.getHttpServer()).get('/health/db').expect(401);

    expect(res.body.message).toBe('인증이 필요합니다.');
    expect(prisma.lineUp.count).not.toHaveBeenCalled();
  });

  it('위조된 토큰은 401이다', async () => {
    await request(app.getHttpServer())
      .get('/health/db')
      .set('Authorization', 'Bearer not.a.real-token')
      .expect(401);
  });

  it('유효한 토큰이면 기존 database·rowCounts를 돌려준다', async () => {
    const token = jwtService.sign({ sub: '1' });

    const res = await request(app.getHttpServer())
      .get('/health/db')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual({
      status: 'ok',
      database: 'connected',
      rowCounts: { lineUp: 15, setlist: 64, adminUser: 1 },
    });
  });
});

describe('HealthController — @Public() / 요청 제한 표시 (Reflector 회귀)', () => {
  it('check()만 @Public()이다', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, HealthController.prototype.check)).toBe(true);
  });

  it('checkDatabase()에는 @Public()이 없다', () => {
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, HealthController.prototype.checkDatabase),
    ).toBeUndefined();
  });

  it('컨트롤러 클래스 전체에 @Public()이 없다 (클래스에 붙으면 /health/db까지 열린다)', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, HealthController)).toBeUndefined();
  });

  it('두 라우트 모두 요청 제한 제외다 (클래스 수준 @SkipThrottle — default throttler)', () => {
    // 클래스 수준 표시는 /health와 /health/db 모두에 적용된다.
    expect(Reflect.getMetadata('THROTTLER:SKIPdefault', HealthController)).toBe(true);
    // 핸들러에서 다시 켜지 않았는지
    expect(
      Reflect.getMetadata('THROTTLER:SKIPdefault', HealthController.prototype.check),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata('THROTTLER:SKIPdefault', HealthController.prototype.checkDatabase),
    ).toBeUndefined();
  });
});
