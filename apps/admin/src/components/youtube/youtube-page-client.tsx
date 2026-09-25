"use client";

import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/layout/page-states";
import { Button } from "@/components/ui/button";
import { listYoutubeRecommendations } from "@/lib/api/youtube";
import type { RecommendationListState } from "@/lib/api/types";
import { queryKeys } from "@/lib/query-keys";
import { REVIEW_STATE_OTHER, REVIEW_STATE_TABS } from "@/lib/youtube/review-state";
import { cn } from "@/lib/utils";
import { AttemptCard } from "./attempt-card";
import { BatchBar } from "./batch-bar";
import { ManualUrlDialog } from "./manual-url-dialog";
import { RejectDialog } from "./reject-dialog";

/**
 * 유튜브 연결 관리 화면 (PRD F011~F013, work02-7c-4).
 *
 * `SplitPanel`(7c-1)을 쓰지 않는다 — 좌측에 놓을 "선택 대상" 목록이 없다(전역 곡 목록
 * 엔드포인트가 없어 곡 관리처럼 팀→곡 구조를 재사용할 수 없다). 대신 상태 탭 + 카드 목록
 * 구조로, 배치가 대상을 자동 선정하는 이 기능의 실제 동선(검색 → 훑어보기 → 하나씩 처리)에
 * 맞춘다.
 */
export function YoutubePageClient() {
  const [activeTab, setActiveTab] = useState<RecommendationListState>("open");
  const [otherOpen, setOtherOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<{ attemptId: string; songTitle: string } | null>(null);
  const [manualUrlTarget, setManualUrlTarget] = useState<{ songId: string; songTitle: string } | null>(null);

  const query = useInfiniteQuery({
    queryKey: queryKeys.youtubeRecommendations(activeTab),
    queryFn: ({ pageParam, signal }) =>
      listYoutubeRecommendations({ state: activeTab, cursor: pageParam }, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <PageHeader title="유튜브 연결 관리" description="영상 링크가 없는 곡의 추천 영상을 검토하고 확정합니다." />

      <div className="grid gap-4">
        <BatchBar />

        <div className="flex flex-wrap items-center gap-1.5">
          {REVIEW_STATE_TABS.map((tab) => (
            <TabButton key={tab.value} active={activeTab === tab.value} onClick={() => setActiveTab(tab.value)}>
              {tab.label}
            </TabButton>
          ))}

          <div className="relative">
            <TabButton
              active={REVIEW_STATE_OTHER.some((tab) => tab.value === activeTab)}
              onClick={() => setOtherOpen((prev) => !prev)}
              aria-expanded={otherOpen}
              aria-haspopup="menu"
            >
              그 외 ▾
            </TabButton>
            {otherOpen ? (
              <ul role="menu" className="absolute top-full left-0 z-10 mt-1 grid min-w-32 gap-0.5 rounded-lg border bg-popover p-1 shadow-md">
                {REVIEW_STATE_OTHER.map((tab) => (
                  <li key={tab.value} role="none">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setActiveTab(tab.value);
                        setOtherOpen(false);
                      }}
                      className={cn(
                        "block w-full rounded px-2 py-1.5 text-left text-body hover:bg-muted",
                        activeTab === tab.value && "bg-accent font-medium",
                      )}
                    >
                      {tab.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        {query.isPending ? <LoadingState /> : null}
        {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}

        {query.isSuccess ? (
          items.length === 0 ? (
            <EmptyState
              title="해당 상태의 추천이 없습니다"
              description={
                activeTab === "open"
                  ? "위 배치 실행 버튼으로 유튜브 검색을 실행하면 리뷰할 추천이 여기 나타납니다."
                  : undefined
              }
            />
          ) : (
            <div className="grid gap-3">
              {items.map((attempt) => (
                <AttemptCard
                  key={attempt.attemptId}
                  attempt={attempt}
                  onReject={setRejectTarget}
                  onManualUrl={setManualUrlTarget}
                />
              ))}
            </div>
          )
        ) : null}

        {query.hasNextPage ? (
          <div>
            <Button type="button" variant="outline" size="sm" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
              {query.isFetchingNextPage ? "불러오는 중…" : "더 보기"}
            </Button>
          </div>
        ) : null}
      </div>

      <RejectDialog attempt={rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)} />
      <ManualUrlDialog song={manualUrlTarget} onOpenChange={(open) => !open && setManualUrlTarget(null)} />
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
  ...props
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-(--control-height) rounded-lg px-3 text-body font-medium transition-colors",
        active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      {...props}
    >
      {children}
    </button>
  );
}
