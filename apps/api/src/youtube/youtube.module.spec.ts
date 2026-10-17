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
});

describe('유튜브 개편 — 앱 기동과 인증', () => {
  it('배치 키 설정 없이 기동하고 PUT·DELETE 미인증 요청은 DB 접근 전에 거부한다', async () => {
    const update = vi.fn();
    // 외부 DB·Storage를 대체한다. 이 테스트는 실제 데이터에 접근하지 않는다.
    const config = {
      get: () => undefined,
      getOrThrow: (name: string) => {
        if (name === 'JWT_SECRET') return 'test-only-secret-'.repeat(3);
        throw new Error(`예상하지 않은 필수 설정: ${name}`);
      },
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(config)
      .overrideProvider(PrismaService)
      .useValue({ setlist: { update } })
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
      .get('/youtube/recommendations')
      .expect(404);
    await request(app.getHttpServer()).get('/youtube/quota').expect(404);
  });
});
