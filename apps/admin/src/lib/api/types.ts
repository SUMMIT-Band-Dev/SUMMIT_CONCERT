// API 계약 타입 (apps/api 응답을 손으로 옮긴 것).
//
// ⚠️ 드리프트 위험: API에 OpenAPI 스펙이 없어 이 파일은 자동 생성되지 않는다. 그래서
//  1) 각 타입 위에 **미러링하는 API 쪽 정의의 위치**를 적는다 — API를 바꾸는 PR은 여기를 함께 확인한다
//  2) 화면은 이 타입을 신뢰하되, 값이 비어 있거나 모양이 다를 가능성을 화면 코드가 방어한다(특히 7c-2 이후 목록)
// 근본 대책은 API의 OpenAPI 노출이다(REFACTOR_NOTES §18 "API 요청 목록").

/** 미러링: apps/api/src/auth/auth.service.ts `LoginResult` */
export interface LoginResult {
  accessToken: string;
}

/** 미러링: apps/api/src/auth/auth.service.ts `AdminProfile`. id는 DB가 int8이라 문자열이다 */
export interface AdminProfile {
  id: string;
  username: string;
}

/** 로그인 요청. 검증 규칙은 apps/api/src/auth/dto/login.dto.ts 와 같아야 한다(auth/login-schema.ts) */
export interface LoginCredentials {
  username: string;
  password: string;
}

/** 미러링: apps/api/src/songs/dto/song-response.ts `YoutubeReviewStatus`(Prisma enum) */
export type YoutubeReviewStatus = "pending" | "approved" | "rejected";

/** 미러링: apps/api/src/songs/dto/song-response.ts `SongResponse` */
export interface Song {
  id: string;
  /** 컬럼이 nullable이라 응답도 null을 허용한다 */
  teamId: string | null;
  title: string;
  singer: string | null;
  /** `album`. `PUT /songs/:id/album-cover`로만 갱신된다(곡 수정 DTO에는 없다) */
  albumCoverUrl: string | null;
  youtubeUrl: string | null;
  /** **읽기 전용.** 제목·가수가 실제로 바뀌면 서버가 `pending`으로 되돌린다 */
  youtubeReviewStatus: YoutubeReviewStatus;
}

/** 미러링: apps/api/src/album-cover/dto/album-cover-candidate.ts `AlbumCoverCandidate` */
export interface AlbumCoverCandidate {
  trackName: string;
  artistName: string;
  collectionName: string;
  /** 이미 `600x600bb.jpg`로 정규화된 주소. 그대로 `PUT`의 `url`로 되돌려 보내면 된다 */
  artworkUrl: string;
}

/** 미러링: apps/api/src/teams/dto/team-response.ts `TeamResponse`. id는 DB가 int8이라 문자열이다 */
export interface Team {
  id: string;
  teamName: string;
  day: string | null;
  performanceOrder: number | null;
  /** work02-7c-2b(카드뉴스 사진 업로드)부터 화면에서 갱신한다. 이번 단계는 읽기만 한다 */
  cardImageUrl: string | null;
}

// ── 유튜브 연결 관리 (work02-7c-4, PRD F011~F013) ──────────────────────────

/** 미러링: apps/api/src/youtube/youtube-quota.service.ts `QuotaStatus` */
export interface YoutubeQuotaStatus {
  usedToday: number;
  limit: number;
  remaining: number;
  /** 다음 리셋 시각(태평양 시간 자정), ISO 8601 */
  resetsAt: string;
  timeZone: string;
}

/** 미러링: apps/api/src/youtube/youtube-batch.service.ts `BatchAbortReason` */
export type YoutubeBatchAbortReason = "quota" | "api_key" | "consecutive_errors" | null;

/** 미러링: apps/api/src/youtube/youtube-batch.service.ts `BatchSummary` */
export interface YoutubeBatchSummary {
  processed: number;
  searched: number;
  noResults: number;
  failed: number;
  abortedBy: YoutubeBatchAbortReason;
  remainingTargets: number;
  quota: YoutubeQuotaStatus;
}

/** 미러링: apps/api/src/generated/prisma/enums.ts `YoutubeSearchOutcome` */
export type YoutubeSearchOutcome = "reserved" | "searched" | "no_results" | "failed";

/** 미러링: apps/api/src/generated/prisma/enums.ts `YoutubeReviewState` */
export type YoutubeReviewState = "open" | "approved" | "rejected" | "superseded" | "expired" | "closed";

/** 목록 조회 필터. 미러링: apps/api/src/youtube/dto/review-recommendation.dto.ts `RECOMMENDATION_LIST_STATES` */
export const RECOMMENDATION_LIST_STATES = [
  "open",
  "approved",
  "rejected",
  "superseded",
  "expired",
  "closed",
] as const;

export type RecommendationListState = (typeof RECOMMENDATION_LIST_STATES)[number];

/** 미러링: apps/api/src/youtube/dto/recommendation-response.ts `RecommendationCandidateResponse` */
export interface YoutubeRecommendationCandidate {
  /** YouTube가 준 원본 순서(1부터). 점수 순위가 아니다 */
  rank: number;
  /** 참고값. 정렬에 쓰이지 않으므로 화면에도 표시하지 않는다 */
  score: number;
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
}

/** 미러링: apps/api/src/youtube/dto/recommendation-response.ts `RecommendationResponse` */
export interface YoutubeRecommendation {
  attemptId: string;
  songId: string;
  songTitle: string;
  songSinger: string | null;
  /** 실제로 유튜브에 보낸 검색어 */
  query: string;
  searchedAt: string;
  outcome: YoutubeSearchOutcome;
  reviewState: YoutubeReviewState;
  candidateCount: number;
  /** 승인한 후보의 등수. 후보 행은 승인 시 삭제되므로 이 값만 남는다 */
  approvedRank: number | null;
  rejectedReason: string | null;
  reviewedAt: string | null;
  /**
   * 빈 배열인 경우 (a) 리뷰가 끝나 후보를 지웠거나 (b) 30일이 지나 조회에서 제외된 것이다.
   * `reviewState`로 구분한다: (a)는 approved/rejected/superseded, (b)는 open인데도 비어 있다
   */
  candidates: YoutubeRecommendationCandidate[];
}

/** 미러링: apps/api/src/youtube/dto/recommendation-response.ts `RecommendationListResponse` */
export interface YoutubeRecommendationListResponse {
  items: YoutubeRecommendation[];
  /** 다음 페이지 커서. 더 없으면 null */
  nextCursor: string | null;
}
