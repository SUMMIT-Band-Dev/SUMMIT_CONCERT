import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MIN_API_KEY_LENGTH, readBatchApiKey } from './youtube.module.js';
import { YOUTUBE_BATCH_API_KEY_ENV } from './youtube-search.constants.js';

/** 실제 키처럼 보이는 가짜 값. 이 문자열이 에러 메시지에 나오지 않는 것이 핵심 검증이다. */
const FAKE_KEY = 'AIzaSyFAKEKEYFAKEKEYFAKEKEYFAKEKEY123';

/** 설정 저장소를 흉내 낸다. 진짜 ConfigService는 process.env까지 읽어 개발자 셸 상태에 흔들린다. */
const configWith = (value: string | undefined) =>
  ({
    getOrThrow: (name: string) => {
      if (value === undefined) {
        throw new Error(`Configuration key "${name}" does not exist`);
      }
      return value;
    },
  }) as unknown as ConfigService;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('readBatchApiKey — 기동 시 검증 (JWT_SECRET·Storage 키 선례)', () => {
  it('충분히 긴 키를 통과시킨다', () => {
    expect(readBatchApiKey(configWith(FAKE_KEY))).toBe(FAKE_KEY);
  });

  it('앞뒤 공백을 제거한다 (.env 편집 실수 방어)', () => {
    expect(readBatchApiKey(configWith(`  ${FAKE_KEY}\r\n`))).toBe(FAKE_KEY);
  });

  it(`최소 길이(${MIN_API_KEY_LENGTH}자) 경계: ${MIN_API_KEY_LENGTH - 1}자는 거부, ${MIN_API_KEY_LENGTH}자는 통과`, () => {
    expect(() => readBatchApiKey(configWith('a'.repeat(MIN_API_KEY_LENGTH - 1)))).toThrow(
      '너무 짧습니다',
    );
    expect(readBatchApiKey(configWith('a'.repeat(MIN_API_KEY_LENGTH)))).toHaveLength(
      MIN_API_KEY_LENGTH,
    );
  });

  it.each([
    ['빈 문자열', ''],
    ['공백만', '   '],
    ['개행만', '\r\n'],
  ])('%s이면 기동을 막는다', (_label, value) => {
    // `KEY=`만 적어 두고 값을 안 넣은 경우가 가장 흔하다. 통과시키면 첫 배치에서야 실패하고,
    // 그때는 이미 예약 행이 쌓인 뒤다.
    expect(() => readBatchApiKey(configWith(value))).toThrow('너무 짧습니다 (0자)');
  });

  it('아예 없으면 설정 저장소의 예외가 그대로 올라온다', () => {
    expect(() => readBatchApiKey(configWith(undefined))).toThrow(YOUTUBE_BATCH_API_KEY_ENV);
  });

  it('진짜 ConfigService도 키가 없으면 던진다', () => {
    // process.env에 실제 키가 있어도 결과가 흔들리지 않게 명시적으로 지운다.
    vi.stubEnv(YOUTUBE_BATCH_API_KEY_ENV, undefined);

    expect(() => readBatchApiKey(new ConfigService())).toThrow(YOUTUBE_BATCH_API_KEY_ENV);
  });

  it('짧은 키를 거부할 때 메시지에 길이만 싣고 값은 싣지 않는다', () => {
    const shortKey = 'AIzaShortSecret1234'; // 19자

    expect(shortKey).toHaveLength(MIN_API_KEY_LENGTH - 1);
    const error = (() => {
      try {
        readBatchApiKey(configWith(shortKey));
      } catch (caught) {
        return caught as Error;
      }
      return null;
    })();

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toContain('19자');
    expect(error?.message).not.toContain(shortKey);
    expect(error?.message).not.toContain('AIza');
    expect(error?.stack).not.toContain(shortKey);
  });

  it('프론트의 키 이름(YOUTUBE_API_KEY)을 읽지 않는다', () => {
    // 같은 프로젝트에서 키만 두 개 만들면 쿼터 버킷을 공유해 아무 보호가 되지 않는다.
    // 프론트 키가 환경에 있어도 배치 키가 없으면 실패해야 한다.
    vi.stubEnv('YOUTUBE_API_KEY', FAKE_KEY);
    vi.stubEnv(YOUTUBE_BATCH_API_KEY_ENV, undefined);

    expect(() => readBatchApiKey(new ConfigService())).toThrow(YOUTUBE_BATCH_API_KEY_ENV);
  });
});
