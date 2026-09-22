// 유튜브 연결 관리 API (PRD F011~F013).
// 미러링: apps/api/src/youtube/{youtube-recommendations,youtube-url}.controller.ts
//
// 전부 로그인 상태에서만 호출된다(서버가 `@Public()`을 붙이지 않았다 — apiRequest의 기본값 auth:true 그대로 쓴다).
// 배치 실행은 되돌릴 수 없는 실제 YouTube API 호출이라, 화면은 확인 다이얼로그 없이 이 함수를 부르지 않는다.

import { apiRequest, type ApiRequestOptions } from "./client";
import { YOUTUBE_BATCH_TIMEOUT_MS, YOUTUBE_LIST_PAGE_SIZE } from "@/lib/youtube/youtube.constants";
import type {
  RecommendationListState,
  Song,
  YoutubeBatchSummary,
  YoutubeQuotaStatus,
  YoutubeRecommendationListResponse,
} from "./types";

/** GET /youtube/quota. 배치 버튼을 누르기 전에 "오늘 몇 곡이나 더 되는지"를 보여 주는 데 쓴다 */
export function getYoutubeQuota(options: Pick<ApiRequestOptions, "signal"> = {}): Promise<YoutubeQuotaStatus> {
  return apiRequest<YoutubeQuotaStatus>("/youtube/quota", options);
}

/**
 * POST /youtube/recommendations/batch (PRD F011).
 *
 * ⚠️ **실제 YouTube Data API 쿼터를 소모하는 되돌릴 수 없는 호출.** 대상 곡은 서버가
 * 자동으로 고르며(곡 지정 파라미터 없음), 미시도 곡이 항상 먼저 처리된다.
 * 곡당 최악 5초 × 최대 10곡 = 최악 50초라 기본 타임아웃(15초)보다 길게 잡는다.
 */
export function runYoutubeBatch(
  limit: number,
  options: Pick<ApiRequestOptions, "signal"> = {},
): Promise<YoutubeBatchSummary> {
  return apiRequest<YoutubeBatchSummary>("/youtube/recommendations/batch", {
    method: "POST",
    body: { limit },
    timeoutMs: YOUTUBE_BATCH_TIMEOUT_MS,
    ...options,
  });
}

export interface ListYoutubeRecommendationsInput {
  state: RecommendationListState;
  /** 이전 페이지의 nextCursor */
  cursor?: string;
}

/**
 * GET /youtube/recommendations (PRD F012). 페이지 크기는 서버 상한(50)으로 고정한다
 * (`YOUTUBE_LIST_PAGE_SIZE`) — 59곡을 "더 보기" 한 번으로 대부분 훑을 수 있게.
 */
export function listYoutubeRecommendations(
  input: ListYoutubeRecommendationsInput,
  options: Pick<ApiRequestOptions, "signal"> = {},
): Promise<YoutubeRecommendationListResponse> {
  const params = new URLSearchParams({ state: input.state, limit: String(YOUTUBE_LIST_PAGE_SIZE) });
  if (input.cursor) params.set("cursor", input.cursor);

  return apiRequest<YoutubeRecommendationListResponse>(`/youtube/recommendations?${params.toString()}`, options);
}

/**
 * POST /youtube/recommendations/:attemptId/approve. **등수가 아니라 영상 ID로 지목한다**
 * (목록을 새로 고치는 사이 등수가 가리키는 대상이 달라질 수 있어서 — 서버 DTO 주석 참조).
 */
export function approveRecommendation(
  attemptId: string,
  videoId: string,
  options: Pick<ApiRequestOptions, "signal"> = {},
): Promise<Song> {
  return apiRequest<Song>(`/youtube/recommendations/${encodeURIComponent(attemptId)}/approve`, {
    method: "POST",
    body: { videoId },
    ...options,
  });
}

/** POST /youtube/recommendations/:attemptId/reject. 사유는 선택 입력(최대 200자) */
export function rejectRecommendation(
  attemptId: string,
  reason: string | undefined,
  options: Pick<ApiRequestOptions, "signal"> = {},
): Promise<Song> {
  return apiRequest<Song>(`/youtube/recommendations/${encodeURIComponent(attemptId)}/reject`, {
    method: "POST",
    body: reason ? { reason } : {},
    ...options,
  });
}

/**
 * POST /youtube/songs/:songId/requeue. 반려됐거나 결과가 0건이었던 곡을 다시 배치 대상으로 되돌린다.
 * 쿼터를 쓰지 않는다(다음 배치 실행 때 검색된다) — DB만 바꾸는 가벼운 호출.
 */
export function requeueYoutubeSong(
  songId: string,
  options: Pick<ApiRequestOptions, "signal"> = {},
): Promise<Song> {
  return apiRequest<Song>(`/youtube/songs/${encodeURIComponent(songId)}/requeue`, { method: "POST", ...options });
}

/**
 * PUT /songs/:id/youtube-url (PRD F013). 사람이 직접 입력한 URL은 서버가 항상 `approved`로
 * 확정한다 — 검토 상태를 본문으로 보낼 수 없다(DTO에 없는 필드는 400).
 */
export function updateYoutubeUrl(
  songId: string,
  url: string,
  options: Pick<ApiRequestOptions, "signal"> = {},
): Promise<Song> {
  return apiRequest<Song>(`/songs/${encodeURIComponent(songId)}/youtube-url`, { method: "PUT", body: { url }, ...options });
}
