import type { SetlistModel } from '../../generated/prisma/models.js';
import type { YoutubeReviewStatus } from '../../generated/prisma/enums.js';

/**
 * 곡 API의 응답 계약 (PRD 데이터 모델 기준 이름).
 *
 * §11의 `TeamResponse`와 같은 방식이다 — 전역 인터셉터가 아니라 매퍼를 두어
 * **이 타입 자체가 API 계약**이 되게 한다. 공용 BigInt 헬퍼로 빼지 않은 이유는
 * 공유되는 로직이 `id.toString()` 한 줄뿐이라 모델별 매퍼가 그대로 남기 때문이다
 * (인터셉터 재판단은 §11에서 6단계로 이월한 항목).
 */
export interface SongResponse {
  /** `Setlist.id`. DB는 int8이지만 JSON에 실을 수 있도록 문자열로 변환한다 */
  id: string;
  /** `Setlist.teamId`. 컬럼이 nullable이라 응답도 null을 허용한다 */
  teamId: string | null;
  title: string;
  singer: string | null;
  /** `album`. 5단계(PRD F010)부터 `PUT /songs/:id/album-cover`로 갱신된다 */
  albumCoverUrl: string | null;
  /** `youtube_url`. 6단계 1/2(PRD F013)부터 `PUT /songs/:id/youtube-url`로 갱신된다 */
  youtubeUrl: string | null;
  /**
   * `youtube_review_status`. **읽기 전용이다** — 클라이언트가 직접 정하지 않는다.
   *
   * F013으로 URL을 넣으면 서버가 `approved`로 확정하고, 배치 추천의 승인·반려
   * (F011/F012, 6단계 2/2)가 나머지 전이를 담당한다. 컬럼이 `NOT NULL DEFAULT 'pending'`
   * 이라 응답도 null을 허용하지 않는다.
   */
  youtubeReviewStatus: YoutubeReviewStatus;
}

export function toSongResponse(song: SetlistModel): SongResponse {
  return {
    id: song.id.toString(),
    teamId: song.teamId === null ? null : song.teamId.toString(),
    title: song.title,
    singer: song.singer,
    albumCoverUrl: song.albumCoverUrl,
    youtubeUrl: song.youtubeUrl,
    youtubeReviewStatus: song.youtubeReviewStatus,
  };
}
