import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { YoutubeUrlService } from './youtube-url.service.js';
import { YOUTUBE_URL_REJECTION_MESSAGES } from './youtube.constants.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { YoutubeReviewStatus } from '../generated/prisma/enums.js';

const SONG_ID = 50n;
const VIDEO_ID = 'BTo-I-gCAxk';
const CANONICAL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;

interface SongRow {
  id: bigint;
  teamId: bigint | null;
  title: string;
  singer: string | null;
  albumCoverUrl: string | null;
  youtubeUrl: string | null;
  youtubeReviewStatus: YoutubeReviewStatus;
}

const songRow = (overrides: Partial<SongRow> = {}): SongRow => ({
  id: SONG_ID,
  teamId: 7n,
  title: '사랑의 미학',
  singer: '리도어 (Redoor)',
  albumCoverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/A/1.jpg/600x600bb.jpg',
  youtubeUrl: null,
  youtubeReviewStatus: 'pending',
  ...overrides,
});

type UpdateArgs = {
  where: { id: bigint };
  data: { youtubeUrl: string; youtubeReviewStatus: YoutubeReviewStatus };
};

function createHarness(current: Partial<SongRow> = {}) {
  const update = vi.fn(async (args: UpdateArgs) =>
    songRow({
      ...current,
      youtubeUrl: args.data.youtubeUrl,
      youtubeReviewStatus: args.data.youtubeReviewStatus,
    }),
  );

  const prisma = { setlist: { update } } as unknown as PrismaService;

  return { service: new YoutubeUrlService(prisma), update };
}

describe('YoutubeUrlService — 정상 경로', () => {
  it('정규화한 값을 저장하고 응답으로 돌려준다', async () => {
    const h = createHarness();

    const response = await h.service.update(SONG_ID, `https://youtu.be/${VIDEO_ID}?si=x`);

    expect(response).toEqual({
      id: '50',
      teamId: '7',
      title: '사랑의 미학',
      singer: '리도어 (Redoor)',
      albumCoverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/A/1.jpg/600x600bb.jpg',
      youtubeUrl: CANONICAL,
      youtubeReviewStatus: 'approved',
    });
  });

  it('클라이언트가 보낸 문자열이 아니라 서버가 정규화한 값을 저장한다', async () => {
    const h = createHarness();

    await h.service.update(SONG_ID, `https://m.youtube.com/watch?v=${VIDEO_ID}&list=PLx&t=9`);

    expect(h.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ youtubeUrl: CANONICAL }),
      }),
    );
  });

  it('URL과 상태를 단일 UPDATE로 함께 갱신한다', async () => {
    // 두 문으로 나누면 사이에서 실패했을 때 "URL은 들어갔는데 pending" 행이 생기고,
    // 그 행은 2/2의 배치 재검색 대상에 다시 잡힌다.
    const h = createHarness();

    await h.service.update(SONG_ID, CANONICAL);

    expect(h.update).toHaveBeenCalledTimes(1);
    expect(h.update).toHaveBeenCalledWith({
      where: { id: SONG_ID },
      data: { youtubeUrl: CANONICAL, youtubeReviewStatus: 'approved' },
    });
  });

  it('title/singer/albumCoverUrl/teamId는 갱신 대상에 넣지 않는다', async () => {
    const h = createHarness();

    await h.service.update(SONG_ID, CANONICAL);

    const { data } = h.update.mock.calls[0][0];
    expect(Object.keys(data).sort()).toEqual(['youtubeReviewStatus', 'youtubeUrl']);
  });

  it('id를 문자열로 직렬화한다', async () => {
    const h = createHarness({ id: 9007199254740993n, teamId: 9007199254740995n });

    const response = await h.service.update(9007199254740993n, CANONICAL);

    // 2^53을 넘는 id도 정밀도를 잃지 않아야 한다
    expect(response.id).toBe('9007199254740993');
    expect(response.teamId).toBe('9007199254740995');
  });

  it('teamId가 NULL이면 응답도 null이다', async () => {
    const h = createHarness({ teamId: null });

    await expect(h.service.update(SONG_ID, CANONICAL)).resolves.toMatchObject({
      teamId: null,
    });
  });
});

describe('YoutubeUrlService — 상태 전이표', () => {
  it.each([
    ['pending', '미검토 곡에 수동 입력'],
    ['approved', '이미 승인된 곡의 URL 교체'],
    ['rejected', '반려된 곡에 수동 교정'],
  ] as const)('%s → approved (%s)', async (before) => {
    // 사람이 직접 주소를 넣었다는 사실이 자동 추천에 대한 판단보다 우선한다.
    // 특히 rejected는 "추천이 틀렸다"는 뜻이지 "영상이 없다"는 뜻이 아니다.
    const h = createHarness({ youtubeReviewStatus: before });

    const response = await h.service.update(SONG_ID, CANONICAL);

    expect(response.youtubeReviewStatus).toBe('approved');
    expect(h.update.mock.calls[0][0].data.youtubeReviewStatus).toBe('approved');
  });

  it('이미 URL이 있어도 덮어쓴다 (교정이 이 API의 목적)', async () => {
    const h = createHarness({
      youtubeUrl: 'https://www.youtube.com/watch?v=uC56MsZ8J8M',
      youtubeReviewStatus: 'approved',
    });

    const response = await h.service.update(SONG_ID, CANONICAL);

    expect(response.youtubeUrl).toBe(CANONICAL);
  });
});

