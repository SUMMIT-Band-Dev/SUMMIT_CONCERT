import 'reflect-metadata';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { YoutubeUrlController } from './youtube-url.controller.js';
import { IS_PUBLIC_KEY } from '../auth/public.decorator.js';
import type { YoutubeUrlService } from './youtube-url.service.js';

describe('YoutubeUrlController — 전역 Guard 회귀', () => {
  it('컨트롤러 클래스에 @Public()이 붙어 있지 않다', () => {
    // 붙는 순간 인증 없이 유튜브 링크를 바꿀 수 있게 된다.
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, YoutubeUrlController)).toBeUndefined();
  });

  it('update 핸들러에 @Public()이 붙어 있지 않다', () => {
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, YoutubeUrlController.prototype.update),
    ).toBeUndefined();
  });
});

describe('YoutubeUrlController — 라우트 선언', () => {
  it('곡 하위 경로에 PUT으로 묶여 있다', () => {
    expect(Reflect.getMetadata(PATH_METADATA, YoutubeUrlController)).toBe(
      'songs/:id/youtube-url',
    );
    expect(
      Reflect.getMetadata(METHOD_METADATA, YoutubeUrlController.prototype.update),
    ).toBe(RequestMethod.PUT);
  });
});

describe('YoutubeUrlController — 서비스 위임', () => {
  it('파싱한 id와 DTO의 url만 넘긴다', async () => {
    const service = { update: vi.fn().mockResolvedValue({ id: '50' }) };
    const controller = new YoutubeUrlController(
      service as unknown as YoutubeUrlService,
    );

    await controller.update(50n, { url: 'https://youtu.be/BTo-I-gCAxk' });

    expect(service.update).toHaveBeenCalledWith(
      50n,
      'https://youtu.be/BTo-I-gCAxk',
    );
  });
});
