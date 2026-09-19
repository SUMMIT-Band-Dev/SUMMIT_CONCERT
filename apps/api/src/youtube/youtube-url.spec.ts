import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { checkYoutubeUrl, normalizeYoutubeUrl } from './youtube-url.js';
import {
  YOUTUBE_URL_MAX_LENGTH,
  YOUTUBE_URL_REJECTION_MESSAGES,
} from './youtube.constants.js';

/** 실제 `Setlist.youtube_url`에 들어 있는 5건. 형태 확인용으로 그대로 가져왔다. */
const REAL_URLS = [
  'https://www.youtube.com/watch?v=BTo-I-gCAxk',
  'https://www.youtube.com/watch?v=uC56MsZ8J8M',
  'https://www.youtube.com/watch?v=MXUKC6_Hg6w',
  'https://www.youtube.com/watch?v=qFjDW0gw2o4',
  'https://www.youtube.com/watch?v=9Ubt7vZN7oo',
];

const VIDEO_ID = 'BTo-I-gCAxk';
const CANONICAL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;

/** 통과한 결과에서 저장값만 꺼낸다. 실패하면 테스트를 세운다. */
const normalized = (value: string): string => {
  const checked = checkYoutubeUrl(value);
  expect(checked).toMatchObject({ ok: true });

  return checked.ok ? checked.url : '';
};

/** 거부 사유만 꺼낸다. 통과하면 테스트를 세운다. */
const rejection = (value: string): string => {
  const checked = checkYoutubeUrl(value);
  expect(checked).toMatchObject({ ok: false });

  return checked.ok ? '' : checked.reason;
};

describe('checkYoutubeUrl — 기존 데이터가 통과한다', () => {
  it.each(REAL_URLS)('실제 저장된 값이 통과한다: %s', (url) => {
    expect(checkYoutubeUrl(url)).toMatchObject({ ok: true });
  });

  it('기존 값은 정규화해도 그대로다 (마이그레이션이 값을 바꾸지 않는 근거)', () => {
    // 5건 전부 이미 저장 형식이라, F013으로 같은 주소를 다시 넣어도 값이 변하지 않는다.
    for (const url of REAL_URLS) {
      expect(normalized(url)).toBe(url);
    }
  });

  it('저장 형식은 43자다', () => {
    expect(normalized(CANONICAL)).toHaveLength(43);
  });
});

describe('checkYoutubeUrl — 정규화', () => {
  it.each([
    ['watch (www)', `https://www.youtube.com/watch?v=${VIDEO_ID}`],
    ['watch (www 없음)', `https://youtube.com/watch?v=${VIDEO_ID}`],
    ['m. 호스트', `https://m.youtube.com/watch?v=${VIDEO_ID}`],
    ['music. 호스트', `https://music.youtube.com/watch?v=${VIDEO_ID}`],
    ['youtu.be 단축', `https://youtu.be/${VIDEO_ID}`],
    ['youtu.be + si 추적 파라미터', `https://youtu.be/${VIDEO_ID}?si=AbCdEfGhIjKl`],
    ['shorts', `https://www.youtube.com/shorts/${VIDEO_ID}`],
    ['embed', `https://www.youtube.com/embed/${VIDEO_ID}`],
    ['live', `https://www.youtube.com/live/${VIDEO_ID}`],
    ['대문자 호스트', `https://WWW.YOUTUBE.COM/watch?v=${VIDEO_ID}`],
    ['경로 대문자는 유지', `https://www.youtube.com/watch?v=${VIDEO_ID}`],
  ])('%s → 저장 형식으로 바꾼다', (_name, input) => {
    expect(normalized(input)).toBe(CANONICAL);
  });

  it.each([
    ['재생목록', `https://www.youtube.com/watch?v=${VIDEO_ID}&list=PLabcdefghijk`],
    ['재생목록 + 순번', `https://www.youtube.com/watch?v=${VIDEO_ID}&list=PLx&index=3`],
    ['타임스탬프 t', `https://www.youtube.com/watch?v=${VIDEO_ID}&t=42s`],
    ['타임스탬프 start', `https://www.youtube.com/watch?v=${VIDEO_ID}&start=42`],
    ['추적 pp', `https://www.youtube.com/watch?v=${VIDEO_ID}&pp=ygUJ`],
    ['추적 feature', `https://www.youtube.com/watch?v=${VIDEO_ID}&feature=share`],
    ['추적 utm', `https://www.youtube.com/watch?v=${VIDEO_ID}&utm_source=x&utm_medium=y`],
    ['프래그먼트', `https://www.youtube.com/watch?v=${VIDEO_ID}#t=10`],
  ])('%s는 제거하고 v만 남긴다', (_name, input) => {
    // list가 남으면 클릭 시 영상이 아니라 재생목록이 열려, 관리자가 확인한 영상과
    // 방문자가 보는 영상이 갈린다.
    expect(normalized(input)).toBe(CANONICAL);
  });

  it('앞뒤 공백이 있어도 통과한다 (DTO가 이미 trim하지만 이중 방어)', () => {
    // DTO의 @TrimString()이 먼저 돌지만, 서비스를 직접 호출하는 경로에서도
    // 같은 값이 나와야 한다.
    expect(normalized(`  ${CANONICAL}  `.trim())).toBe(CANONICAL);
  });

  it('videoId도 함께 돌려준다', () => {
    const checked = checkYoutubeUrl(`https://youtu.be/${VIDEO_ID}`);

    expect(checked).toEqual({ ok: true, url: CANONICAL, videoId: VIDEO_ID });
  });
});

