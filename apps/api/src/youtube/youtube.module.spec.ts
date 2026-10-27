import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../app.module.js';
import { configureHttp, createHttpAdapter } from '../app.setup.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { STORAGE_CLIENT } from '../storage/storage.client.js';

let app: NestExpressApplication | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
  vi.unstubAllGlobals();
});

describe('유튜브 개편 — 앱 기동과 인증', () => {
  it('배치 키 설정 없이 기동하고 PUT·DELETE 미인증 요청은 DB 접근 전에 거부한다', async () => {
    const fetchStub = vi.fn();
    vi.stubGlobal('fetch', fetchStub);
    const concertFind = vi.fn();
    const concertUpdate = vi.fn();
    const update = vi.fn();
    const ticketUpdate = vi.fn();
    // 외부 DB·Storage를 대체한다. 이 테스트는 실제 데이터에 접근하지 않는다.
    const config = {
      get: (name: string) => {
        if (
          name === 'NAVER_MAP_CLIENT_ID' ||
          name === 'NAVER_MAP_CLIENT_SECRET'
        )
          return 'test-only-map-key';
        if (name === 'PUBLIC_SITE_URL') return 'http://localhost:3000';
        if (name === 'REVALIDATE_SECRET')
          return 'test-only-revalidate-'.repeat(3);
        return undefined;
      },
      getOrThrow: (name: string) => {
        if (name === 'JWT_SECRET') return 'test-only-secret-'.repeat(3);
        if (
          name === 'NAVER_MAP_CLIENT_ID' ||
          name === 'NAVER_MAP_CLIENT_SECRET'
        )
          return 'test-only-map-key';
        if (name === 'PUBLIC_SITE_URL') return 'http://localhost:3000';
        if (name === 'REVALIDATE_SECRET')
          return 'test-only-revalidate-'.repeat(3);
        throw new Error(`예상하지 않은 필수 설정: ${name}`);
      },
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(config)
      .overrideProvider(PrismaService)
      .useValue({
        setlist: { update },
        ticket: { update: ticketUpdate },
        concert: { findUnique: concertFind, update: concertUpdate },
      })
      .overrideProvider(STORAGE_CLIENT)
      .useValue({})
      .compile();
    app =
      moduleRef.createNestApplication<NestExpressApplication>(
        createHttpAdapter(),
      );
    configureHttp(app, { trustProxyHops: 0, corsAllowedOrigins: [] });
    await app.init();

    await request(app.getHttpServer())
      .put('/songs/50/youtube-url')
      .send({ url: 'https://youtu.be/BTo-I-gCAxk' })
      .expect(401);
    await request(app.getHttpServer())
      .delete('/songs/50/youtube-url')
      .expect(401);
    expect(update).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .put('/ticket')
      .send({ description: '테스트' })
      .expect(401);
    expect(ticketUpdate).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .put('/concert/images/poster')
      .attach(
        'file',
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        'poster.png',
      )
      .expect(401);
    await request(app.getHttpServer())
      .post('/venue/geocode')
      .send({ address: '서울특별시 마포구 양화로 100-10' })
      .expect(401);
    expect(concertFind).not.toHaveBeenCalled();
    expect(concertUpdate).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(ticketUpdate).not.toHaveBeenCalled();
    expect(fetchStub).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .get('/youtube/recommendations')
      .expect(404);
    await request(app.getHttpServer()).get('/youtube/quota').expect(404);
  });
});
