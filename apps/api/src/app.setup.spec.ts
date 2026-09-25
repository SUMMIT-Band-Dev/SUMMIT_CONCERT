import 'reflect-metadata';
import { Controller, Get, Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureHttp, createHttpAdapter } from './app.setup.js';

@Controller()
class ProbeController {
  @Get('ping')
  ping() {
    return { ok: true };
  }
}

let app: NestExpressApplication | undefined;
let warnLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnLog = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  warnLog.mockClear();
});

afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function configure(trustProxyHops: number) {
  const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile();
  const created = moduleRef.createNestApplication<NestExpressApplication>(createHttpAdapter());
  configureHttp(created, { trustProxyHops, corsAllowedOrigins: [] });
  await created.init();
  app = created;
}

describe('configureHttp — TRUST_PROXY_HOPS 기동 경고 (교차 리뷰 M1)', () => {
  it('0(기본)이면 경고를 남기지 않는다', async () => {
    await configure(0);

    expect(warnLog).not.toHaveBeenCalled();
  });

  it('0이 아니면 값과 배포 전제를 알리는 경고를 정확히 한 줄 남긴다', async () => {
    await configure(1);

    expect(warnLog).toHaveBeenCalledTimes(1);
    const line = warnLog.mock.calls[0][0] as string;
    expect(line).toContain('TRUST_PROXY_HOPS=1');
    expect(line).toContain('프록시에서만 접근');
  });

  it('경고에는 값 외의 설정(오리진 등)이나 비밀이 없다', async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile();
    const created = moduleRef.createNestApplication<NestExpressApplication>(createHttpAdapter());
    configureHttp(created, { trustProxyHops: 2, corsAllowedOrigins: ['https://admin.example.com'] });
    await created.init();
    app = created;

    const line = warnLog.mock.calls[0][0] as string;
    expect(line).not.toContain('admin.example.com');
  });
});
