import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AlbumCoverService } from './album-cover.service.js';
import {
  OutboundRateLimitException,
  OutboundRateLimiter,
} from './outbound-rate-limiter.js';
import {
  ItunesTimeoutError,
  ItunesUpstreamError,
  type ItunesClient,
  type ItunesTrack,
} from './itunes.client.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const SONG_ID = 50n;
const ARTWORK_BASE =
  'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/c8/a4/c6/c8a4c64f-89b3-9ef2-473f-4ad423a03c5b/887928030421.jpg';
const VALID_URL = `${ARTWORK_BASE}/600x600bb.jpg`;

const songRow = (albumCoverUrl: string | null = null) => ({
  id: SONG_ID,
  teamId: 12n,
  title: '0+0',
  singer: '한로로',
  albumCoverUrl,
  youtubeUrl: null,
});

const track: ItunesTrack = {
  trackName: '0+0',
  artistName: 'HANRORO',
  collectionName: 'JAMONG SALGU CLUB',
  artworkUrl100: `${ARTWORK_BASE}/100x100bb.jpg`,
};

function createHarness(options: { max?: number } = {}) {
  const findUnique = vi.fn(async () => songRow());
  const update = vi.fn(async (args: { data: { albumCoverUrl: string } }) =>
    songRow(args.data.albumCoverUrl),
  );
  const search = vi.fn(async () => [track]);

  const prisma = { setlist: { findUnique, update } } as unknown as PrismaService;
  const itunes = { search } as unknown as ItunesClient;
  const limiter = new OutboundRateLimiter(options.max ?? 15, 60_000);

  return {
    service: new AlbumCoverService(prisma, itunes, limiter),
    findUnique,
    update,
    search,
  };
}

describe('AlbumCoverService — 후보 조회', () => {
  it('제목+가수로 검색해 후보를 돌려준다', async () => {
    const h = createHarness();

    const candidates = await h.service.findCandidates(SONG_ID);

    expect(h.search).toHaveBeenCalledWith('0+0 한로로');
    expect(candidates).toEqual([
      {
        trackName: '0+0',
        artistName: 'HANRORO',
        collectionName: 'JAMONG SALGU CLUB',
        artworkUrl: VALID_URL,
      },
    ]);
  });

  it('가수가 NULL이면 제목만으로 검색한다', async () => {
    const h = createHarness();
    h.findUnique.mockResolvedValue({ ...songRow(), singer: null });

    await h.service.findCandidates(SONG_ID);

    expect(h.search).toHaveBeenCalledWith('0+0');
  });

  it('결과가 없으면 빈 배열로 200이다(오류가 아니다)', async () => {
    const h = createHarness();
    h.search.mockResolvedValue([]);

    await expect(h.service.findCandidates(SONG_ID)).resolves.toEqual([]);
  });

  it('DB에 쓰지 않는다', async () => {
    const h = createHarness();

    await h.service.findCandidates(SONG_ID);

    expect(h.update).not.toHaveBeenCalled();
  });

  it('없는 곡은 404이고 외부 호출을 하지 않는다', async () => {
    const h = createHarness();
    h.findUnique.mockResolvedValue(null as never);

    await expect(h.service.findCandidates(SONG_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(h.search).not.toHaveBeenCalled();
  });
});

describe('AlbumCoverService — 외부 실패 분류', () => {
  it('타임아웃은 504다', async () => {
    const h = createHarness();
    h.search.mockRejectedValue(new ItunesTimeoutError('timeout'));

    await expect(h.service.findCandidates(SONG_ID)).rejects.toBeInstanceOf(
      GatewayTimeoutException,
    );
  });

  it.each([429, 500, 503])('업스트림 %i는 502다', async (status) => {
    const h = createHarness();
    h.search.mockRejectedValue(new ItunesUpstreamError('failed', status));

    await expect(h.service.findCandidates(SONG_ID)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('업스트림 오류 메시지를 그대로 내보내지 않는다', async () => {
    const h = createHarness();
    h.search.mockRejectedValue(new ItunesUpstreamError('internal detail', 500));

    const error = await h.service
      .findCandidates(SONG_ID)
      .catch((caught: unknown) => caught as Error);

    expect(error.message).not.toContain('internal detail');
  });
});

describe('AlbumCoverService — 아웃바운드 상한', () => {
  it('상한을 넘으면 429이고 재시도 시각을 담는다', async () => {
    const h = createHarness({ max: 2 });

    await h.service.findCandidates(SONG_ID);
    await h.service.findCandidates(SONG_ID);

    const error = await h.service
      .findCandidates(SONG_ID)
      .catch((caught: unknown) => caught as OutboundRateLimitException);

    expect(error).toBeInstanceOf(OutboundRateLimitException);
    expect(error.retryAfterSeconds).toBeGreaterThan(0);
    // 거절된 요청은 외부로 나가지 않는다
    expect(h.search).toHaveBeenCalledTimes(2);
  });

  it('없는 곡으로 인한 404는 예산을 쓰지 않는다', async () => {
    const h = createHarness({ max: 1 });
    h.findUnique.mockResolvedValueOnce(null as never);

    await h.service.findCandidates(SONG_ID).catch(() => undefined);
    // 잘못된 id를 몇 번 친 것만으로 정상 검색이 막히면 안 된다
    await expect(h.service.findCandidates(SONG_ID)).resolves.toHaveLength(1);
  });
});

describe('AlbumCoverService — 반영', () => {
  it('album만 갱신한다', async () => {
    const h = createHarness();

    const response = await h.service.update(SONG_ID, VALID_URL);

    expect(h.update).toHaveBeenCalledWith({
      where: { id: SONG_ID },
      data: { albumCoverUrl: VALID_URL },
    });
    expect(response.albumCoverUrl).toBe(VALID_URL);
  });

  it('title/singer를 건드리지 않는다', async () => {
    const h = createHarness();

    await h.service.update(SONG_ID, VALID_URL);

    const data = h.update.mock.calls[0][0].data as Record<string, unknown>;
    expect(Object.keys(data)).toEqual(['albumCoverUrl']);
  });

  it('id를 문자열로 직렬화해서 돌려준다', async () => {
    const h = createHarness();

    const response = await h.service.update(SONG_ID, VALID_URL);

    expect(response.id).toBe('50');
    expect(response.teamId).toBe('12');
  });

  it('허용되지 않은 URL은 400이고 DB를 건드리지 않는다', async () => {
    const h = createHarness();

    await expect(
      h.service.update(SONG_ID, 'https://evil.example.com/a/600x600bb.jpg'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(h.update).not.toHaveBeenCalled();
  });

  it.each([
    ['http', 'http://is1-ssl.mzstatic.com/image/thumb/A/1.jpg/600x600bb.jpg'],
    ['100x100', `${ARTWORK_BASE}/100x100bb.jpg`],
    ['레거시 상대경로', '/album-yeongdong-gayone.png'],
  ])('%s는 400이다', async (_name, url) => {
    const h = createHarness();

    await expect(h.service.update(SONG_ID, url)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('없는 곡은 P2025를 404로 바꾼다', async () => {
    const h = createHarness();
    h.update.mockRejectedValue({ code: 'P2025' });

    await expect(h.service.update(SONG_ID, VALID_URL)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('외부 API를 호출하지 않는다', async () => {
    const h = createHarness();

    await h.service.update(SONG_ID, VALID_URL);

    // 반영은 순수 DB 작업이다 — 상한 예산을 쓰면 안 된다
    expect(h.search).not.toHaveBeenCalled();
  });
});
