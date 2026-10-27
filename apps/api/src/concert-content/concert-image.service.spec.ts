import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RevalidationService } from '../revalidation/revalidation.service.js';
import { StorageTimeoutError } from '../storage/storage.client.js';
import {
  CARD_IMAGE_CACHE_CONTROL_SECONDS,
  CARD_IMAGE_REQUIRED_MESSAGE,
  CARD_IMAGE_UNSUPPORTED_MESSAGE,
  STORAGE_FAILED_MESSAGE,
  STORAGE_TIMEOUT_MESSAGE,
} from '../storage/storage.constants.js';
import type { UploadedImageFile } from '../teams/card-image-upload.interceptor.js';
import { ConcertImageService } from './concert-image.service.js';
import {
  CONTENT_BASE_ROW_NOT_FOUND,
  PERFORMANCE_DAY_NOT_FOUND,
} from './concert-content.constants.js';

const png = {
  buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  size: 8,
};
const updatedAt = new Date('2026-10-21T00:00:00Z');
function setup() {
  const events: string[] = [];
  const concertRow = {
    id: 1n,
    titleKo: '공연',
    titleEn: 'Concert',
    subtitle: null,
    startDate: updatedAt,
    endDate: updatedAt,
    showTime: '18시',
    posterImageUrl: null,
    titleImageUrl: null,
    subtitleImageUrl: null,
    venue: { id: 1n, name: '공연장', address: '주소' },
    updatedAt,
  };
  const ticketRow = {
    id: 1n,
    frontImageUrl: null,
    backImageUrl: null,
    description: '티켓 설명',
    updatedAt,
  };
  const dayRow = {
    id: 1n,
    dayKey: 'day1',
    dayLabel: '1일차',
    dateLabel: '날짜',
    bookingUrl: null,
    lineupOverride: '직접 입력',
    timetableImageUrl: null,
    updatedAt,
  };
  function delegate(row: object) {
    return {
      findUnique: vi.fn().mockResolvedValue(row),
      update: vi.fn(async (args: { data: Record<string, string> }) => {
        events.push('update');
        return { ...row, ...args.data };
      }),
    };
  }
  const prisma = {
    concert: delegate(concertRow),
    ticket: delegate(ticketRow),
    performanceDay: delegate(dayRow),
    lineUp: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { teamName: '첫째' },
          { teamName: '둘째' },
          { teamName: '마지막' },
        ]),
    },
  };
  const storage = {
    bucketName: 'team-cards',
    getBucket: vi.fn(),
    upload: vi.fn(async () => {
      events.push('upload');
    }),
    remove: vi.fn().mockResolvedValue(undefined),
    getPublicUrl: vi.fn((path: string) => `https://storage.example/${path}`),
  };
  const revalidate = vi.fn(async () => {
    events.push('revalidate');
    return true;
  });
  const service = new ConcertImageService(
    prisma as unknown as PrismaService,
    storage,
    { revalidate } as unknown as RevalidationService,
  );
  return { service, prisma, storage, revalidate, events };
}
type Context = ReturnType<typeof setup>;
const targets = [
  {
    model: 'concert',
    value: 'poster',
    column: 'posterImageUrl',
    prefix: 'concert/poster',
    tag: 'concert',
  },
  {
    model: 'concert',
    value: 'title',
    column: 'titleImageUrl',
    prefix: 'concert/title',
    tag: 'concert',
  },
  {
    model: 'concert',
    value: 'subtitle',
    column: 'subtitleImageUrl',
    prefix: 'concert/subtitle',
    tag: 'concert',
  },
  {
    model: 'ticket',
    value: 'front',
    column: 'frontImageUrl',
    prefix: 'concert/ticket/front',
    tag: 'ticket',
  },
  {
    model: 'ticket',
    value: 'back',
    column: 'backImageUrl',
    prefix: 'concert/ticket/back',
    tag: 'ticket',
  },
  {
    model: 'performanceDay',
    value: 'day1',
    column: 'timetableImageUrl',
    prefix: 'concert/timetable/day1',
    tag: 'performance-days',
  },
] as const;
type Target = (typeof targets)[number];
function replace(
  ctx: Context,
  target: Target,
  file: UploadedImageFile | undefined = png,
) {
  if (target.model === 'concert')
    return ctx.service.replaceConcert(target.value, file);
  if (target.model === 'ticket')
    return ctx.service.replaceTicket(target.value, file);
  return ctx.service.replaceTimetable(target.value, file);
}
afterEach(() => vi.restoreAllMocks());

