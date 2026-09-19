import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { SupabaseStorageClient } from './supabase-storage.client.js';
import { StorageRequestError, StorageTimeoutError } from './storage.client.js';

/** 이 문자열이 에러/로그 어디에도 나타나면 안 된다. */
const SECRET = 'sb_secret_DO_NOT_LEAK_0123456789';
const PROJECT_URL = 'https://example-ref.supabase.co';

const env: Record<string, string> = {
  SUPABASE_URL: PROJECT_URL,
  SUPABASE_SECRET_KEY: SECRET,
  SUPABASE_STORAGE_BUCKET: 'team-cards',
};

function createClient(overrides: Partial<Record<string, string>> = {}) {
  const values = { ...env, ...overrides };
  const config = {
    getOrThrow: (key: string) => {
      const value = values[key];
      if (value === undefined) {
        throw new Error(`Configuration key "${key}" does not exist`);
      }
      return value;
    },
    get: (key: string) => values[key],
  } as unknown as ConfigService;

  return new SupabaseStorageClient(config);
}

const okResponse = (body: unknown = {}) =>
  new Response(JSON.stringify(body), { status: 200 });

/** Node의 fetch가 타임아웃으로 거부할 때의 모양. */
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

describe('SupabaseStorageClient — 기동 시 설정 검증', () => {
  it('SUPABASE_SECRET_KEY가 없으면 생성에 실패한다', () => {
    const config = {
      getOrThrow: (key: string) => {
        if (key === 'SUPABASE_SECRET_KEY') {
          throw new Error('Configuration key "SUPABASE_SECRET_KEY" does not exist');
        }
        return PROJECT_URL;
      },
      get: () => undefined,
    } as unknown as ConfigService;

    expect(() => new SupabaseStorageClient(config)).toThrow(
      /SUPABASE_SECRET_KEY/,
    );
  });

  it('값이 공백뿐이면 생성에 실패한다', () => {
    expect(() => createClient({ SUPABASE_SECRET_KEY: '   ' })).toThrow(
      /비어 있을 수 없습니다/,
    );
  });

  it('버킷 이름을 지정하지 않으면 기본값을 쓴다', () => {
    expect(createClient({ SUPABASE_STORAGE_BUCKET: '' }).bucketName).toBe(
      'team-cards',
    );
  });
});

