import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HttpItunesClient,
  ItunesTimeoutError,
  ItunesUpstreamError,
} from './itunes.client.js';

/**
 * 실제 응답에서 뽑은 최소 fixture.
 *
 * Content-Type이 `text/javascript; charset=utf-8`인데도 `response.json()`이
 * 동작하는 것을 실제 호출로 확인했다 — 여기서도 같은 헤더로 재현한다.
 */
const REAL_RESPONSE = {
  resultCount: 1,
  results: [
    {
      wrapperType: 'track',
      kind: 'song',
      artistName: 'HANRORO',
      collectionName: 'JAMONG SALGU CLUB',
      trackName: '0+0',
      artworkUrl60:
        'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/c8/a4/c6/c8a4c64f-89b3-9ef2-473f-4ad423a03c5b/887928030421.jpg/60x60bb.jpg',
      artworkUrl100:
        'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/c8/a4/c6/c8a4c64f-89b3-9ef2-473f-4ad423a03c5b/887928030421.jpg/100x100bb.jpg',
      country: 'USA',
      primaryGenreName: 'Rock',
    },
  ],
};

const itunesResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'text/javascript; charset=utf-8' },
  });

const timeoutError = () =>
  Object.assign(new Error('The operation was aborted'), {
    name: 'TimeoutError',
  });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HttpItunesClient — 요청', () => {
  it('country=US로 검색한다', async () => {
    fetchMock.mockResolvedValue(itunesResponse(REAL_RESPONSE));

    await new HttpItunesClient().search('0+0 한로로');

    const url = fetchMock.mock.calls[0][0] as URL;
    // KR 스토어프런트는 한국어·영어 쿼리 모두 resultCount 0이라 쓸 수 없다
    expect(url.searchParams.get('country')).toBe('US');
    expect(url.searchParams.get('term')).toBe('0+0 한로로');
    expect(url.searchParams.get('media')).toBe('music');
    expect(url.searchParams.get('entity')).toBe('song');
  });

  it('후보 5개를 채우려고 10개를 요청한다', async () => {
    fetchMock.mockResolvedValue(itunesResponse(REAL_RESPONSE));

    await new HttpItunesClient().search('곡');

    // 같은 앨범 수록곡이 중복 제거로 뭉개지므로 여유를 두고 받는다
    expect((fetchMock.mock.calls[0][0] as URL).searchParams.get('limit')).toBe(
      '10',
    );
  });

  it('타임아웃 시그널을 건다', async () => {
    fetchMock.mockResolvedValue(itunesResponse(REAL_RESPONSE));

    await new HttpItunesClient().search('곡');

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('HttpItunesClient — 응답 해석', () => {
  it('실제 응답에서 results 배열을 꺼낸다', async () => {
    fetchMock.mockResolvedValue(itunesResponse(REAL_RESPONSE));

    const tracks = await new HttpItunesClient().search('0+0 한로로');

    expect(tracks).toHaveLength(1);
    expect(tracks[0]).toMatchObject({
      trackName: '0+0',
      artistName: 'HANRORO',
    });
  });

  it('결과 0건은 빈 배열이고 오류가 아니다', async () => {
    // KR 스토어프런트가 실제로 이 모양을 돌려준다 (HTTP 200 + resultCount 0)
    fetchMock.mockResolvedValue(itunesResponse({ resultCount: 0, results: [] }));

    await expect(new HttpItunesClient().search('없는 곡')).resolves.toEqual([]);
  });

  it('results가 없거나 배열이 아니면 빈 배열로 본다', async () => {
    fetchMock.mockResolvedValue(itunesResponse({ resultCount: 0 }));

    await expect(new HttpItunesClient().search('곡')).resolves.toEqual([]);
  });
});

describe('HttpItunesClient — 실패 분류', () => {
  it('타임아웃은 ItunesTimeoutError다', async () => {
    fetchMock.mockRejectedValue(timeoutError());

    await expect(new HttpItunesClient().search('곡')).rejects.toBeInstanceOf(
      ItunesTimeoutError,
    );
  });

  it('타임아웃이 cause에 감싸여 와도 ItunesTimeoutError다', async () => {
    fetchMock.mockRejectedValue(
      Object.assign(new TypeError('fetch failed'), { cause: timeoutError() }),
    );

    await expect(new HttpItunesClient().search('곡')).rejects.toBeInstanceOf(
      ItunesTimeoutError,
    );
  });

  it.each([429, 500, 503, 403])(
    'HTTP %i는 ItunesUpstreamError이고 status를 담는다',
    async (status) => {
      fetchMock.mockResolvedValue(itunesResponse({}, status));

      await expect(new HttpItunesClient().search('곡')).rejects.toMatchObject({
        status,
      });
    },
  );

  it('네트워크 실패는 ItunesUpstreamError다', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(new HttpItunesClient().search('곡')).rejects.toBeInstanceOf(
      ItunesUpstreamError,
    );
  });

  it('JSON이 아니면 ItunesUpstreamError다', async () => {
    fetchMock.mockResolvedValue(new Response('<html>', { status: 200 }));

    await expect(new HttpItunesClient().search('곡')).rejects.toBeInstanceOf(
      ItunesUpstreamError,
    );
  });
});
