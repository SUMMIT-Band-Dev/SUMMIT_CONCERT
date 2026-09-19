import { describe, expect, it } from 'vitest';
import type { SetlistModel } from '../../generated/prisma/models.js';
import type { YoutubeReviewStatus } from '../../generated/prisma/enums.js';
import { toSongResponse } from './song-response.js';

const baseRow = (
  youtubeReviewStatus: YoutubeReviewStatus,
): SetlistModel => ({
  id: 7n,
  teamId: 3n,
  title: '0+0',
  singer: '한로로',
  albumCoverUrl: 'https://cdn.example/a.jpg',
  youtubeUrl: null,
  youtubeReviewStatus,
});

describe('toSongResponse', () => {
  // toStrictEqual은 키가 하나라도 더 있거나 모자라면 실패한다.
  // 응답 계약(SongResponse)에 필드가 조용히 새어 나가거나 빠지는 것을 막는다.
  it.each<YoutubeReviewStatus>(['pending', 'approved', 'rejected'])(
    'youtubeReviewStatus %s 를 변환 없이 그대로 응답에 싣는다',
    (status) => {
      expect(toSongResponse(baseRow(status))).toStrictEqual({
        id: '7',
        teamId: '3',
        title: '0+0',
        singer: '한로로',
        albumCoverUrl: 'https://cdn.example/a.jpg',
        youtubeUrl: null,
        youtubeReviewStatus: status,
      });
    },
  );

  it('teamId가 null이면 null 그대로, BigInt id는 문자열로 변환한다', () => {
    const response = toSongResponse({ ...baseRow('pending'), teamId: null });

    expect(response).toStrictEqual({
      id: '7',
      teamId: null,
      title: '0+0',
      singer: '한로로',
      albumCoverUrl: 'https://cdn.example/a.jpg',
      youtubeUrl: null,
      youtubeReviewStatus: 'pending',
    });
  });
});