describe('6개 이미지 대상 저장', () => {
  it.each(targets)(
    '$prefix는 지정 컬럼·경로·태그와 응답을 쓴다',
    async (target) => {
      for (const revalidated of [true, false]) {
        const ctx = setup();
        ctx.revalidate.mockImplementation(async () => {
          ctx.events.push('revalidate');
          return revalidated;
        });
        const result = await replace(ctx, target);
        const path = ctx.storage.getPublicUrl.mock.calls[0][0];
        expect(path).toMatch(
          new RegExp(`^${target.prefix}/[0-9a-f-]{36}\\.png$`),
        );
        const url = `https://storage.example/${path}`;
        expect(ctx.storage.upload).toHaveBeenCalledExactlyOnceWith({
          path,
          body: png.buffer,
          contentType: 'image/png',
          cacheControlSeconds: CARD_IMAGE_CACHE_CONTROL_SECONDS,
        });
        expect(ctx.prisma[target.model].update).toHaveBeenCalledExactlyOnceWith(
          {
            where:
              target.model === 'performanceDay'
                ? { dayKey: 'day1' }
                : { id: 1n },
            data: { [target.column]: url },
            ...(target.model === 'concert' ? { include: { venue: true } } : {}),
          },
        );
        expect(result).toMatchObject({
          data: { [target.column]: url, updatedAt: updatedAt.toISOString() },
          revalidated,
        });
        expect(ctx.revalidate).toHaveBeenCalledExactlyOnceWith([target.tag]);
        expect(ctx.events).toEqual(['upload', 'update', 'revalidate']);
        expect(ctx.storage.remove).not.toHaveBeenCalled();
        if (target.model === 'concert')
          expect(result.data).toMatchObject({
            venue: { id: '1', name: '공연장', address: '주소' },
          });
        if (target.model === 'performanceDay') {
          expect(result.data).toMatchObject({
            autoLineup: ['첫째', '둘째', '마지막'],
            lineupOverride: '직접 입력',
          });
          expect(ctx.prisma.lineUp.findMany).toHaveBeenCalledExactlyOnceWith({
            where: { day: 'day1' },
            orderBy: [
              { performanceOrder: { sort: 'asc', nulls: 'last' } },
              { id: 'asc' },
            ],
            select: { teamName: true },
          });
        }
      }
    },
  );
  it.each([
    [Buffer.from([0xff, 0xd8, 0xff]), 'jpg', 'image/jpeg'],
    [Buffer.from('524946460000000057454250', 'hex'), 'webp', 'image/webp'],
  ])(
    '파일 바이트로 확장자와 Content-Type을 정한다',
    async (buffer, extension, contentType) => {
      const ctx = setup();
      await ctx.service.replaceTicket('front', { buffer, size: buffer.length });
      expect(ctx.storage.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          contentType,
          path: expect.stringMatching(new RegExp(`\\.${extension}$`)),
        }),
      );
    },
  );
});