describe('YoutubeUrlService — 거부', () => {
  it.each([
    ['재생목록', 'https://www.youtube.com/playlist?list=PLabcdefghijk', 'PLAYLIST'],
    ['유튜브 아님', 'https://vimeo.com/123', 'NOT_YOUTUBE'],
    ['호스트 접미사 위조', 'https://youtube.com.evil.example/watch?v=BTo-I-gCAxk', 'NOT_YOUTUBE'],
    ['userinfo 우회', 'https://youtube.com@evil.example/watch?v=BTo-I-gCAxk', 'NOT_YOUTUBE'],
    ['스킴 없음', 'www.youtube.com/watch?v=BTo-I-gCAxk', 'NO_SCHEME'],
    ['http', 'http://www.youtube.com/watch?v=BTo-I-gCAxk', 'INSECURE_SCHEME'],
    ['ID 형식 오류', 'https://www.youtube.com/watch?v=BTo-I-gCAx', 'INVALID_VIDEO_ID'],
    ['v 중복', 'https://www.youtube.com/watch?v=BTo-I-gCAxk&v=uC56MsZ8J8M', 'DUPLICATE_VIDEO_ID'],
    ['채널', 'https://www.youtube.com/@summitband4978', 'NOT_A_VIDEO'],
  ])('%s는 400이고 DB에 쓰지 않는다', async (_name, url, reason) => {
    const h = createHarness();

    await expect(h.service.update(SONG_ID, url)).rejects.toThrow(BadRequestException);
    await expect(h.service.update(SONG_ID, url)).rejects.toThrow(
      YOUTUBE_URL_REJECTION_MESSAGES[
        reason as keyof typeof YOUTUBE_URL_REJECTION_MESSAGES
      ],
    );
    expect(h.update).not.toHaveBeenCalled();
  });

  it('거부 로그에 입력값 전문을 남기지 않는다', async () => {
    const h = createHarness();
    const secretish = 'https://evil.example/watch?v=BTo-I-gCAxk&token=abcdef123456';
    const warn = vi
      .spyOn(
        (h.service as unknown as { logger: { warn: (m: string) => void } }).logger,
        'warn',
      )
      .mockImplementation(() => undefined);

    await expect(h.service.update(SONG_ID, secretish)).rejects.toThrow(
      BadRequestException,
    );

    const logged = warn.mock.calls.map(([message]) => message).join('\n');
    expect(logged).not.toContain('evil.example');
    expect(logged).not.toContain('token=abcdef123456');
    // 사유와 길이는 남아야 원인을 추적할 수 있다
    expect(logged).toContain('NOT_YOUTUBE');
    expect(logged).toContain(String(secretish.length));

    warn.mockRestore();
  });
});

describe('YoutubeUrlService — 없는 곡', () => {
  it('P2025를 404로 바꾼다', async () => {
    // 존재 확인 쿼리를 따로 돌리지 않으므로, 이 매핑이 404의 유일한 경로다.
    const update = vi.fn(async () => {
      throw Object.assign(new Error('record not found'), { code: 'P2025' });
    });
    const prisma = { setlist: { update } } as unknown as PrismaService;

    await expect(
      new YoutubeUrlService(prisma).update(999n, CANONICAL),
    ).rejects.toThrow(NotFoundException);
  });

  it('다른 Prisma 에러는 그대로 올려보낸다', async () => {
    // 404로 뭉개면 연결 실패 같은 장애가 "없는 곡"으로 보인다.
    const update = vi.fn(async () => {
      throw Object.assign(new Error('connection reset'), { code: 'P1017' });
    });
    const prisma = { setlist: { update } } as unknown as PrismaService;

    await expect(
      new YoutubeUrlService(prisma).update(SONG_ID, CANONICAL),
    ).rejects.toThrow('connection reset');
  });

  it('형식이 틀린 URL이면 404보다 400이 먼저다', async () => {
    // 검증을 DB 왕복 뒤에 두면 없는 곡에 대한 400/404가 뒤섞인다.
    const update = vi.fn(async () => {
      throw Object.assign(new Error('record not found'), { code: 'P2025' });
    });
    const prisma = { setlist: { update } } as unknown as PrismaService;

    await expect(
      new YoutubeUrlService(prisma).update(999n, 'https://vimeo.com/123'),
    ).rejects.toThrow(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });
});
