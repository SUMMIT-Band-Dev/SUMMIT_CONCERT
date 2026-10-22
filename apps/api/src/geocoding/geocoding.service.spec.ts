import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeocodingService } from './geocoding.service.js';
import {
  GEOCODE_FAILED_MESSAGE,
  GEOCODE_NOT_FOUND_MESSAGE,
  GEOCODE_TIMEOUT_MESSAGE,
  GEOCODE_TIMEOUT_MS,
  NAVER_GEOCODE_ENDPOINT,
} from './geocoding.constants.js';
import { GeocodingModule } from './geocoding.module.js';

const address = '서울특별시 마포구 양화로 100-10';
const keys = {
  NAVER_MAP_CLIENT_ID: 'test-private-id',
  NAVER_MAP_CLIENT_SECRET: 'test-private-secret',
};
function service(values: Record<string, unknown> = keys) {
  return new GeocodingService({
    get: (name: string) => values[name],
  } as ConfigService);
}
const first = {
  x: '126.91',
  y: '37.55',
  roadAddress: '도로명 주소',
  jibunAddress: '지번 주소',
};
const body = (value: unknown = first) => ({
  status: 'OK',
  addresses: [value, { ...first, y: '38' }],
});
function stub(body: unknown, status = 200) {
  const fetchStub = vi
    .fn()
    .mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: vi.fn().mockResolvedValue(body),
    });
  vi.stubGlobal('fetch', fetchStub);
  return fetchStub;
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Geocoding 설정과 요청', () => {
  it.each(['NAVER_MAP_CLIENT_ID', 'NAVER_MAP_CLIENT_SECRET'])(
    '%s가 없거나 공백이면 값 노출 없이 기동을 막는다',
    (key) => {
      for (const value of [undefined, '', '   ', null]) {
        expect(() => service({ ...keys, [key]: value })).toThrow(key);
        try {
          service({ ...keys, [key]: value });
        } catch (error) {
          expect(String(error)).not.toContain(keys.NAVER_MAP_CLIENT_ID);
          expect(String(error)).not.toContain(keys.NAVER_MAP_CLIENT_SECRET);
        }
      }
    },
  );
  it('인증 키를 trim하고 지정 쿼리·헤더·타임아웃으로 한 번 요청한다', async () => {
    const fetchStub = stub(body());
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const result = await service(
      Object.fromEntries(
        Object.entries(keys).map(([key, value]) => [key, `  ${value}  `]),
      ),
    ).geocode(address);
    expect(result).toEqual({
      latitude: 37.55,
      longitude: 126.91,
      roadAddress: '도로명 주소',
    });
    expect(fetchStub).toHaveBeenCalledTimes(1);
    const [url, options] = fetchStub.mock.calls[0];
    expect(url.origin + url.pathname).toBe(NAVER_GEOCODE_ENDPOINT);
    expect([...url.searchParams]).toEqual([
      ['query', address],
      ['count', '1'],
    ]);
    expect(options).toEqual({
      method: 'GET',
      headers: {
        'x-ncp-apigw-api-key-id': keys.NAVER_MAP_CLIENT_ID,
        'x-ncp-apigw-api-key': keys.NAVER_MAP_CLIENT_SECRET,
        accept: 'application/json',
      },
      redirect: 'error',
      signal: expect.any(AbortSignal),
    });
    expect(timeout).toHaveBeenCalledExactlyOnceWith(GEOCODE_TIMEOUT_MS);
  });
  it.each([
    ['', '지번 주소', '지번 주소'],
    ['', '', address],
  ])(
    '빈 도로명 주소는 지번·입력 주소로 대체한다',
    async (roadAddress, jibunAddress, expected) => {
      stub(body({ ...first, roadAddress, jibunAddress }));
      expect((await service().geocode(address)).roadAddress).toBe(expected);
    },
  );
  it('비전역 모듈이 서비스를 제공하고 내보낸다', () => {
    expect(Reflect.getMetadata('providers', GeocodingModule)).toEqual([
      GeocodingService,
    ]);
    expect(Reflect.getMetadata('exports', GeocodingModule)).toEqual([
      GeocodingService,
    ]);
    expect(Reflect.getMetadata('__module:global__', GeocodingModule)).not.toBe(
      true,
    );
  });
});

describe('Geocoding 실패 매핑과 비밀값 보호', () => {
  type Row = [string, unknown, number, number, string];
  const rows: Row[] = [
    [
      '0건',
      { status: 'OK', addresses: [] },
      200,
      404,
      GEOCODE_NOT_FOUND_MESSAGE,
    ],
    ...[400, 401, 403, 429, 500, 503].map((status): Row => [
      `HTTP ${status}`,
      body(),
      status,
      502,
      GEOCODE_FAILED_MESSAGE,
    ]),
    [
      '오류 상태',
      { ...body(), status: 'ERROR' },
      200,
      502,
      GEOCODE_FAILED_MESSAGE,
    ],
    ['배열 누락', { status: 'OK' }, 200, 502, GEOCODE_FAILED_MESSAGE],
    ['본문 null', null, 200, 502, GEOCODE_FAILED_MESSAGE],
    ...[
      null,
      { ...first, x: 'NaN' },
      { ...first, y: '91' },
      { ...first, y: '-91' },
      { ...first, x: '181' },
      { ...first, x: '-181' },
      { ...first, x: '' },
      { ...first, y: null },
      { ...first, x: 'Infinity' },
    ].map((value): Row => [
      '좌표 이상',
      body(value),
      200,
      502,
      GEOCODE_FAILED_MESSAGE,
    ]),
  ];
  it.each(rows)(
    '%s 응답은 정해진 상태·문구를 반환한다',
    async (_name, payload, httpStatus, status, message) => {
      const warn = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      const fetchStub = stub(payload, httpStatus as number);
      const operation = service().geocode(address);
      await expect(operation).rejects.toMatchObject({ status, message });
      expect(fetchStub).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledTimes(1);
      const logged = JSON.stringify(warn.mock.calls);
      for (const secret of [...Object.values(keys), address])
        expect(logged).not.toContain(secret);
    },
  );
  it.each(['network', 'timeout', 'json', 'body-timeout'])(
    '%s 오류도 민감한 오류 원문을 노출하지 않는다',
    async (kind) => {
      const warn = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      const error = Object.assign(
        new Error(`${address} ${Object.values(keys).join(' ')}`),
        { name: kind.includes('timeout') ? 'TimeoutError' : 'Error' },
      );
      const fetchStub = stub(body());
      if (kind === 'json' || kind === 'body-timeout')
        fetchStub.mockResolvedValue({
          ok: true,
          json: vi.fn().mockRejectedValue(error),
        });
      else fetchStub.mockRejectedValue(error);
      const timeout = kind.includes('timeout');
      await expect(service().geocode(address)).rejects.toMatchObject({
        status: timeout ? 504 : 502,
        message: timeout ? GEOCODE_TIMEOUT_MESSAGE : GEOCODE_FAILED_MESSAGE,
      });
      expect(warn).toHaveBeenCalledExactlyOnceWith(
        timeout ? 'timeout' : kind === 'json' ? 'invalid-response' : 'network',
      );
      expect(fetchStub).toHaveBeenCalledTimes(1);
    },
  );
});