describe('업로드 이전 거부와 저장소 오류', () => {
  it.each(targets)(
    '$prefix는 없는 행·파일 누락·형식 불가를 업로드 전에 거부한다',
    async (target) => {
      for (const [file, status, message] of [
        [undefined, 400, CARD_IMAGE_REQUIRED_MESSAGE],
        [
          { buffer: Buffer.alloc(0), size: 0 },
          400,
          CARD_IMAGE_REQUIRED_MESSAGE,
        ],
        [
          { buffer: Buffer.from('텍스트'), size: 9 },
          400,
          CARD_IMAGE_UNSUPPORTED_MESSAGE,
        ],
        [
          png,
          404,
          target.model === 'performanceDay'
            ? PERFORMANCE_DAY_NOT_FOUND
            : CONTENT_BASE_ROW_NOT_FOUND,
        ],
      ] as const) {
        const ctx = setup();
        ctx.prisma[target.model].findUnique.mockResolvedValue(null);
        const operation =
          file === undefined
            ? target.model === 'concert'
              ? ctx.service.replaceConcert(target.value, undefined)
              : target.model === 'ticket'
                ? ctx.service.replaceTicket(target.value, undefined)
                : ctx.service.replaceTimetable(target.value, undefined)
            : replace(ctx, target, file);
        await expect(operation).rejects.toMatchObject({ status, message });
        expect(ctx.storage.upload).not.toHaveBeenCalled();
        expect(ctx.prisma[target.model].update).not.toHaveBeenCalled();
        expect(ctx.revalidate).not.toHaveBeenCalled();
      }
    },
  );
  it('경로 인자를 파일·DB보다 먼저 검사한다', async () => {
    const ctx = setup();
    for (const value of ['__proto__', 'invalid', '../day1']) {
      await expect(
        ctx.service.replaceConcert(value, undefined),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        ctx.service.replaceTicket(value, undefined),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        ctx.service.replaceTimetable(value, undefined),
      ).rejects.toMatchObject({
        status: 404,
        message: PERFORMANCE_DAY_NOT_FOUND,
      });
    }
    expect(ctx.storage.upload).not.toHaveBeenCalled();
    for (const target of targets)
      expect(ctx.prisma[target.model].findUnique).not.toHaveBeenCalled();
    expect(ctx.revalidate).not.toHaveBeenCalled();
  });
  it.each(targets)(
    '$prefix는 업로드 실패 후 갱신·보상·재검증하지 않는다',
    async (target) => {
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      for (const timeout of [true, false]) {
        const ctx = setup();
        ctx.storage.upload.mockRejectedValueOnce(
          timeout ? new StorageTimeoutError() : new Error('실패'),
        );
        await expect(replace(ctx, target)).rejects.toMatchObject({
          status: timeout ? 504 : 502,
          message: timeout ? STORAGE_TIMEOUT_MESSAGE : STORAGE_FAILED_MESSAGE,
        });
        expect(ctx.prisma[target.model].update).not.toHaveBeenCalled();
        expect(ctx.storage.remove).not.toHaveBeenCalled();
        expect(ctx.revalidate).not.toHaveBeenCalled();
      }
    },
  );
});

describe('DB 실패 보상', () => {
  it.each(targets)(
    '$prefix는 P2025 후 삭제하고 404로 바꾼다',
    async (target) => {
      const ctx = setup();
      ctx.prisma[target.model].update.mockRejectedValueOnce(
        Object.assign(new Error('없음'), { code: 'P2025' }),
      );
      await expect(replace(ctx, target)).rejects.toMatchObject({
        status: 404,
        message:
          target.model === 'performanceDay'
            ? PERFORMANCE_DAY_NOT_FOUND
            : CONTENT_BASE_ROW_NOT_FOUND,
      });
      expect(ctx.storage.remove).toHaveBeenCalledExactlyOnceWith([
        ctx.storage.getPublicUrl.mock.calls[0][0],
      ]);
      expect(ctx.prisma[target.model].findUnique).toHaveBeenCalledTimes(1);
      expect(ctx.revalidate).not.toHaveBeenCalled();
    },
  );
  it.each(targets)(
    '$prefix의 불명확한 오류는 재조회 결과에 따라 보상하고 원래 오류를 전파한다',
    async (target) => {
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      for (const outcome of [
        'same',
        'different',
        'missing',
        'read-failed',
        'remove-failed',
      ]) {
        const ctx = setup();
        const original = new Error('DB 오류');
        ctx.prisma[target.model].update.mockRejectedValueOnce(original);
        ctx.prisma[target.model].findUnique.mockImplementationOnce(
          async () => ({ venue: {} }),
        );
        ctx.prisma[target.model].findUnique.mockImplementationOnce(async () => {
          if (outcome === 'read-failed') throw new Error('재조회 실패');
          return outcome === 'missing'
            ? null
            : {
                [target.column]:
                  outcome === 'same'
                    ? ctx.storage.getPublicUrl.mock.results[0].value
                    : '/other.png',
              };
        });
        if (outcome === 'remove-failed')
          ctx.storage.remove.mockRejectedValueOnce(new Error('삭제 실패'));
        await expect(replace(ctx, target)).rejects.toBe(original);
        if (outcome === 'same' || outcome === 'read-failed')
          expect(ctx.storage.remove).not.toHaveBeenCalled();
        else
          expect(ctx.storage.remove).toHaveBeenCalledExactlyOnceWith([
            ctx.storage.getPublicUrl.mock.calls[0][0],
          ]);
        expect(ctx.prisma[target.model].findUnique.mock.calls[1][0]).toEqual({
          where:
            target.model === 'performanceDay' ? { dayKey: 'day1' } : { id: 1n },
          select: { [target.column]: true },
        });
        expect(ctx.revalidate).not.toHaveBeenCalled();
      }
    },
  );
});
