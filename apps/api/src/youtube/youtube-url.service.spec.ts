import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { YoutubeUrlService } from './youtube-url.service.js';
import { YOUTUBE_URL_REJECTION_MESSAGES } from './youtube.constants.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const SONG_ID = 50n;
const CANONICAL = 'https://www.youtube.com/watch?v=BTo-I-gCAxk';
function createHarness() {
  const update = vi.fn(
    async (args: {
      where: { id: bigint };
      data: { youtubeUrl: string | null };
    }) => ({
      id: args.where.id,
      teamId: 7n,
      title: '사랑의 미학',
      singer: '리도어',
      albumCoverUrl: null,
      youtubeUrl: args.data.youtubeUrl,
    }),
  );
  // 추천 이력·트랜잭션 대역 없이 URL 갱신 이외의 접근을 검출한다.
  const prisma = { setlist: { update } } as unknown as PrismaService;
  return { service: new YoutubeUrlService(prisma), update };
}
describe('YoutubeUrlService — URL 저장', () => {
  it('주소를 정규화하고 URL 컬럼만 한 번 갱신한다', async () => {
    const { service, update } = createHarness();
    const result = await service.update(
      SONG_ID,
      'https://youtu.be/BTo-I-gCAxk?t=12',
    );
    expect(update).toHaveBeenCalledExactlyOnceWith({
      where: { id: SONG_ID },
      data: { youtubeUrl: CANONICAL },
    });
    expect(result).toStrictEqual({
      id: '50',
      teamId: '7',
      title: '사랑의 미학',
      singer: '리도어',
      albumCoverUrl: null,
      youtubeUrl: CANONICAL,
    });
  });
  it.each([
    ['https://www.youtube.com/playlist?list=PLabc', 'PLAYLIST'],
    ['https://vimeo.com/123', 'NOT_YOUTUBE'],
    ['https://youtube.com.evil.example/watch?v=BTo-I-gCAxk', 'NOT_YOUTUBE'],
    ['https://youtube.com@evil.example/watch?v=BTo-I-gCAxk', 'NOT_YOUTUBE'],
    ['www.youtube.com/watch?v=BTo-I-gCAxk', 'NO_SCHEME'],
    ['http://www.youtube.com/watch?v=BTo-I-gCAxk', 'INSECURE_SCHEME'],
    ['https://www.youtube.com/watch?v=short', 'INVALID_VIDEO_ID'],
    [
      'https://www.youtube.com/watch?v=BTo-I-gCAxk&v=uC56MsZ8J8M',
      'DUPLICATE_VIDEO_ID',
    ],
    ['https://www.youtube.com/@summitband4978', 'NOT_A_VIDEO'],
  ] as const)(
    '잘못된 주소는 DB 접근 전에 거부한다: %s',
    async (url, reason) => {
      const { service, update } = createHarness();
      await expect(service.update(SONG_ID, url)).rejects.toThrow(
        YOUTUBE_URL_REJECTION_MESSAGES[reason],
      );
      expect(update).not.toHaveBeenCalled();
    },
  );
  it('거부 로그에 입력 URL을 남기지 않는다', async () => {
    const { service } = createHarness();
    const warn = vi
      .spyOn(
        (service as unknown as { logger: { warn: (message: string) => void } })
          .logger,
        'warn',
      )
      .mockImplementation(() => undefined);
    try {
      await expect(
        service.update(SONG_ID, 'https://evil.example/?token=sentinel'),
      ).rejects.toThrow(BadRequestException);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('NOT_YOUTUBE'));
      expect(warn.mock.calls.flat().join('')).not.toContain('sentinel');
    } finally {
      warn.mockRestore();
    }
  });
});
describe('YoutubeUrlService — 연결 해제', () => {
  it('URL만 null로 저장하며 반복 해제도 허용한다', async () => {
    const { service, update } = createHarness();
    await expect(service.remove(SONG_ID)).resolves.toMatchObject({
      id: '50',
      youtubeUrl: null,
    });
    await expect(service.remove(SONG_ID)).resolves.toMatchObject({
      youtubeUrl: null,
    });
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenLastCalledWith({
      where: { id: SONG_ID },
      data: { youtubeUrl: null },
    });
  });
});
describe.each(['update', 'remove'] as const)(
  'YoutubeUrlService.%s — DB 오류',
  (method) => {
    const invoke = (service: YoutubeUrlService) =>
      method === 'update'
        ? service.update(SONG_ID, CANONICAL)
        : service.remove(SONG_ID);
    it('없는 곡의 P2025를 404로 매핑한다', async () => {
      const { service, update } = createHarness();
      update.mockRejectedValueOnce(
        Object.assign(new Error('없음'), { code: 'P2025' }),
      );
      await expect(invoke(service)).rejects.toThrow(NotFoundException);
    });
    it('연결 장애를 404로 숨기지 않는다', async () => {
      const { service, update } = createHarness();
      update.mockRejectedValueOnce(
        Object.assign(new Error('connection reset'), { code: 'P1017' }),
      );
      await expect(invoke(service)).rejects.toThrow('connection reset');
    });
  },
);
