import 'reflect-metadata';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { YoutubeRecommendationsController } from './youtube-recommendations.controller.js';
import { YoutubeUrlController } from './youtube-url.controller.js';
import { IS_PUBLIC_KEY } from '../auth/public.decorator.js';
import type { YoutubeBatchService } from './youtube-batch.service.js';
import type { YoutubeReviewService } from './youtube-review.service.js';
import type { YoutubeQuotaService } from './youtube-quota.service.js';

const HANDLERS = [
  ['getQuota', YoutubeRecommendationsController.prototype.getQuota],
  ['runBatch', YoutubeRecommendationsController.prototype.runBatch],
  ['list', YoutubeRecommendationsController.prototype.list],
  ['approve', YoutubeRecommendationsController.prototype.approve],
  ['reject', YoutubeRecommendationsController.prototype.reject],
  ['requeue', YoutubeRecommendationsController.prototype.requeue],
] as const;

describe('유튜브 추천 컨트롤러 — 전역 Guard 회귀', () => {
  // 전역 APP_GUARD는 @Public()이 붙은 곳만 열어 준다. 하나라도 실수로 붙으면
  // 인증 없이 배치를 돌려 쿼터를 태울 수 있다.
  it.each([
    ['YoutubeRecommendationsController', YoutubeRecommendationsController],
    ['YoutubeUrlController', YoutubeUrlController],
  ])('%s 클래스에 @Public()이 붙어 있지 않다', (_name, controller) => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, controller)).toBeUndefined();
  });

  it.each(HANDLERS)('%s 핸들러에 @Public()이 붙어 있지 않다', (_name, handler) => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBeUndefined();
  });
});

describe('유튜브 추천 컨트롤러 — 라우트 선언', () => {
  it('최상위 경로는 youtube다 (곡 하나가 아니라 여러 곡을 가로지르는 리소스)', () => {
    expect(Reflect.getMetadata(PATH_METADATA, YoutubeRecommendationsController)).toBe('youtube');
  });

  it.each([
    ['getQuota', 'quota', RequestMethod.GET],
    ['runBatch', 'recommendations/batch', RequestMethod.POST],
    ['list', 'recommendations', RequestMethod.GET],
    ['approve', 'recommendations/:attemptId/approve', RequestMethod.POST],
    ['reject', 'recommendations/:attemptId/reject', RequestMethod.POST],
    ['requeue', 'songs/:songId/requeue', RequestMethod.POST],
  ])('%s의 경로와 메서드가 의도대로다', (name, path, method) => {
    const handler = Object.getOwnPropertyDescriptor(
      YoutubeRecommendationsController.prototype,
      name,
    )?.value as (...args: unknown[]) => unknown;

    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(method);
  });

  it('recommendations/batch가 recommendations/:attemptId/... 보다 먼저 선언된다', () => {
    // 지금은 세그먼트 수가 달라 충돌하지 않지만, 경로가 늘어날 때 순서 의존이 생기는
    // 지점이다 (§11의 PATCH /teams/reorder와 같은 방침).
    const order = Object.getOwnPropertyNames(YoutubeRecommendationsController.prototype);

    expect(order.indexOf('runBatch')).toBeLessThan(order.indexOf('approve'));
    expect(order.indexOf('runBatch')).toBeLessThan(order.indexOf('reject'));
  });
});

describe('유튜브 추천 컨트롤러 — 서비스 위임', () => {
  function createController() {
    const batchService = { runBatch: vi.fn(async () => ({})) } as unknown as YoutubeBatchService;
    const reviewService = {
      list: vi.fn(async () => ({ items: [], nextCursor: null })),
      approve: vi.fn(async () => ({})),
      reject: vi.fn(async () => ({})),
      requeue: vi.fn(async () => ({})),
    } as unknown as YoutubeReviewService;
    const quotaService = { getStatus: vi.fn(async () => ({})) } as unknown as YoutubeQuotaService;

    return {
      controller: new YoutubeRecommendationsController(batchService, reviewService, quotaService),
      batchService,
      reviewService,
      quotaService,
    };
  }

  it('배치는 DTO의 limit을 그대로 넘긴다', async () => {
    const { controller, batchService } = createController();

    await controller.runBatch({ limit: 7 });

    expect(batchService.runBatch).toHaveBeenCalledWith(7);
  });

  it('승인은 BigInt id와 videoId를 넘긴다', async () => {
    const { controller, reviewService } = createController();

    await controller.approve(100n, { videoId: 'BTo-I-gCAxk' });

    expect(reviewService.approve).toHaveBeenCalledWith(100n, 'BTo-I-gCAxk');
  });

  it('반려는 사유를 그대로 넘긴다 (없으면 undefined)', async () => {
    const { controller, reviewService } = createController();

    await controller.reject(100n, {});

    expect(reviewService.reject).toHaveBeenCalledWith(100n, undefined);
  });

  it('재큐는 곡 id를 넘긴다', async () => {
    const { controller, reviewService } = createController();

    await controller.requeue(27n);

    expect(reviewService.requeue).toHaveBeenCalledWith(27n);
  });
});
