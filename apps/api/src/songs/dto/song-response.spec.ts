import { describe, expect, it } from 'vitest';
import { toSongResponse } from './song-response.js';
describe('toSongResponse', () => {
  it.each([3n, null])(
    '계약의 필드만 내보내고 BigInt를 직렬화한다 (teamId=%s)',
    (teamId) => {
      const response = toSongResponse({
        id: 7n,
        teamId,
        title: '0+0',
        singer: '한로로',
        albumCoverUrl: null,
        youtubeUrl: null,
      });
      expect(response).toStrictEqual({
        id: '7',
        teamId: teamId?.toString() ?? null,
        title: '0+0',
        singer: '한로로',
        albumCoverUrl: null,
        youtubeUrl: null,
      });
      expect(() => JSON.stringify(response)).not.toThrow();
    },
  );
});
