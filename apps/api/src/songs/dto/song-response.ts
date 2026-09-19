import type { SetlistModel } from '../../generated/prisma/models.js';

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
  /** `album`. 자동 매칭(PRD F010)은 이후 단계라 이번 단계에서는 읽기 전용이다 */
  albumCoverUrl: string | null;
  /** `youtube_url`. 배치 검색/리뷰(PRD F011~F013)는 6단계라 읽기 전용이다 */
  youtubeUrl: string | null;
}

export function toSongResponse(song: SetlistModel): SongResponse {
  return {
    id: song.id.toString(),
    teamId: song.teamId === null ? null : song.teamId.toString(),
    title: song.title,
    singer: song.singer,
    albumCoverUrl: song.albumCoverUrl,
    youtubeUrl: song.youtubeUrl,
  };
}
