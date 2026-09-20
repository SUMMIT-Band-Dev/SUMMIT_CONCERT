import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HttpYoutubeSearchClient,
  YoutubeApiKeyError,
  YoutubeQuotaExceededError,
  YoutubeTimeoutError,
  YoutubeUpstreamError,
} from './youtube-search.client.js';
import { YOUTUBE_API_KEY_HEADER } from './youtube-search.constants.js';

/** 실제 키처럼 보이는 값. 이 문자열이 어디에도 새지 않는 것이 이 파일의 핵심 검증이다. */
const FAKE_KEY = 'AIzaSyFAKEKEYFAKEKEYFAKEKEYFAKEKEY123';

const okResponse = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

const errorResponse = (status: number, reason?: string) =>
  new Response(
    JSON.stringify(reason ? { error: { errors: [{ reason }] } } : { error: {} }),
    { status, headers: { 'content-type': 'application/json' } },
  );

function stubFetch(impl: (input: unknown, init?: RequestInit) => Promise<Response>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(impl as typeof fetch);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('HttpYoutubeSearchClient — 요청 형태', () => {
  it('API 키를 URL이 아니라 X-goog-api-key 헤더로 보낸다', async () => {
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};
    stubFetch(async (input, init) => {
      capturedUrl = String(input);
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
      return okResponse({ items: [] });
    });

    await new HttpYoutubeSearchClient(FAKE_KEY).search('혜성 윤하');

    expect(capturedHeaders[YOUTUBE_API_KEY_HEADER]).toBe(FAKE_KEY);
    // 구글 문서가 쿼리 방식을 "URL 스캔으로 키가 도난될 수 있다"고 경고한다.
    expect(capturedUrl).not.toContain(FAKE_KEY);
    expect(capturedUrl).not.toContain('key=');
  });

  it('프론트 폴백과 같은 검색 파라미터를 보낸다 (특성 테스트의 전제)', async () => {
    let capturedUrl = '';
    stubFetch(async (input) => {
      capturedUrl = String(input);
      return okResponse({ items: [] });
    });

    await new HttpYoutubeSearchClient(FAKE_KEY).search('혜성 윤하');

    const params = new URL(capturedUrl).searchParams;
    expect(params.get('part')).toBe('snippet');
    expect(params.get('type')).toBe('video');
    expect(params.get('maxResults')).toBe('10');
    expect(params.get('regionCode')).toBe('KR');
    expect(params.get('relevanceLanguage')).toBe('ko');
    expect(params.get('q')).toBe('혜성 윤하');
  });
});

describe('HttpYoutubeSearchClient — 응답 해석', () => {
  it('필요한 필드만 뽑고 썸네일은 medium을 우선한다', async () => {
    stubFetch(async () =>
      okResponse({
        items: [
          {
            id: { videoId: 'BTo-I-gCAxk' },
            snippet: {
              title: '사랑의 미학',
              description: '설명',
              channelTitle: 'Redoor',
              thumbnails: {
                default: { url: 'https://i.ytimg.com/vi/x/default.jpg' },
                medium: { url: 'https://i.ytimg.com/vi/x/mqdefault.jpg' },
                high: { url: 'https://i.ytimg.com/vi/x/hqdefault.jpg' },
              },
            },
          },
        ],
      }),
    );

    const items = await new HttpYoutubeSearchClient(FAKE_KEY).search('q');

    expect(items).toEqual([
      {
        videoId: 'BTo-I-gCAxk',
        title: '사랑의 미학',
        description: '설명',
        channelTitle: 'Redoor',
        thumbnailUrl: 'https://i.ytimg.com/vi/x/mqdefault.jpg',
      },
    ]);
  });

  it('medium이 없으면 high → default 순으로 내려간다', async () => {
    stubFetch(async () =>
      okResponse({
        items: [
          {
            id: { videoId: 'BTo-I-gCAxk' },
            snippet: { thumbnails: { default: { url: 'https://i.ytimg.com/d.jpg' } } },
          },
        ],
      }),
    );

    const [item] = await new HttpYoutubeSearchClient(FAKE_KEY).search('q');

    expect(item.thumbnailUrl).toBe('https://i.ytimg.com/d.jpg');
  });

  it('videoId가 없는 항목은 건너뛴다 (channel/playlist 결과 방어)', async () => {
    stubFetch(async () =>
      okResponse({
        items: [
          { id: { channelId: 'UCxxx' }, snippet: { title: '채널' } },
          { id: { videoId: 'BTo-I-gCAxk' }, snippet: { title: '영상' } },
        ],
      }),
    );

    const items = await new HttpYoutubeSearchClient(FAKE_KEY).search('q');

    expect(items).toHaveLength(1);
    expect(items[0].videoId).toBe('BTo-I-gCAxk');
  });

  it('영상 ID 형식·썸네일 호스트는 여기서 거르지 않는다 (저장 직전에 본다)', async () => {
    // 클라이언트가 걸러 버리면 캘리브레이션이 실제 응답 분포를 관측하지 못해
    // "왜 후보가 0건인지"가 가려진다 (§13 앨범 커버 mapper와 같은 판단).
    stubFetch(async () =>
      okResponse({
        items: [
          {
            id: { videoId: 'videoseries' },
            snippet: { thumbnails: { medium: { url: 'https://evil.example/x.jpg' } } },
          },
        ],
      }),
    );

    const items = await new HttpYoutubeSearchClient(FAKE_KEY).search('q');

    expect(items).toHaveLength(1);
    expect(items[0].videoId).toBe('videoseries');
  });

  it('items가 없거나 배열이 아니면 빈 배열이다 (예외가 아니다)', async () => {
    stubFetch(async () => okResponse({}));
    await expect(new HttpYoutubeSearchClient(FAKE_KEY).search('q')).resolves.toEqual([]);
  });
});