describe('SupabaseStorageClient — 업로드 요청 형태', () => {
  it('storage-js와 같은 메서드·경로·헤더로 보낸다', async () => {
    fetchMock.mockResolvedValue(okResponse());

    await createClient().upload({
      path: '21/abc.jpg',
      body: Buffer.from([0xff, 0xd8, 0xff]),
      contentType: 'image/jpeg',
      cacheControlSeconds: 31_536_000,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `${PROJECT_URL}/storage/v1/object/team-cards/21/abc.jpg`,
    );
    expect(init.method).toBe('POST');

    const headers = init.headers as Record<string, string>;
    // supabase-js가 하위 클라이언트에 넘기는 조합을 그대로 재현한다.
    // secret 키가 Authorization만으로 통하는지 확인하지 못했으므로 둘 다 보낸다.
    expect(headers.apikey).toBe(SECRET);
    expect(headers.authorization).toBe(`Bearer ${SECRET}`);
    // 덮어쓰기 금지 — 경로 충돌은 조용히 덮는 대신 실패해야 한다
    expect(headers['x-upsert']).toBe('false');
    expect(headers['cache-control']).toBe('max-age=31536000');
    // 매직바이트로 판별한 값이 그대로 나가야 한다
    expect(headers['content-type']).toBe('image/jpeg');
  });

  it('프로젝트 URL 끝의 슬래시를 중복시키지 않는다', async () => {
    fetchMock.mockResolvedValue(okResponse());

    await createClient({ SUPABASE_URL: `${PROJECT_URL}/` }).upload({
      path: '1/a.png',
      body: Buffer.from([0x89]),
      contentType: 'image/png',
      cacheControlSeconds: 60,
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      `${PROJECT_URL}/storage/v1/object/team-cards/1/a.png`,
    );
  });

  it('타임아웃 시그널을 건다', async () => {
    fetchMock.mockResolvedValue(okResponse());

    await createClient().upload({
      path: '1/a.jpg',
      body: Buffer.from([0xff]),
      contentType: 'image/jpeg',
      cacheControlSeconds: 60,
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('SupabaseStorageClient — 삭제와 공개 URL', () => {
  it('삭제는 DELETE + prefixes 본문이다', async () => {
    fetchMock.mockResolvedValue(okResponse([]));

    await createClient().remove(['21/abc.jpg']);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${PROJECT_URL}/storage/v1/object/team-cards`);
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(init.body as string)).toEqual({
      prefixes: ['21/abc.jpg'],
    });
  });

  it('공개 URL은 object/public 경로다', () => {
    expect(createClient().getPublicUrl('21/abc.jpg')).toBe(
      `${PROJECT_URL}/storage/v1/object/public/team-cards/21/abc.jpg`,
    );
  });

  it('공개 URL은 next.config의 remotePatterns(**.supabase.co)에 걸린다', () => {
    const { hostname } = new URL(createClient().getPublicUrl('1/a.jpg'));
    expect(hostname.endsWith('.supabase.co')).toBe(true);
  });
});

describe('SupabaseStorageClient — 버킷 조회(스모크 체크)', () => {
  it('스펙 대조에 필요한 필드를 정규화해서 돌려준다', async () => {
    fetchMock.mockResolvedValue(
      okResponse({
        id: 'team-cards',
        public: true,
        file_size_limit: 2_097_152,
        allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'],
      }),
    );

    await expect(createClient().getBucket()).resolves.toEqual({
      id: 'team-cards',
      public: true,
      fileSizeLimit: 2_097_152,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
  });

  it('제한이 비어 있으면 null로 돌려준다', async () => {
    fetchMock.mockResolvedValue(
      okResponse({ id: 'team-cards', public: false }),
    );

    await expect(createClient().getBucket()).resolves.toMatchObject({
      public: false,
      fileSizeLimit: null,
      allowedMimeTypes: null,
    });
  });
});

describe('SupabaseStorageClient — 실패 분류', () => {
  it('타임아웃은 StorageTimeoutError다', async () => {
    fetchMock.mockRejectedValue(timeoutError());

    await expect(
      createClient().upload({
        path: '1/a.jpg',
        body: Buffer.from([0xff]),
        contentType: 'image/jpeg',
        cacheControlSeconds: 60,
      }),
    ).rejects.toBeInstanceOf(StorageTimeoutError);
  });

  it('타임아웃이 cause에 감싸여 와도 StorageTimeoutError다', async () => {
    // Node 버전에 따라 TypeError로 감싸여 오는 경우가 있다. 한쪽만 보면
    // 타임아웃(504)이어야 할 실패가 그 외 실패(502)로 샌다.
    fetchMock.mockRejectedValue(
      Object.assign(new TypeError('fetch failed'), { cause: timeoutError() }),
    );

    await expect(createClient().remove(['1/a.jpg'])).rejects.toBeInstanceOf(
      StorageTimeoutError,
    );
  });

  it('네트워크 실패는 StorageRequestError다', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(createClient().remove(['1/a.jpg'])).rejects.toBeInstanceOf(
      StorageRequestError,
    );
  });

  it('비정상 상태코드는 StorageRequestError이고 status를 담는다', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 413 }));

    await expect(
      createClient().upload({
        path: '1/a.jpg',
        body: Buffer.from([0xff]),
        contentType: 'image/jpeg',
        cacheControlSeconds: 60,
      }),
    ).rejects.toMatchObject({ status: 413 });
  });

  it('버킷 조회 응답이 JSON이 아니면 StorageRequestError다', async () => {
    fetchMock.mockResolvedValue(new Response('<html>', { status: 200 }));

    await expect(createClient().getBucket()).rejects.toBeInstanceOf(
      StorageRequestError,
    );
  });
});

describe('SupabaseStorageClient — 시크릿이 새지 않는다', () => {
  // 이 클라이언트가 만드는 에러는 로그와 응답 경로로 흘러간다.
  // 실패 종류별로 전부 확인한다 — 한 경로만 막아도 나머지로 샌다.
  const failures: Array<[string, () => void]> = [
    ['네트워크 실패', () => fetchMock.mockRejectedValue(new TypeError('fetch failed'))],
    ['타임아웃', () => fetchMock.mockRejectedValue(timeoutError())],
    ['4xx 응답', () => fetchMock.mockResolvedValue(new Response('{}', { status: 403 }))],
    ['5xx 응답', () => fetchMock.mockResolvedValue(new Response('{}', { status: 500 }))],
  ];

  it.each(failures)(
    '%s 에러의 message/stack에 키가 들어 있지 않다',
    async (_name, arrange) => {
      arrange();

      const error = await createClient()
        .upload({
          path: '1/a.jpg',
          body: Buffer.from([0xff]),
          contentType: 'image/jpeg',
          cacheControlSeconds: 60,
        })
        .catch((caught: unknown) => caught as Error);

      const serialized = JSON.stringify({
        message: error.message,
        stack: error.stack,
        // 원본 예외를 cause로 달지 않는다는 것도 함께 고정한다
        cause: (error as { cause?: unknown }).cause,
        own: Object.getOwnPropertyNames(error).map((key) =>
          String((error as unknown as Record<string, unknown>)[key]),
        ),
      });

      expect(serialized).not.toContain(SECRET);
      expect(serialized).not.toContain('Bearer');
      expect(serialized).not.toContain('apikey');
    },
  );

  it('키는 헤더에만 실리고 URL에는 들어가지 않는다', async () => {
    fetchMock.mockResolvedValue(okResponse());

    const client = createClient();
    await client.upload({
      path: '1/a.jpg',
      body: Buffer.from([0xff]),
      contentType: 'image/jpeg',
      cacheControlSeconds: 60,
    });
    await client.remove(['1/a.jpg']);

    for (const [url] of fetchMock.mock.calls as Array<[string]>) {
      expect(url).not.toContain(SECRET);
    }
    expect(client.getPublicUrl('1/a.jpg')).not.toContain(SECRET);
  });
});
