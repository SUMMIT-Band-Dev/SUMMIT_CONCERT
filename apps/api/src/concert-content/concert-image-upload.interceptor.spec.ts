import 'reflect-metadata';
import { Controller, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import multer from 'multer';
import { configureHttp, createHttpAdapter } from '../app.setup.js';
import {
  toUploadException,
  type UploadedImageFile,
} from '../teams/card-image-upload.interceptor.js';
import { CARD_IMAGE_TOO_LARGE_MESSAGE } from '../storage/storage.constants.js';
import {
  CONCERT_IMAGE_MAX_BYTES,
  CONCERT_IMAGE_TOO_LARGE_MESSAGE,
} from './concert-content.constants.js';
import { ConcertImageUploadInterceptor } from './concert-image-upload.interceptor.js';

@Controller('upload')
class UploadController {
  @Put()
  @UseInterceptors(ConcertImageUploadInterceptor)
  upload(@UploadedFile() file: UploadedImageFile) {
    return { size: file.size };
  }
}
let app: NestExpressApplication;
beforeAll(async () => {
  const module = await Test.createTestingModule({
    controllers: [UploadController],
  }).compile();
  app =
    module.createNestApplication<NestExpressApplication>(createHttpAdapter());
  configureHttp(app, { trustProxyHops: 0, corsAllowedOrigins: [] });
  await app.init();
});
afterAll(async () => {
  await app?.close();
});

describe('공연 이미지 multipart 제한', () => {
  it('1MB보다 큰 파일을 받아 2MB 상한이 팀 제한과 독립적임을 확인한다', async () => {
    const response = await request(app.getHttpServer())
      .put('/upload')
      .attach('file', Buffer.alloc(CONCERT_IMAGE_MAX_BYTES - 1), 'image.png')
      .expect(200);
    expect(response.body.size).toBe(CONCERT_IMAGE_MAX_BYTES - 1);
  });
  it('2MB 초과는 지정 문구의 413이다', async () => {
    const response = await request(app.getHttpServer())
      .put('/upload')
      .attach('file', Buffer.alloc(CONCERT_IMAGE_MAX_BYTES + 1), 'image.png')
      .expect(413);
    expect(response.body.message).toBe(CONCERT_IMAGE_TOO_LARGE_MESSAGE);
  });
  it('잘못된 파일 필드명은 400이다', async () => {
    await request(app.getHttpServer())
      .put('/upload')
      .attach('image', Buffer.from('파일'), 'image.png')
      .expect(400);
  });
  it('파일 두 개와 텍스트 필드를 거부한다', async () => {
    await request(app.getHttpServer())
      .put('/upload')
      .attach('file', Buffer.from('a'), 'a.png')
      .attach('file', Buffer.from('b'), 'b.png')
      .expect(400);
    await request(app.getHttpServer())
      .put('/upload')
      .field('extra', 'value')
      .attach('file', Buffer.from('a'), 'a.png')
      .expect(400);
  });
  it('기본 용량 초과 문구를 유지하고 선택 인자는 용량 초과에만 적용한다', () => {
    expect(
      toUploadException(new multer.MulterError('LIMIT_FILE_SIZE')),
    ).toMatchObject({ status: 413, message: CARD_IMAGE_TOO_LARGE_MESSAGE });
    expect(
      toUploadException(
        new multer.MulterError('LIMIT_FILE_SIZE'),
        CONCERT_IMAGE_TOO_LARGE_MESSAGE,
      ),
    ).toMatchObject({ status: 413, message: CONCERT_IMAGE_TOO_LARGE_MESSAGE });
    const error = new multer.MulterError('LIMIT_FIELD_COUNT');
    expect(toUploadException(error, '다른 문구')).toEqual(
      toUploadException(error),
    );
  });
});