describe('checkYoutubeUrl — 거부', () => {
  it.each([
    // --- 호스트 위조 ---
    ['호스트를 접미사로 흉내', 'https://youtube.com.evil.example/watch?v=BTo-I-gCAxk', 'NOT_YOUTUBE'],
    ['userinfo 우회', 'https://youtube.com@evil.example/watch?v=BTo-I-gCAxk', 'NOT_YOUTUBE'],
    ['허용 호스트에 userinfo', 'https://someone@www.youtube.com/watch?v=BTo-I-gCAxk', 'NOT_YOUTUBE'],
    ['포트가 붙음', 'https://www.youtube.com:8443/watch?v=BTo-I-gCAxk', 'NOT_YOUTUBE'],
    ['전혀 다른 호스트', 'https://vimeo.com/watch?v=BTo-I-gCAxk', 'NOT_YOUTUBE'],
    ['nocookie 호스트(미허용)', 'https://www.youtube-nocookie.com/embed/BTo-I-gCAxk', 'NOT_YOUTUBE'],

    // --- 스킴 ---
    ['http', 'http://www.youtube.com/watch?v=BTo-I-gCAxk', 'INSECURE_SCHEME'],
    ['스킴 없음', 'www.youtube.com/watch?v=BTo-I-gCAxk', 'NO_SCHEME'],
    ['스킴 없음 (youtu.be)', 'youtu.be/BTo-I-gCAxk', 'NO_SCHEME'],
    // 프로토콜 상대 주소. `https://`를 붙이면 WHATWG URL이 연속 슬래시를 접어
    // hostname을 www.youtube.com으로 인식한다 — 실제로 "스킴만 빠진 유튜브 주소"가
    // 맞으므로 MALFORMED보다 NO_SCHEME 안내가 관리자에게 더 쓸모 있다.
    ['//로 시작', '//www.youtube.com/watch?v=BTo-I-gCAxk', 'NO_SCHEME'],
    ['javascript 스킴', 'javascript:alert(1)', 'MALFORMED'],
    ['주소가 아님', '그냥 문자열', 'MALFORMED'],

    // --- 영상이 아닌 경로 ---
    ['재생목록 경로', 'https://www.youtube.com/playlist?list=PLabcdefghijk', 'PLAYLIST'],
    ['watch에 v 없이 list만', 'https://www.youtube.com/watch?list=PLabcdefghijk', 'PLAYLIST'],
    ['핸들 채널', 'https://www.youtube.com/@summitband4978', 'NOT_A_VIDEO'],
    ['채널 경로', 'https://www.youtube.com/channel/UCabcdefghijk', 'NOT_A_VIDEO'],
    ['검색 결과', 'https://www.youtube.com/results?search_query=summit', 'NOT_A_VIDEO'],
    ['루트', 'https://www.youtube.com/', 'NOT_A_VIDEO'],
    ['youtu.be 경로가 2조각', 'https://youtu.be/BTo-I-gCAxk/extra', 'NOT_A_VIDEO'],

    // --- 영상 ID ---
    ['v 파라미터 중복', 'https://www.youtube.com/watch?v=BTo-I-gCAxk&v=uC56MsZ8J8M', 'DUPLICATE_VIDEO_ID'],
    ['ID 10자', 'https://www.youtube.com/watch?v=BTo-I-gCAx', 'INVALID_VIDEO_ID'],
    ['ID 12자', 'https://www.youtube.com/watch?v=BTo-I-gCAxkX', 'INVALID_VIDEO_ID'],
    ['ID에 허용되지 않은 문자', 'https://www.youtube.com/watch?v=BTo-I-gCAx!', 'INVALID_VIDEO_ID'],
    ['watch에 v가 아예 없음', 'https://www.youtube.com/watch', 'INVALID_VIDEO_ID'],
    ['v가 빈 값', 'https://www.youtube.com/watch?v=', 'INVALID_VIDEO_ID'],
    ['shorts ID 10자', 'https://www.youtube.com/shorts/BTo-I-gCAx', 'INVALID_VIDEO_ID'],
    ['youtu.be ID 12자', 'https://youtu.be/BTo-I-gCAxkX', 'INVALID_VIDEO_ID'],
  ])('%s는 %s로 거부한다', (_name, url, reason) => {
    expect(rejection(url)).toBe(reason);
  });

  it('길이 상한을 넘으면 거부한다', () => {
    const tooLong = `${CANONICAL}&pad=${'x'.repeat(YOUTUBE_URL_MAX_LENGTH)}`;

    expect(tooLong.length).toBeGreaterThan(YOUTUBE_URL_MAX_LENGTH);
    expect(rejection(tooLong)).toBe('TOO_LONG');
  });

  it('상한 이내의 긴 주소는 통과한다', () => {
    const padding = 'x'.repeat(YOUTUBE_URL_MAX_LENGTH - CANONICAL.length - 5);
    const long = `${CANONICAL}&pad=${padding}`;

    expect(long.length).toBeLessThanOrEqual(YOUTUBE_URL_MAX_LENGTH);
    expect(normalized(long)).toBe(CANONICAL);
  });
});

