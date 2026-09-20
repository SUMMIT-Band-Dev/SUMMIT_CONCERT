import { describe, expect, it } from 'vitest';
import { isStorableVideoId, toWatchUrl } from './youtube-video-id.js';
import { checkYoutubeUrl } from './youtube-url.js';

describe('isStorableVideoId', () => {
  it.each(['BTo-I-gCAxk', 'uC56MsZ8J8M', 'MXUKC6_Hg6w', 'qFjDW0gw2o4', '9Ubt7vZN7oo'])(
    '실제 승인된 영상 ID를 통과시킨다: %s',
    (videoId) => {
      expect(isStorableVideoId(videoId)).toBe(true);
    },
  );

  it.each([
    ['10자', 'BTo-I-gCAx'],
    ['12자', 'BTo-I-gCAxkk'],
    ['빈 문자열', ''],
    ['허용되지 않는 문자(+)', 'BTo+I-gCAxk'],
    ['공백 포함', 'BTo I-gCAxk'],
    ['한글', '가나다라마바사아자차카'],
  ])('형식이 틀리면 거부한다: %s', (_label, videoId) => {
    expect(isStorableVideoId(videoId)).toBe(false);
  });

  it.each([
    ['videoseries (재생목록 임베드)', 'videoseries'],
    ['live_stream (채널 라이브 임베드)', 'live_stream'],
  ])('11자지만 영상이 아닌 예약어는 거부한다: %s', (_label, videoId) => {
    // §14 교차 리뷰에서 실제로 approved 저장까지 갔던 결함이다.
    // 형식 검사만으로는 잡히지 않는다 — 둘 다 정확히 11자다.
    expect(videoId).toHaveLength(11);
    expect(isStorableVideoId(videoId)).toBe(false);
  });

  it('constructor처럼 프로토타입에 있는 11자 문자열은 예약어가 아니다', () => {
    // 예약어 조회에 객체 리터럴이 아니라 Map을 쓰는 이유가 이것이다.
    expect('constructor').toHaveLength(11);
    expect(isStorableVideoId('constructor')).toBe(true);
  });

  it.each([null, undefined, 123, {}, []])('문자열이 아니면 거부한다: %s', (value) => {
    expect(isStorableVideoId(value)).toBe(false);
  });
});

describe('toWatchUrl', () => {
  it('F013이 저장하는 형식과 정확히 같다', () => {
    // 프론트 open-track-video.ts가 저장값을 try/catch 없이 new URL에 넣는 계약이라
    // 두 경로(F012 승인 / F013 수동 입력)가 같은 형식을 써야 한다.
    const videoId = 'BTo-I-gCAxk';
    const fromBatch = toWatchUrl(videoId);
    const fromManual = checkYoutubeUrl(`https://youtu.be/${videoId}?si=abc`);

    expect(fromManual.ok).toBe(true);
    expect(fromBatch).toBe(fromManual.ok ? fromManual.url : '');
    expect(fromBatch).toBe('https://www.youtube.com/watch?v=BTo-I-gCAxk');
  });

  it('만들어진 URL은 프론트가 파싱할 수 있다', () => {
    expect(() => new URL(toWatchUrl('BTo-I-gCAxk'))).not.toThrow();
  });
});
