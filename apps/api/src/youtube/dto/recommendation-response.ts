import type {
  YoutubeReviewState,
  YoutubeSearchOutcome,
} from '../../generated/prisma/enums.js';

/**
 * 추천 후보 하나. **전부 외부에서 온 문자열이다.**
 *
 * 길이 상한과 썸네일 호스트 allowlist는 저장 직전에 이미 통과했다
 * (`YoutubeBatchService.isStorable`). 여기서 다시 거르지 않는 이유는, 저장된 값을
 * 조회에서 또 검사하면 "저장은 됐는데 안 보이는" 행이 생겨 원인을 추적할 수 없기 때문이다.
 *
 * 이스케이프는 렌더링 계층(7단계 관리자 UI)의 몫이다. 서버가 임의로 바꾸면 관리자가
 * 실제 유튜브 제목과 다른 문자열을 보고 판단하게 된다.
 */
export interface RecommendationCandidateResponse {
  rank: number;
  score: number;
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
}

/**
 * 추천 시도 하나 (PRD F012 목록 조회).
 *
 * §11의 `TeamResponse`·§12의 `SongResponse`와 같은 매퍼 방식이다 — 이 타입 자체가 API 계약이고,
 * `BigInt`는 응답 경계에서 문자열로 바꾼다.
 *
 * `candidates`가 비어 있는 경우는 두 가지다: (a) 리뷰가 끝나 후보를 지웠다
 * (b) 30일이 지나 조회에서 제외했다. `reviewState`로 구분할 수 있다.
 */
export interface RecommendationResponse {
  attemptId: string;
  songId: string;
  songTitle: string;
  songSinger: string | null;
  /** 실제로 유튜브에 보낸 검색어. 왜 이런 결과가 나왔는지 관리자가 판단하는 근거다. */
  query: string;
  searchedAt: string;
  outcome: YoutubeSearchOutcome;
  reviewState: YoutubeReviewState;
  candidateCount: number;
  /** 승인한 후보의 등수. 후보 행은 지워지므로 "몇 위를 골랐나"만 남는다. */
  approvedRank: number | null;
  rejectedReason: string | null;
  reviewedAt: string | null;
  candidates: RecommendationCandidateResponse[];
}

/** 커서 페이징. offset은 배치가 행을 추가하면 페이지가 밀려서 쓰지 않는다. */
export interface RecommendationListResponse {
  items: RecommendationResponse[];
  /** 다음 페이지의 시작 커서. 더 없으면 null. */
  nextCursor: string | null;
}

interface AttemptRow {
  id: bigint;
  songId: bigint;
  query: string;
  searchedAt: Date;
  outcome: YoutubeSearchOutcome;
  reviewState: YoutubeReviewState;
  candidateCount: number;
  approvedRank: number | null;
  rejectedReason: string | null;
  reviewedAt: Date | null;
  song: { title: string; singer: string | null };
  recommendations: Array<{
    rank: number;
    score: number;
    videoId: string;
    title: string;
    channelTitle: string;
    thumbnailUrl: string;
  }>;
}

export function toRecommendationResponse(
  attempt: AttemptRow,
  options: { includeCandidates: boolean },
): RecommendationResponse {
  return {
    attemptId: attempt.id.toString(),
    songId: attempt.songId.toString(),
    songTitle: attempt.song.title,
    songSinger: attempt.song.singer,
    query: attempt.query,
    searchedAt: attempt.searchedAt.toISOString(),
    outcome: attempt.outcome,
    reviewState: attempt.reviewState,
    candidateCount: attempt.candidateCount,
    approvedRank: attempt.approvedRank,
    rejectedReason: attempt.rejectedReason,
    reviewedAt: attempt.reviewedAt?.toISOString() ?? null,
    candidates: options.includeCandidates
      ? attempt.recommendations.map((candidate) => ({ ...candidate }))
      : [],
  };
}