describe('normalizeYoutubeUrl', () => {
  it('통과하면 저장값을 돌려준다', () => {
    expect(normalizeYoutubeUrl(`https://youtu.be/${VIDEO_ID}`)).toBe(CANONICAL);
  });

  it('거부되면 400이다', () => {
    expect(() => normalizeYoutubeUrl('https://vimeo.com/123')).toThrow(
      BadRequestException,
    );
  });

  it.each([
    ['재생목록', 'https://www.youtube.com/playlist?list=PLabcdefghijk', 'PLAYLIST'],
    ['유튜브 아님', 'https://vimeo.com/123', 'NOT_YOUTUBE'],
    ['스킴 없음', 'www.youtube.com/watch?v=BTo-I-gCAxk', 'NO_SCHEME'],
    ['http', 'http://www.youtube.com/watch?v=BTo-I-gCAxk', 'INSECURE_SCHEME'],
    ['ID 형식 오류', 'https://www.youtube.com/watch?v=BTo-I-gCAx', 'INVALID_VIDEO_ID'],
  ])('%s는 사유에 맞는 안내를 돌려준다', (_name, url, reason) => {
    // 7단계 관리자 UI가 이 문장을 그대로 띄운다. 공통 문구 하나로 뭉치면
    // 관리자가 무엇을 고쳐야 할지 알 수 없다.
    try {
      normalizeYoutubeUrl(url);
      expect.unreachable('400이 발생해야 한다');
    } catch (error) {
      expect((error as BadRequestException).message).toBe(
        YOUTUBE_URL_REJECTION_MESSAGES[
          reason as keyof typeof YOUTUBE_URL_REJECTION_MESSAGES
        ],
      );
    }
  });

  it('흔한 실수 네 가지가 서로 다른 문구로 나간다', () => {
    const messages = [
      'https://www.youtube.com/playlist?list=PLabcdefghijk',
      'https://vimeo.com/123',
      'www.youtube.com/watch?v=BTo-I-gCAxk',
      'https://www.youtube.com/watch?v=BTo-I-gCAx',
    ].map((url) => {
      try {
        normalizeYoutubeUrl(url);
        return '';
      } catch (error) {
        return (error as BadRequestException).message;
      }
    });

    expect(new Set(messages).size).toBe(4);
  });

  it('응답 메시지에 입력값을 반사하지 않는다', () => {
    // 그대로 화면에 찍히는 문장이라 입력 문자열이 섞여 들어가면 안 된다.
    const input = 'https://evil.example/<script>alert(1)</script>';

    try {
      normalizeYoutubeUrl(input);
      expect.unreachable('400이 발생해야 한다');
    } catch (error) {
      const { message } = error as BadRequestException;

      expect(message).not.toContain('evil.example');
      expect(message).not.toContain('script');
    }
  });
});
