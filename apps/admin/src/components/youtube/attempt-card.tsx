"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import type { Song, YoutubeRecommendation } from "@/lib/api/types";
import type { ApiError } from "@/lib/api/errors";
import { approveRecommendation } from "@/lib/api/youtube";
import { OUTCOME_LABEL, REVIEW_STATE_LABEL, REVIEW_STATE_TONE, isRequeueEligible } from "@/lib/youtube/review-state";
import { CandidateCard } from "./candidate-card";
import { RequeueButton } from "./requeue-button";

interface AttemptCardProps {
  attempt: YoutubeRecommendation;
  onReject: (attempt: { attemptId: string; songTitle: string }) => void;
  onManualUrl: (song: { songId: string; songTitle: string }) => void;
}

/**
 * 시도 하나를 보여 주는 카드 (PRD F012). 표가 아니라 카드인 이유는 한 곡에 후보 최대 3개
 * (썸네일+제목+채널)가 붙어야 해서다 — `<Table>`로는 이 정보량이 한 행에 들어가지 않는다.
 *
 * 배지·후보 표시 여부는 목록이 필터링한 탭이 아니라 **`attempt.reviewState` 자체**를 기준으로
 * 삼는다 — 지금은 목록이 상태별로 걸러져 있어 결과가 같지만, 의미상 진짜 근거는 서버가 준
 * 이 시도의 실제 상태다.
 */
export function AttemptCard({ attempt, onReject, onManualUrl }: AttemptCardProps) {
  const queryClient = useQueryClient();
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(
    attempt.candidates[0]?.videoId ?? null,
  );

  const approve = useMutation<Song, ApiError, string>({
    mutationFn: (videoId) => approveRecommendation(attempt.attemptId, videoId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["youtube", "recommendations"] });
    },
  });

  // 30일 경과로 서버가 응답에서 후보를 뺀 경우(reviewState는 open인데 candidates가 비어 있음).
  // (a) 리뷰가 끝나 삭제된 경우와 구분: 리뷰가 끝난 상태(approved/rejected/superseded/expired)는
  // candidateCount가 있어도 정상이라 이 경고를 띄우지 않는다.
  const expiredWithoutReview =
    attempt.reviewState === "open" && attempt.candidateCount > 0 && attempt.candidates.length === 0;

  const searchedAt = new Date(attempt.searchedAt).toLocaleString("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <div className="grid gap-3 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">
            {attempt.songTitle}
            {attempt.songSinger ? <span className="text-muted-foreground"> — {attempt.songSinger}</span> : null}
          </p>
          <p className="truncate text-caption text-muted-foreground">
            검색어: &quot;{attempt.query}&quot; · {searchedAt} 검색
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <StatusBadge tone={REVIEW_STATE_TONE[attempt.reviewState]}>{REVIEW_STATE_LABEL[attempt.reviewState]}</StatusBadge>
          {attempt.reviewState === "closed" ? (
            <StatusBadge tone="neutral">{OUTCOME_LABEL[attempt.outcome]}</StatusBadge>
          ) : null}
        </div>
      </div>

      {attempt.reviewedAt ? (
        <p className="text-caption text-muted-foreground">
          {attempt.reviewState === "approved" ? `${attempt.approvedRank}위 후보 승인됨` : null}
          {attempt.reviewState === "rejected" && attempt.rejectedReason ? `반려 사유: ${attempt.rejectedReason}` : null}
          {attempt.reviewState === "rejected" && !attempt.rejectedReason ? "반려됨(사유 없음)" : null}
        </p>
      ) : null}

      {approve.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {approve.error.messages.map((message, index) => (
              <span key={index} className="block">
                {message}
              </span>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}

      {attempt.reviewState === "open" ? (
        expiredWithoutReview ? (
          <p className="text-body text-muted-foreground">
            보관 기간(30일)이 지나 후보를 표시할 수 없습니다. &quot;재검색 대기로&quot; 버튼으로 다시
            검색하거나 &quot;직접 입력&quot;으로 주소를 넣어 주세요.
          </p>
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {attempt.candidates.map((candidate) => (
                <li key={candidate.videoId}>
                  <CandidateCard
                    candidate={candidate}
                    selected={candidate.videoId === selectedVideoId}
                    onSelect={() => setSelectedVideoId(candidate.videoId)}
                  />
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={!selectedVideoId || approve.isPending}
                onClick={() => selectedVideoId && approve.mutate(selectedVideoId)}
              >
                {approve.isPending ? "확정하는 중…" : "이 영상으로 확정"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onReject({ attemptId: attempt.attemptId, songTitle: attempt.songTitle })}
              >
                반려
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onManualUrl({ songId: attempt.songId, songTitle: attempt.songTitle })}
              >
                직접 입력
              </Button>
            </div>
          </>
        )
      ) : null}

      {attempt.reviewState !== "open" && isRequeueEligible(attempt.reviewState, attempt.outcome) ? (
        <div>
          <RequeueButton songId={attempt.songId} songTitle={attempt.songTitle} />
        </div>
      ) : null}
    </div>
  );
}
