"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ErrorState, LoadingState } from "@/components/layout/page-states";
import { getYoutubeQuota, runYoutubeBatch } from "@/lib/api/youtube";
import type { ApiError } from "@/lib/api/errors";
import type { YoutubeBatchSummary } from "@/lib/api/types";
import { queryKeys } from "@/lib/query-keys";
import { YOUTUBE_BATCH_DEFAULT_LIMIT, YOUTUBE_BATCH_MAX_LIMIT } from "@/lib/youtube/youtube.constants";
import { cn } from "@/lib/utils";
import { BatchConfirmDialog } from "./batch-confirm-dialog";

const BATCH_ABORT_LABEL: Record<NonNullable<YoutubeBatchSummary["abortedBy"]>, string> = {
  quota: "오늘 쿼터를 다 써서 중단됐습니다.",
  api_key: "서버 설정 문제로 중단됐습니다.",
  consecutive_errors: "연속 실패로 중단됐습니다.",
};

/**
 * 쿼터 현황 + 배치 실행 바 (PRD F011). 배치 실행은 실제 YouTube API 쿼터를 소모하는
 * 되돌릴 수 없는 호출이라, 확인 다이얼로그를 항상 거친다(batch-confirm-dialog.tsx).
 */
export function BatchBar() {
  const queryClient = useQueryClient();
  const [limit, setLimit] = useState(YOUTUBE_BATCH_DEFAULT_LIMIT);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastSummary, setLastSummary] = useState<YoutubeBatchSummary | null>(null);

  const quotaQuery = useQuery({
    queryKey: queryKeys.youtubeQuota,
    queryFn: ({ signal }) => getYoutubeQuota({ signal }),
  });

  const batch = useMutation<YoutubeBatchSummary, ApiError, void>({
    mutationFn: () => runYoutubeBatch(limit),
    onSuccess: (summary) => {
      setLastSummary(summary);
      setConfirmOpen(false);
      queryClient.setQueryData(queryKeys.youtubeQuota, summary.quota);
      // 새로 열린(open) 추천이 생겼을 수 있으니 그 목록만 무효화한다(다른 상태는 배치가 못 바꾼다)
      void queryClient.invalidateQueries({ queryKey: queryKeys.youtubeRecommendations("open") });
    },
  });

  const quota = quotaQuery.data;
  const canRunSelectedLimit = quota !== undefined && quota.remaining >= limit;
  const remainingIsZero = quota !== undefined && quota.remaining <= 0;

  return (
    <div className="grid gap-3 rounded-lg border bg-card p-3">
      {quotaQuery.isPending ? <LoadingState label="쿼터 정보를 불러오는 중입니다…" /> : null}
      {quotaQuery.isError ? <ErrorState error={quotaQuery.error} onRetry={() => quotaQuery.refetch()} /> : null}

      {quota ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-body">
            오늘 <span className="font-medium tabular">{quota.usedToday}</span>/{quota.limit} 사용 · 남은{" "}
            <span className="font-medium tabular">{quota.remaining}</span>회 ·{" "}
            <span className="text-muted-foreground">
              {new Date(quota.resetsAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })} 초기화
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="youtube-batch-limit" className="text-caption text-muted-foreground">
              곡 수
            </Label>
            <select
              id="youtube-batch-limit"
              value={limit}
              disabled={remainingIsZero || batch.isPending}
              onChange={(event) => setLimit(Number(event.target.value))}
              className={cn(
                "h-(--control-height) rounded-lg border border-input bg-transparent px-2 text-base outline-none",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 md:text-sm",
              )}
            >
              {Array.from({ length: YOUTUBE_BATCH_MAX_LIMIT }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <Button type="button" size="sm" disabled={remainingIsZero || batch.isPending} onClick={() => setConfirmOpen(true)}>
              배치 실행
            </Button>
          </div>
        </div>
      ) : null}

      {remainingIsZero ? (
        <p className="text-caption text-muted-foreground">오늘 사용할 수 있는 검색 횟수를 모두 썼습니다.</p>
      ) : quota && !canRunSelectedLimit ? (
        <p className="text-caption text-muted-foreground">
          선택한 곡 수({limit})가 남은 검색 횟수({quota.remaining})보다 많습니다. 곡 수를 줄이면 그만큼만 실행됩니다.
        </p>
      ) : null}

      {batch.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {batch.error.messages.map((message, index) => (
              <span key={index} className="block">
                {message}
              </span>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}

      {lastSummary ? (
        <Alert>
          <AlertDescription>
            처리 {lastSummary.processed}곡 (성공 {lastSummary.searched} / 결과없음 {lastSummary.noResults} / 실패{" "}
            {lastSummary.failed})
            {lastSummary.abortedBy ? ` — ${BATCH_ABORT_LABEL[lastSummary.abortedBy]}` : null}
            {" · "}
            남은 대상 {lastSummary.remainingTargets}곡
          </AlertDescription>
        </Alert>
      ) : null}

      {quota ? (
        <BatchConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          limit={limit}
          remaining={quota.remaining}
          pending={batch.isPending}
          onConfirm={() => batch.mutate()}
        />
      ) : null}
    </div>
  );
}
