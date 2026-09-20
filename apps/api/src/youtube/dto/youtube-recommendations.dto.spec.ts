import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { RunBatchDto } from './run-batch.dto.js';
import {
  ApproveRecommendationDto,
  ListRecommendationsQuery,
  RejectRecommendationDto,
} from './review-recommendation.dto.js';
import {
  YOUTUBE_BATCH_DEFAULT_LIMIT,
  YOUTUBE_BATCH_MAX_LIMIT,
  YOUTUBE_LIST_DEFAULT_LIMIT,
  YOUTUBE_LIST_MAX_LIMIT,
  YOUTUBE_REJECT_REASON_MAX_LENGTH,
} from '../youtube-search.constants.js';

// main.ts의 전역 설정을 그대로 재현한다. 여기서만 다른 옵션을 쓰면
// 테스트는 통과하는데 실제 요청은 다르게 동작한다.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  stopAtFirstError: true,
});

const validate = <T>(metatype: new () => T, payload: unknown, type: 'body' | 'query' = 'body') =>
  pipe.transform(payload, { type, metatype } as ArgumentMetadata) as Promise<T>;

const rejects = async (metatype: new () => unknown, payload: unknown, type: 'body' | 'query' = 'body') => {
  await expect(validate(metatype, payload, type)).rejects.toBeInstanceOf(BadRequestException);
};

describe('RunBatchDto', () => {
  it('limit을 생략하면 기본값이 붙는다', async () => {
    await expect(validate(RunBatchDto, {})).resolves.toMatchObject({
      limit: YOUTUBE_BATCH_DEFAULT_LIMIT,
    });
  });

  it('상한 안의 값은 통과한다', async () => {
    await expect(validate(RunBatchDto, { limit: YOUTUBE_BATCH_MAX_LIMIT })).resolves.toMatchObject({
      limit: YOUTUBE_BATCH_MAX_LIMIT,
    });
  });

  it.each([
    ['상한 초과', { limit: YOUTUBE_BATCH_MAX_LIMIT + 1 }],
    ['0', { limit: 0 }],
    ['음수', { limit: -1 }],
    ['소수', { limit: 1.5 }],
    ['숫자가 아님', { limit: 'many' }],
  ])('%s는 거부한다', async (_label, payload) => {
    await rejects(RunBatchDto, payload);
  });

  it('곡을 직접 지정하는 필드는 받지 않는다', async () => {
    // 대상 선정은 서버가 소유해야 제외 규칙(열린 추천/결과 0건/연속 실패)이 지켜진다.
    await rejects(RunBatchDto, { limit: 1, songIds: ['27'] });
  });
});

describe('ApproveRecommendationDto', () => {
  it('11자 영상 ID를 통과시킨다', async () => {
    await expect(
      validate(ApproveRecommendationDto, { videoId: 'BTo-I-gCAxk' }),
    ).resolves.toMatchObject({ videoId: 'BTo-I-gCAxk' });
  });

  it('앞뒤 공백을 제거한다', async () => {
    await expect(
      validate(ApproveRecommendationDto, { videoId: '  BTo-I-gCAxk  ' }),
    ).resolves.toMatchObject({ videoId: 'BTo-I-gCAxk' });
  });

  it.each([
    ['빈 값', { videoId: '' }],
    ['10자', { videoId: 'BTo-I-gCAx' }],
    ['12자', { videoId: 'BTo-I-gCAxkk' }],
    ['허용되지 않는 문자', { videoId: 'BTo+I-gCAxk' }],
    ['URL 전체', { videoId: 'https://www.youtube.com/watch?v=BTo-I-gCAxk' }],
    ['누락', {}],
    ['숫자 타입', { videoId: 12345678901 }],
  ])('%s는 거부한다', async (_label, payload) => {
    await rejects(ApproveRecommendationDto, payload);
  });

  it('등수(rank)로는 지목할 수 없다', async () => {
    // 목록을 새로 고치는 사이 등수가 가리키는 대상이 달라질 수 있다.
    await rejects(ApproveRecommendationDto, { rank: 1 });
  });

  it('검토 상태를 본문으로 주입할 수 없다', async () => {
    await rejects(ApproveRecommendationDto, {
      videoId: 'BTo-I-gCAxk',
      youtubeReviewStatus: 'approved',
    });
  });
});

describe('RejectRecommendationDto', () => {
  it('사유 없이도 통과한다', async () => {
    await expect(validate(RejectRecommendationDto, {})).resolves.toEqual({});
  });

  it('사유를 통과시키고 공백을 제거한다', async () => {
    await expect(
      validate(RejectRecommendationDto, { reason: '  다른 밴드 영상  ' }),
    ).resolves.toMatchObject({ reason: '다른 밴드 영상' });
  });

  it('상한 경계', async () => {
    const limit = 'x'.repeat(YOUTUBE_REJECT_REASON_MAX_LENGTH);

    await expect(validate(RejectRecommendationDto, { reason: limit })).resolves.toMatchObject({
      reason: limit,
    });
    await rejects(RejectRecommendationDto, { reason: `${limit}x` });
  });

  it.each([
    ['공백만', { reason: '   ' }],
    ['빈 문자열', { reason: '' }],
    ['숫자 타입', { reason: 42 }],
    ['DTO 밖 필드', { reason: 'ok', reviewState: 'rejected' }],
  ])('%s는 거부한다', async (_label, payload) => {
    await rejects(RejectRecommendationDto, payload);
  });
});

describe('ListRecommendationsQuery', () => {
  it('기본값은 리뷰 대기(open)와 기본 페이지 크기다', async () => {
    await expect(validate(ListRecommendationsQuery, {}, 'query')).resolves.toMatchObject({
      state: 'open',
      limit: YOUTUBE_LIST_DEFAULT_LIMIT,
    });
  });

  it.each(['open', 'approved', 'rejected', 'superseded', 'expired', 'closed'])(
    '%s 상태를 받는다',
    async (state) => {
      await expect(
        validate(ListRecommendationsQuery, { state }, 'query'),
      ).resolves.toMatchObject({ state });
    },
  );

  it.each([
    ['알 수 없는 상태', { state: 'pending' }],
    ['limit 상한 초과', { limit: YOUTUBE_LIST_MAX_LIMIT + 1 }],
    ['limit 0', { limit: 0 }],
    ['커서가 숫자가 아님', { cursor: 'abc' }],
    ['커서가 int8 자릿수 초과', { cursor: '1'.repeat(20) }],
    ['DTO 밖 필드', { offset: 10 }],
  ])('%s는 거부한다', async (_label, payload) => {
    await rejects(ListRecommendationsQuery, payload, 'query');
  });

  it('쿼리스트링의 문자열 숫자를 정수로 변환한다', async () => {
    await expect(
      validate(ListRecommendationsQuery, { limit: '30' }, 'query'),
    ).resolves.toMatchObject({ limit: 30 });
  });
});
