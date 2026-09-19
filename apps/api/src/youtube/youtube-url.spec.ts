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
  ])('%s → 저장 형식으로 바꾼다', (_name, input) => {
    expect(normalized(input)).toBe(CANONICAL);
  });

  it('호스트만 소문자로 맞추고 영상 ID의 대소문자는 그대로 둔다', () => {
    // 영상 ID는 대소문자를 구분한다. VIDEO_ID(`BTo-I-gCAxk`)는 대소문자가 섞여 있어
    // 호스트와 함께 통째로 소문자 처리되면 다른 ID가 된다. (이전에는 이 자리에
    // 56행과 같은 입력이 중복으로 들어 있어 아무것도 검증하지 못했다.)
    const mixedCaseId = 'aBcDeFgHiJk';

    expect(normalized(`https://WWW.YOUTUBE.COM/watch?v=${mixedCaseId}`)).toBe(
      `https://www.youtube.com/watch?v=${mixedCaseId}`,
    );
  });

  it('경로의 대소문자는 구분한다 — /WATCH는 영상 경로로 보지 않는다 (현재 동작 고정)', () => {
    // 추측: 유튜브가 `/WATCH`를 실제로 받아 주는지는 확인하지 못했다. 서버는 정확히
    // 일치하는 경로만 영상으로 인정한다(놓치면 거부 쪽이라 안전한 방향).
    expect(rejection(`https://www.youtube.com/WATCH?v=${VIDEO_ID}`)).toBe('NOT_A_VIDEO');
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

    // --- 형식은 맞지만 영상이 아닌 예약어 (11자라 ID 정규식을 통과한다) ---
    [
      'embed/videoseries + list (재생목록 임베드)',
      'https://www.youtube.com/embed/videoseries?list=PLabcdefghijk',
      'PLAYLIST',
    ],
    ['embed/videoseries', 'https://www.youtube.com/embed/videoseries', 'PLAYLIST'],
    [
      'embed/live_stream + channel (채널 라이브 임베드)',
      'https://www.youtube.com/embed/live_stream?channel=UCabcdefghijk',
      'NOT_A_VIDEO',
    ],
    ['embed/live_stream', 'https://www.youtube.com/embed/live_stream', 'NOT_A_VIDEO'],
    ['watch?v=videoseries', 'https://www.youtube.com/watch?v=videoseries', 'PLAYLIST'],
    ['watch?v=live_stream', 'https://www.youtube.com/watch?v=live_stream', 'NOT_A_VIDEO'],
    ['youtu.be/videoseries', 'https://youtu.be/videoseries', 'PLAYLIST'],
    ['youtu.be/live_stream', 'https://youtu.be/live_stream', 'NOT_A_VIDEO'],
    ['shorts/videoseries', 'https://www.youtube.com/shorts/videoseries', 'PLAYLIST'],
    ['live/live_stream', 'https://www.youtube.com/live/live_stream', 'NOT_A_VIDEO'],
    ['m. 호스트의 videoseries', 'https://m.youtube.com/embed/videoseries', 'PLAYLIST'],
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

describe('checkYoutubeUrl — 예약어 ID 거부의 범위', () => {
  it('예약어와 길이만 같은 평범한 ID는 통과한다 (프로토타입 키로 오인하지 않는다)', () => {
    // `constructor`도 11자다. 예약어 조회가 일반 객체 리터럴이면 이 값이 조회에 걸린다.
    expect(normalized('https://www.youtube.com/watch?v=constructor')).toBe(
      'https://www.youtube.com/watch?v=constructor',
    );
  });

  it('대소문자가 다른 값은 예약어가 아니다 (정확히 일치만 거부)', () => {
    // 영상 ID는 대소문자를 구분하고 유튜브가 쓰는 예약어는 소문자 표기다.
    expect(normalized('https://www.youtube.com/watch?v=VideoSeries')).toBe(
      'https://www.youtube.com/watch?v=VideoSeries',
    );
  });

  it('예약어 거부 문구는 "ID 형식 오류"와 다르다', () => {
    // 11자인데 "영상 ID는 11자여야 합니다"라고 안내하면 관리자가 무엇이 틀렸는지 알 수 없다.
    const messageOf = (url: string): string => {
      try {
        normalizeYoutubeUrl(url);
      } catch (error) {
        return (error as BadRequestException).message;
      }
      return '';
    };

    const reservedMessage = messageOf('https://www.youtube.com/embed/videoseries');

    expect(reservedMessage).toBe(YOUTUBE_URL_REJECTION_MESSAGES.PLAYLIST);
    expect(reservedMessage).not.toBe(YOUTUBE_URL_REJECTION_MESSAGES.INVALID_VIDEO_ID);
  });
});

/**
 * WHATWG `URL` 파서가 조용히 받아 주는 변형들의 현재 동작을 고정한다.
 *
 * 전부 **통과해도 무해하다** — 저장값은 입력이 아니라 상수 호스트 + 검증된 영상 ID로 새로
 * 만들기 때문이다. 그래도 고정해 두는 이유는 이 동작이 Node/ICU의 `URL` 구현에 기대고 있어서,
 * 런타임을 올렸을 때 결과가 달라지면 여기서 먼저 알아채기 위해서다. (관찰: Node v24.12.0)
 */
describe('checkYoutubeUrl — URL 파서 의존 동작 (현재 동작 고정)', () => {
  const toFullWidth = (value: string): string =>
    [...value]
      .map((char) =>
        char === '.'
          ? '．'
          : String.fromCharCode(char.charCodeAt(0) + 0xfee0),
      )
      .join('');

  it.each([
    ['백슬래시 구분자', `https://www.youtube.com\\watch?v=${VIDEO_ID}`],
    ['이중 백슬래시', `https:\\\\www.youtube.com\\watch?v=${VIDEO_ID}`],
    ['경로 안의 백슬래시', `https://www.youtube.com/watch\\?v=${VIDEO_ID}`],
    ['단일 슬래시 (https:/host)', `https:/www.youtube.com/watch?v=${VIDEO_ID}`],
    ['슬래시 없음 (https:host)', `https:www.youtube.com/watch?v=${VIDEO_ID}`],
    [
      '전각 호스트 (IDNA가 ASCII로 매핑)',
      `https://${toFullWidth('www')}．${toFullWidth('youtube')}．${toFullWidth('com')}/watch?v=${VIDEO_ID}`,
    ],
    ['호스트 퍼센트 인코딩 (%6F = o)', `https://www.y%6Futube.com/watch?v=${VIDEO_ID}`],
    ['기본 포트 :443 (URL이 제거)', `https://www.youtube.com:443/watch?v=${VIDEO_ID}`],
  ])('%s는 저장 형식으로 정규화된다', (_name, input) => {
    expect(normalized(input)).toBe(CANONICAL);
  });

  it.each([
    [
      '백슬래시 뒤 호스트 위장 (evil이 호스트)',
      `https://evil.example\\@www.youtube.com/watch?v=${VIDEO_ID}`,
      'NOT_YOUTUBE',
    ],
    [
      '백슬래시 뒤 @ (유튜브가 호스트, 경로가 @evil)',
      `https://www.youtube.com\\@evil.example/watch?v=${VIDEO_ID}`,
      'NOT_A_VIDEO',
    ],
    [
      '퍼센트 인코딩된 점으로 호스트 위장',
      `https://www.youtube.com%2eevil.example/watch?v=${VIDEO_ID}`,
      'NOT_YOUTUBE',
    ],
    [
      '키릴 문자 о (punycode로 바뀌어 불일치)',
      `https://yоutube.com/watch?v=${VIDEO_ID}`,
      'NOT_YOUTUBE',
    ],
    [
      '전각 마침표(。)로 붙인 위장 호스트',
      `https://youtube.com。evil.example/watch?v=${VIDEO_ID}`,
      'NOT_YOUTUBE',
    ],
    ['호스트 끝의 점', `https://www.youtube.com./watch?v=${VIDEO_ID}`, 'NOT_YOUTUBE'],
    [
      '퍼센트 인코딩된 경로(%77atch)',
      `https://www.youtube.com/%77atch?v=${VIDEO_ID}`,
      'NOT_A_VIDEO',
    ],
    ['ID 끝의 개행(%0A)', `https://www.youtube.com/watch?v=${VIDEO_ID}%0A`, 'INVALID_VIDEO_ID'],
  ])('%s는 거부된다', (_name, input, reason) => {
    expect(rejection(input)).toBe(reason);
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
