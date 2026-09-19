import 'reflect-metadata';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { STORAGE_CLIENT, type StorageClient } from '../storage/storage.client.js';
import { CARD_IMAGE_MAX_BYTES } from '../storage/storage.constants.js';
import { TeamCardImageController } from './team-card-image.controller.js';
import { TeamCardImageService } from './team-card-image.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * 요청 파이프라인 전체를 실제 Nest 앱으로 세운 뒤 확인하는 스펙.
 *
 * 순수 단위 테스트로는 확인할 수 없는 것들만 여기서 본다:
 * - **Guard가 인터셉터보다 먼저 실행되는가** (= 미인증 요청의 파일이 파싱/업로드되지 않는가)
 * - multer의 limits가 실제 multipart 요청에 걸리는가
 * - 그 에러가 500이 아니라 의미 있는 상태코드로 나가는가
 *
 * DB에는 붙지 않는다 — Prisma와 저장소는 전부 대역이다.
 */
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const TEAM_ID = 21;

const storage = {
  bucketName: 'team-cards',
  upload: vi.fn(async () => undefined),
  remove: vi.fn(async () => undefined),
  getPublicUrl: vi.fn((path: string) => `https://example.supabase.co/${path}`),
  getBucket: vi.fn(),
};

const prisma = {
  lineUp: {
    findUnique: vi.fn(async () => ({
      id: BigInt(TEAM_ID),
      teamName: '8C8',
      day: 'day1',
      performanceOrder: 1,
      cardImageUrl: null,
    })),
    update: vi.fn(async (args: { data: { cardImageUrl: string } }) => ({
      id: BigInt(TEAM_ID),
      teamName: '8C8',
      day: 'day1',
      performanceOrder: 1,
      cardImageUrl: args.data.cardImageUrl,
    })),
  },
};

const jwtService = { verifyAsync: vi.fn() };

let app: INestApplication;
const url = `/teams/${TEAM_ID}/card-image`;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [TeamCardImageController],
    providers: [
      TeamCardImageService,
      Reflector,
      { provide: PrismaService, useValue: prisma },
      { provide: STORAGE_CLIENT, useValue: storage as unknown as StorageClient },
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
  storage.upload.mockClear();
  storage.remove.mockClear();
  prisma.lineUp.update.mockClear();
  jwtService.verifyAsync.mockReset();
  jwtService.verifyAsync.mockResolvedValue({ sub: '1', username: 'admin' });
});

const authorized = () => ({ Authorization: 'Bearer valid-token' });

describe('PUT /teams/:id/card-image — 인증', () => {
  it('토큰이 없으면 401이고 저장소를 한 번도 부르지 않는다', async () => {
    await request(app.getHttpServer())
      .put(url)
      .attach('file', JPEG, 'card.png')
      .expect(401);

    // Guard가 인터셉터보다 먼저 실행된다는 것의 실질적 의미:
    // 파일이 파싱되지도, 저장소로 나가지도 않는다.
    expect(storage.upload).not.toHaveBeenCalled();
    expect(prisma.lineUp.update).not.toHaveBeenCalled();
  });

  it('토큰이 없으면 용량 초과 파일이어도 413이 아니라 401이다', async () => {
    // 인증 실패가 먼저 판정돼야 한다. 413이 나온다면 미인증 요청의 본문을
    // 끝까지 파싱했다는 뜻이다.
    await request(app.getHttpServer())
      .put(url)
      .attach('file', Buffer.alloc(CARD_IMAGE_MAX_BYTES + 1024, 0), 'big.jpg')
      .expect(401);

    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('서명이 틀리면 401이다', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));

    await request(app.getHttpServer())
      .put(url)
      .set(authorized())
      .attach('file', JPEG, 'card.png')
      .expect(401);

    expect(storage.upload).not.toHaveBeenCalled();
  });
});

describe('PUT /teams/:id/card-image — 정상 경로', () => {
  it('인증된 요청은 업로드하고 200을 준다', async () => {
    const response = await request(app.getHttpServer())
      .put(url)
      .set(authorized())
      .attach('file', JPEG, 'card.png')
      .expect(200);

    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(response.body.id).toBe('21');
    expect(response.body.cardImageUrl).toMatch(/^https:\/\/example\.supabase\.co\//);
  });
});

describe('PUT /teams/:id/card-image — 업로드 거부 (500으로 새지 않는다)', () => {
  it('용량 초과는 413이다', async () => {
    const response = await request(app.getHttpServer())
      .put(url)
      .set(authorized())
      .attach('file', Buffer.alloc(CARD_IMAGE_MAX_BYTES + 1024, 0), 'big.jpg')
      .expect(413);

    expect(response.body.message).toBe('이미지 크기는 1MB를 넘을 수 없습니다.');
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('필드명이 다르면 400이다', async () => {
    const response = await request(app.getHttpServer())
      .put(url)
      .set(authorized())
      .attach('image', JPEG, 'card.png')
      .expect(400);

    expect(response.body.message).toContain("'file'");
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('파일이 둘이면 400이다', async () => {
    await request(app.getHttpServer())
      .put(url)
      .set(authorized())
      .attach('file', JPEG, 'a.png')
      .attach('file', JPEG, 'b.png')
      .expect(400);

    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('텍스트 필드가 섞이면 400이다', async () => {
    await request(app.getHttpServer())
      .put(url)
      .set(authorized())
      .field('teamName', '덮어쓰기 시도')
      .attach('file', JPEG, 'a.png')
      .expect(400);

    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('파일을 첨부하지 않으면 400이다', async () => {
    const response = await request(app.getHttpServer())
      .put(url)
      .set(authorized())
      .field('dummy', '')
      .expect(400);

    expect(storage.upload).not.toHaveBeenCalled();
    expect(response.body.message).toBeDefined();
  });

  it('SVG는 400이다', async () => {
    const response = await request(app.getHttpServer())
      .put(url)
      .set(authorized())
      .attach('file', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), {
        filename: 'card.png',
        contentType: 'image/png',
      })
      .expect(400);

    // 확장자와 Content-Type을 이미지로 속여도 매직바이트에서 걸린다
    expect(response.body.message).toBe(
      'JPEG, PNG, WebP 이미지만 업로드할 수 있습니다.',
    );
    expect(storage.upload).not.toHaveBeenCalled();
  });
});

describe('PUT /teams/:id/card-image — :id 파싱', () => {
  it('숫자가 아닌 id는 400이고 메시지가 업로드 안내문으로 덮이지 않는다', async () => {
    const response = await request(app.getHttpServer())
      .put('/teams/abc/card-image')
      .set(authorized())
      .attach('file', JPEG, 'card.png')
      .expect(400);

    // 출처가 다른 예외의 메시지를 인터셉터가 건드리지 않는다는 것의 실제 확인
    expect(response.body.message).toBe('id는 1 이상의 정수여야 합니다.');
  });

  it('없는 팀은 404다', async () => {
    prisma.lineUp.findUnique.mockResolvedValueOnce(null as never);

    const response = await request(app.getHttpServer())
      .put(url)
      .set(authorized())
      .attach('file', JPEG, 'card.png')
      .expect(404);

    expect(response.body.message).toBe('해당 팀을 찾을 수 없습니다.');
    expect(storage.upload).not.toHaveBeenCalled();
  });
});
