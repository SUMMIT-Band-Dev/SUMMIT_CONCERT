import {
  YOUTUBE_RESERVED_VIDEO_IDS,
  YOUTUBE_VIDEO_ID_PATTERN,
} from './youtube.constants.js';

/** URL에서 추출한 영상 ID의 형식과 예약어를 검사한다 (F025). */
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
