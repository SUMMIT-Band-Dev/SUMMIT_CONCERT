import { describe, expect, it } from 'vitest';
import { LOCK_ORDER, locksBefore } from './lock-order.js';

/**
 * 잠금 순서는 데드락 방지의 전부다. 상수를 고치는 순간 이 테스트가 깨져서,
 * "왜 이 순서인지"를 `lock-order.ts` 주석에서 다시 읽게 만든다.
 */
describe('LOCK_ORDER', () => {
  it('Line Up → Setlist → YoutubeSearchAttempt 순이다', () => {
    expect([...LOCK_ORDER]).toEqual(['Line Up', 'Setlist', 'YoutubeSearchAttempt']);
  });

  it('실제 경로들이 전부 이 순서의 부분열이다', () => {
    // lock-order.ts의 표를 코드로 옮긴 것이다. 새 경로를 추가하면 여기에도 줄을 더한다.
    const paths: Array<[string, Array<(typeof LOCK_ORDER)[number]>]> = [
      ['곡 등록', ['Line Up', 'Setlist']],
      ['곡 수정', ['Line Up', 'Setlist', 'YoutubeSearchAttempt']],
      ['F013 URL 수동 입력', ['Setlist', 'YoutubeSearchAttempt']],
      ['F012 승인', ['Setlist', 'YoutubeSearchAttempt']],
      ['F012 반려', ['Setlist', 'YoutubeSearchAttempt']],
      ['재큐', ['Setlist', 'YoutubeSearchAttempt']],
      ['배치 예약·완료', ['YoutubeSearchAttempt']],
    ];

    for (const [name, sequence] of paths) {
      const indices = sequence.map((table) => LOCK_ORDER.indexOf(table));
      const ascending = indices.every(
        (value, position) => position === 0 || indices[position - 1] < value,
      );

      expect(ascending, `${name}가 전역 순서를 거스른다`).toBe(true);
    }
  });

  it('locksBefore가 순서를 그대로 반영한다', () => {
    expect(locksBefore('Line Up', 'Setlist')).toBe(true);
    expect(locksBefore('Setlist', 'YoutubeSearchAttempt')).toBe(true);
    expect(locksBefore('YoutubeSearchAttempt', 'Setlist')).toBe(false);
    expect(locksBefore('Setlist', 'Setlist')).toBe(false);
  });
});
