import type { RecommendationListState, YoutubeSearchOutcome } from "@/lib/api/types";
import type { StatusTone } from "@/components/ui/badge";

// 유튜브 추천 상태 표시. 아이콘/분기 렌더링은 switch가 아니라 객체 매핑을 쓴다(code-style.md).

interface StateTab {
  value: RecommendationListState;
  label: string;
}

/** 주 탭 3개. 관리자의 일상 동선은 리뷰 대기 하나이고 나머지는 사후 확인용이라 위계를 둔다 */
export const REVIEW_STATE_TABS: readonly StateTab[] = [
  { value: "open", label: "리뷰 대기" },
  { value: "approved", label: "승인됨" },
  { value: "rejected", label: "반려됨" },
];

/**
 * "그 외" 드롭다운. `closed`는 서버 DB 기본값이라 "닫힌 리뷰"가 아니라
 * **"리뷰할 것이 없었던 시도"**(검색 결과 0건·검색 실패·예약 잔재)를 뜻한다.
 */
export const REVIEW_STATE_OTHER: readonly StateTab[] = [
  { value: "superseded", label: "무효화됨" },
  { value: "expired", label: "보관기간 만료" },
  { value: "closed", label: "결과 없음 · 오류" },
];

export const REVIEW_STATE_LABEL: Record<RecommendationListState, string> = Object.fromEntries(
  [...REVIEW_STATE_TABS, ...REVIEW_STATE_OTHER].map((tab) => [tab.value, tab.label]),
) as Record<RecommendationListState, string>;

export const REVIEW_STATE_TONE: Record<RecommendationListState, StatusTone> = {
  open: "warning",
  approved: "success",
  rejected: "danger",
  superseded: "neutral",
  expired: "neutral",
  closed: "neutral",
};

/** "그 외" 탭에서만 보이는 시도 결과. searched는 항상 open/approved/rejected/superseded/expired와 묶여 나온다 */
export const OUTCOME_LABEL: Record<YoutubeSearchOutcome, string> = {
  reserved: "검색 대기 중(잔재)",
  searched: "검색 완료",
  no_results: "검색 결과 없음",
  failed: "검색 실패",
};

/** 재큐(재검색) 가능 여부. 서버 자격 조건(youtube-review.service.ts `requeue`)과 정확히 같다 */
export function isRequeueEligible(reviewState: RecommendationListState, outcome: YoutubeSearchOutcome): boolean {
  return reviewState === "rejected" || (reviewState === "closed" && outcome === "no_results");
}
