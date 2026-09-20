import 'reflect-metadata';
import { EXCEPTION_FILTERS_METADATA } from '@nestjs/common/constants.js';
import type { ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  YoutubeQuotaExhaustedException,
  YoutubeQuotaExhaustedFilter,
} from './youtube-quota-exhausted.exception.js';
import { YoutubeRecommendationsController } from './youtube-recommendations.controller.js';
import { YOUTUBE_QUOTA_EXHAUSTED_MESSAGE } from './youtube-search.constants.js';

function createHost() {
  const setHeader = vi.fn();
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const response = { setHeader, status };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;

  return { host, setHeader, status, json };
}

describe('YoutubeQuotaExhaustedException', () => {
  it('429이고 고정 문구를 담는다', () => {
    const exception = new YoutubeQuotaExhaustedException(120);

    expect(exception.getStatus()).toBe(429);
    expect(exception.getResponse()).toEqual({
      statusCode: 429,
      message: YOUTUBE_QUOTA_EXHAUSTED_MESSAGE,
      error: 'Too Many Requests',
    });
    expect(exception.retryAfterSeconds).toBe(120);
  });
});

describe('YoutubeQuotaExhaustedFilter', () => {
  it('Retry-After를 초 단위 문자열로 붙이고 429 본문을 그대로 내보낸다', () => {
    const { host, setHeader, status, json } = createHost();
    const exception = new YoutubeQuotaExhaustedException(3600);

    new YoutubeQuotaExhaustedFilter().catch(exception, host);

    expect(setHeader).toHaveBeenCalledWith('Retry-After', '3600');
    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith(exception.getResponse());
  });

  it('컨트롤러 클래스에 연결돼 있다 (헤더는 이 필터로만 실을 수 있다)', () => {
    const filters = Reflect.getMetadata(
      EXCEPTION_FILTERS_METADATA,
      YoutubeRecommendationsController,
    ) as unknown[];

    expect(filters).toContain(YoutubeQuotaExhaustedFilter);
  });

  it('이 예외 타입만 잡는다 (다른 출처의 429를 가로채지 않는다)', () => {
    // @Catch(YoutubeQuotaExhaustedException) 메타데이터로 확인한다.
    const caught = Reflect.getMetadata('__filterCatchExceptions__', YoutubeQuotaExhaustedFilter) as unknown[];

    expect(caught).toEqual([YoutubeQuotaExhaustedException]);
  });
});
