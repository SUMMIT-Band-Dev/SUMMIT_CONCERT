import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONTENT_TAGS } from './content-tags.js';
import { RevalidationService } from './revalidation.service.js';

const secret = 'test-only-revalidate-'.repeat(3);
function createService(values: Record<string, unknown> = {}) {
  const config = {
    PUBLIC_SITE_URL: 'https://summit-concert.live',
    REVALIDATE_SECRET: secret,
    ...values,
  };
  return new RevalidationService({
    get: (key: keyof typeof config) => config[key],
  } as unknown as ConfigService);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('재검증 태그와 필수 설정', () => {
  it('공개 사이트와 공유할 태그의 값과 순서가 명세와 같다', () => {
    expect(CONTENT_TAGS).toEqual([
      'concert',
      'venue',
      'performance-days',
      'ticket',
      'info-sections',
      'lineup',
    ]);
  });

  it.each([
    undefined,
    '',
    '  ',
    'http://example.com',
    'ftp://example.com',
    'https://example.com/',
    'https://example.com/path',
    'https://user:password@example.com',
    'https://example.com?key=value',
    'https://example.com#anchor',
    'https://example.com?',
    'https://example.com#',
    'http://[::1]:3000',
    'invalid-url',
  ])('허용하지 않는 PUBLIC_SITE_URL을 거부한다: %s', (value) => {
    expect(() => createService({ PUBLIC_SITE_URL: value })).toThrow(
      /PUBLIC_SITE_URL/,
    );
    try {
      createService({ PUBLIC_SITE_URL: value });
    } catch (error) {
      const message = (error as Error).message;
      if (typeof value === 'string' && value.trim())
        expect(message).not.toContain(value);
      expect(message).not.toContain(secret);
    }
  });

  it.each([undefined, '', ' ', 'a'.repeat(31), ` ${'a'.repeat(31)} `])(
    '약하거나 없는 시크릿을 거부한다',
    (value) => {
      expect(() => createService({ REVALIDATE_SECRET: value })).toThrow(
        /REVALIDATE_SECRET/,
      );
      try {
        createService({ REVALIDATE_SECRET: value });
      } catch (error) {
        if (typeof value === 'string' && value.trim())
          expect((error as Error).message).not.toContain(value.trim());
      }
    },
  );

  it.each([
    'https://summit-concert.live',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ])('유효한 주소를 허용한다: %s', (value) => {
    expect(() =>
      createService({
        PUBLIC_SITE_URL: value,
        REVALIDATE_SECRET: 'a'.repeat(32),
      }),
    ).not.toThrow();
  });
});

describe('RevalidationService.revalidate', () => {
  it('공백을 제거한 설정, 중복 없는 태그, 시크릿 헤더, 리다이렉트 금지와 5초 제한으로 요청한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const signal = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(signal);
    const service = createService({
      PUBLIC_SITE_URL: ' https://summit-concert.live ',
      REVALIDATE_SECRET: ` ${secret} `,
    });

    await expect(
      service.revalidate(['concert', 'venue', 'concert']),
    ).resolves.toBe(true);
    expect(timeout).toHaveBeenCalledExactlyOnceWith(5000);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      'https://summit-concert.live/api/revalidate',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-revalidate-secret': secret,
        },
        body: JSON.stringify({ tags: ['concert', 'venue'] }),
        redirect: 'error',
        signal,
      },
    );
  });

  it.each([200, 204, 299])('HTTP %i면 true이고 경고가 없다', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status })),
    );
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    await expect(createService().revalidate(['ticket'])).resolves.toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it('빈 배열은 요청하지 않는다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(createService().revalidate([])).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([301, 400, 404, 500])(
    'HTTP %i는 false와 안전한 경고 한 줄을 돌려주며 재시도하지 않는다',
    async (status) => {
      const body = vi.fn();
      const fetchMock = vi
        .fn()
        .mockResolvedValue({ ok: false, status, text: body, json: body });
      vi.stubGlobal('fetch', fetchMock);
      const warn = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      await expect(createService().revalidate(['ticket'])).resolves.toBe(false);
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(warn).toHaveBeenCalledExactlyOnceWith(
        `재검증 실패 tags=ticket HTTP ${status}`,
      );
      expect(JSON.stringify(warn.mock.calls)).not.toContain(secret);
      expect(body).not.toHaveBeenCalled();
    },
  );

  it.each([
    [new Error(secret), 'network'],
    [new TypeError('redirect encountered'), 'network'],
    [new DOMException(secret, 'TimeoutError'), 'timeout'],
    [new DOMException(secret, 'AbortError'), 'timeout'],
    [
      new TypeError(secret, {
        cause: new DOMException(secret, 'TimeoutError'),
      }),
      'timeout',
    ],
  ])(
    '네트워크·리다이렉트·타임아웃 예외를 전파하거나 로그에 노출하지 않는다',
    async (error, kind) => {
      const fetchMock = vi.fn().mockRejectedValue(error);
      vi.stubGlobal('fetch', fetchMock);
      const warn = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      await expect(createService().revalidate(['lineup'])).resolves.toBe(false);
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(warn).toHaveBeenCalledExactlyOnceWith(
        `재검증 실패 tags=lineup ${kind}`,
      );
      expect(JSON.stringify(warn.mock.calls)).not.toContain(secret);
    },
  );
});
