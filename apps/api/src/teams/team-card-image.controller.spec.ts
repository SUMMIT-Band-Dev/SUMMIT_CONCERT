import 'reflect-metadata';
import {
  INTERCEPTORS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants.js';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { TeamCardImageController } from './team-card-image.controller.js';
import { CardImageUploadInterceptor } from './card-image-upload.interceptor.js';
import { IS_PUBLIC_KEY } from '../auth/public.decorator.js';
import type { TeamCardImageService } from './team-card-image.service.js';

describe('TeamCardImageController — 전역 Guard 회귀', () => {
  // 전역 APP_GUARD는 @Public()이 붙은 곳만 열어 준다. 실수로 붙으면 인증 없이
  // 저장소에 파일을 밀어 넣을 수 있게 되므로 메타데이터가 없다는 것을 고정한다.
  it('컨트롤러 클래스에 @Public()이 붙어 있지 않다', () => {
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, TeamCardImageController),
    ).toBeUndefined();
  });

  it('upload 핸들러에 @Public()이 붙어 있지 않다', () => {
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, TeamCardImageController.prototype.upload),
    ).toBeUndefined();
  });
});

describe('TeamCardImageController — 라우트 선언', () => {
  it('PUT /teams/:id/card-image 이다', () => {
    expect(Reflect.getMetadata(PATH_METADATA, TeamCardImageController)).toBe(
      'teams',
    );
    expect(
      Reflect.getMetadata(PATH_METADATA, TeamCardImageController.prototype.upload),
    ).toBe(':id/card-image');
    expect(
      Reflect.getMetadata(METHOD_METADATA, TeamCardImageController.prototype.upload),
    ).toBe(RequestMethod.PUT);
  });

  it('업로드 파서 인터셉터가 붙어 있다', () => {
    // 빠지면 req.file이 채워지지 않아 "항상 파일 없음(400)"이 된다.
    // 게다가 크기 제한도 함께 사라진다 — 조용히 깨지는 종류라 테스트로 고정한다.
    const interceptors: unknown[] =
      Reflect.getMetadata(
        INTERCEPTORS_METADATA,
        TeamCardImageController.prototype.upload,
      ) ?? [];

    expect(interceptors).toContain(CardImageUploadInterceptor);
  });
});

describe('TeamCardImageController — 서비스 위임', () => {
  it('파싱한 id와 파일을 그대로 넘긴다', async () => {
    const replace = vi.fn().mockResolvedValue({ id: '21' });
    const controller = new TeamCardImageController({
      replace,
    } as unknown as TeamCardImageService);
    const file = { buffer: Buffer.from([0xff, 0xd8, 0xff]), size: 3 };

    await controller.upload(21n, file);

    expect(replace).toHaveBeenCalledWith(21n, file);
  });

  it('파일이 없으면 undefined를 그대로 넘긴다(판단은 서비스가 한다)', async () => {
    const replace = vi.fn().mockResolvedValue({ id: '21' });
    const controller = new TeamCardImageController({
      replace,
    } as unknown as TeamCardImageService);

    await controller.upload(21n, undefined);

    expect(replace).toHaveBeenCalledWith(21n, undefined);
  });
});
