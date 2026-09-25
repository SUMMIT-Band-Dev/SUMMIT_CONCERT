import {
  YOUTUBE_RESERVED_VIDEO_IDS,
  YOUTUBE_VIDEO_ID_PATTERN,
} from './youtube.constants.js';

/**
 * 저장해도 되는 영상 ID인지 본다 (PRD F011/F012).
 *
 * `checkYoutubeUrl`(F013)은 **URL**을 받는데 배치는 `search.list`가 준 **ID**를 받는다.
 * `watch?v=<id>` 문자열을 만들어 URL 검사기에 되먹이는 우회는 쓰지 않는다 —
 * 그러면 "무엇을 검증했는가"가 호출 지점에서 안 보인다. 대신 URL 검사기가 쓰는 것과
 * **같은 두 상수**를 직접 써서 규칙이 갈라지지 않게 한다.
 *
 * 예약어 검사를 빼놓지 않는 것이 핵심이다. `videoseries`·`live_stream`은 정확히 11자라
 * 형식 검사를 통과하는데 영상이 아니다(§14 교차 리뷰에서 실제로 approved 저장까지 갔던
 * 결함). 배치는 `type=video`로 검색하므로 이런 값이 올 이유가 없지만, **"올 이유가 없다"와
 * "올 수 없다"는 다르다** — §11에서 "P2002는 도달 불가"라고 단정했다가 런타임에서 터진
 * 선례가 있어 방어를 유지한다.
 */
export function isStorableVideoId(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  if (!YOUTUBE_VIDEO_ID_PATTERN.test(value)) {
    return false;
  }

  return !YOUTUBE_RESERVED_VIDEO_IDS.has(value);
}

/**
 * 영상 ID를 저장 형식 URL로 만든다.
 *
 * F013이 저장하는 형식(`https://www.youtube.com/watch?v=<11자>`)과 **같아야 한다.**
 * 프론트 `src/lib/open-track-video.ts`가 저장값을 `new URL(...)`에 try/catch 없이 넣고
 * `autoplay=1`을 붙여 여는 계약이기 때문이다.
 *
 * 호출 전에 `isStorableVideoId`를 통과시키는 것은 호출자 책임이다 — 여기서 다시 검사하면
 * "검사했는데 또 검사하는" 이중 책임이 되고, 실패 시 무엇을 돌려줄지가 애매해진다.
 */
export function toWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
