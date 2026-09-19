import 'reflect-metadata';
import {
  EXCEPTION_FILTERS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants.js';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AlbumCoverController } from './album-cover.controller.js';
import { OutboundRateLimitFilter } from './outbound-rate-limit.filter.js';
import { OutboundRateLimitException } from './outbound-rate-limiter.js';
import { IS_PUBLIC_KEY } from '../auth/public.decorator.js';
import type { AlbumCoverService } from './album-cover.service.js';

describe('AlbumCoverController — 전역 Guard 회귀', () => {
  it('컨트롤러 클래스에 @Public()이 붙어 있지 않다', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, AlbumCoverController)).toBeUndefined();
  });

  it.each([
    ['findCandidates', AlbumCoverController.prototype.findCandidates],
    ['update', AlbumCoverController.prototype.update],
  ])('%s 핸들러에 @Public()이 붙어 있지 않다', (_name, handler) => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBeUndefined();
  });
});

describe('AlbumCoverController — 라우트 선언', () => {
  it('곡 하위 경로에 묶여 있다', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AlbumCoverController)).toBe(
      'songs/:id/album-cover',
    );
  });

  it('후보 조회는 GET candidates, 반영은 PUT이다', () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, AlbumCoverController.prototype.findCandidates),
    ).toBe('candidates');
    expect(
      Reflect.getMetadata(METHOD_METADATA, AlbumCoverController.prototype.findCandidates),
    ).toBe(RequestMethod.GET);

    expect(
      Reflect.getMetadata(METHOD_METADATA, AlbumCoverController.prototype.update),
    ).toBe(RequestMethod.PUT);
  });

  it('Retry-After 필터가 붙어 있다', () => {
    // 빠지면 429는 나가지만 Retry-After 헤더가 사라진다
    const filters: unknown[] =
      Reflect.getMetadata(EXCEPTION_FILTERS_METADATA, AlbumCoverController) ?? [];

    expect(filters).toContain(OutboundRateLimitFilter);
  });
});

describe('AlbumCoverController — 서비스 위임', () => {
  const createController = () => {
    const service = {
      findCandidates: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({ id: '50' }),
    };

    return {
      controller: new AlbumCoverController(service as unknown as AlbumCoverService),
      service,
    };
  };

  it('후보 조회에 파싱한 id를 넘긴다', async () => {
    const { controller, service } = createController();

    await controller.findCandidates(50n);

    expect(service.findCandidates).toHaveBeenCalledWith(50n);
  });

  it('반영은 DTO에서 url만 꺼내 넘긴다', async () => {
    const { controller, service } = createController();

    await controller.update(50n, { url: 'https://example.com/a.jpg' });

    expect(service.update).toHaveBeenCalledWith(50n, 'https://example.com/a.jpg');
  });
});

describe('OutboundRateLimitFilter', () => {
  it('Retry-After 헤더를 붙여 429로 응답한다', () => {
    const response = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    };

    new OutboundRateLimitFilter().catch(
      new OutboundRateLimitException(37),
      host as never,
    );

    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '37');
    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 429 }),
    );
  });
});