describe('HttpYoutubeSearchClient — 실패 분류', () => {
  it('403 quotaExceeded는 쿼터 초과다', async () => {
    stubFetch(async () => errorResponse(403, 'quotaExceeded'));

    await expect(new HttpYoutubeSearchClient(FAKE_KEY).search('q')).rejects.toBeInstanceOf(
      YoutubeQuotaExceededError,
    );
  });

  it('403 forbidden은 키 오류다 (대응이 완전히 다르다)', async () => {
    stubFetch(async () => errorResponse(403, 'forbidden'));

    await expect(new HttpYoutubeSearchClient(FAKE_KEY).search('q')).rejects.toBeInstanceOf(
      YoutubeApiKeyError,
    );
  });

  it('403인데 reason을 읽지 못하면 보수적으로 키 오류로 본다', async () => {
    // 쿼터 초과로 오분류하면 배치가 조용히 하루를 쉰다. 반대 방향은 즉시 눈에 띈다.
    stubFetch(async () => new Response('not json', { status: 403 }));

    await expect(new HttpYoutubeSearchClient(FAKE_KEY).search('q')).rejects.toBeInstanceOf(
      YoutubeApiKeyError,
    );
  });

  it.each([400, 401])('%d는 키 오류다', async (status) => {
    stubFetch(async () => errorResponse(status, 'keyInvalid'));

    await expect(new HttpYoutubeSearchClient(FAKE_KEY).search('q')).rejects.toBeInstanceOf(
      YoutubeApiKeyError,
    );
  });

  it('429는 쿼터 계열로 본다 (배치를 멈춰야 한다)', async () => {
    stubFetch(async () => errorResponse(429, 'rateLimitExceeded'));

    await expect(new HttpYoutubeSearchClient(FAKE_KEY).search('q')).rejects.toBeInstanceOf(
      YoutubeQuotaExceededError,
    );
  });

  it('5xx는 업스트림 오류다', async () => {
    stubFetch(async () => errorResponse(503));

    await expect(new HttpYoutubeSearchClient(FAKE_KEY).search('q')).rejects.toBeInstanceOf(
      YoutubeUpstreamError,
    );
  });

  it('타임아웃은 전용 오류로 구분된다', async () => {
    stubFetch(async () => {
      throw Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' });
    });

    await expect(new HttpYoutubeSearchClient(FAKE_KEY).search('q')).rejects.toBeInstanceOf(
      YoutubeTimeoutError,
    );
  });

  it('TypeError의 cause에 감싸인 타임아웃도 잡는다', async () => {
    stubFetch(async () => {
      throw Object.assign(new TypeError('fetch failed'), {
        cause: Object.assign(new Error('timeout'), { name: 'TimeoutError' }),
      });
    });

    await expect(new HttpYoutubeSearchClient(FAKE_KEY).search('q')).rejects.toBeInstanceOf(
      YoutubeTimeoutError,
    );
  });

  it('JSON 파싱 실패는 업스트림 오류다', async () => {
    stubFetch(async () => new Response('<html>oops</html>', { status: 200 }));

    await expect(new HttpYoutubeSearchClient(FAKE_KEY).search('q')).rejects.toBeInstanceOf(
      YoutubeUpstreamError,
    );
  });
});

describe('HttpYoutubeSearchClient — 키가 새지 않는다', () => {
  const failures: Array<[string, () => Promise<Response>]> = [
    ['403 quotaExceeded', async () => errorResponse(403, 'quotaExceeded')],
    ['403 forbidden', async () => errorResponse(403, 'forbidden')],
    ['500', async () => errorResponse(500)],
    ['파싱 실패', async () => new Response('nope', { status: 200 })],
  ];

  it.each(failures)('%s 실패의 어디에도 키가 없다', async (_label, respond) => {
    stubFetch(respond);

    const error = await new HttpYoutubeSearchClient(FAKE_KEY)
      .search('q')
      .then(() => null)
      .catch((caught: unknown) => caught as Error);

    expect(error).toBeInstanceOf(Error);
    const serialized = [
      error?.message,
      error?.stack,
      String((error as { cause?: unknown })?.cause ?? ''),
      JSON.stringify(error, Object.getOwnPropertyNames(error ?? {})),
    ].join('\n');

    expect(serialized).not.toContain(FAKE_KEY);
    expect(serialized).not.toContain('AIza');
  });

  it('네트워크 예외도 원본을 감싸지 않아 요청 URL이 새지 않는다', async () => {
    stubFetch(async () => {
      throw new TypeError('fetch failed: https://www.googleapis.com/youtube/v3/search?q=...');
    });

    const error = await new HttpYoutubeSearchClient(FAKE_KEY)
      .search('q')
      .then(() => null)
      .catch((caught: unknown) => caught as Error);

    expect(error?.message).toBe('유튜브 검색 요청에 실패했습니다.');
    expect(error?.message).not.toContain('googleapis.com');
  });
});
