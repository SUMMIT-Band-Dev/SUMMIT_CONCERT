"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/layout/page-states";
import { Button } from "@/components/ui/button";
import { listTeams } from "@/lib/api/teams";
import type { Team } from "@/lib/api/types";
import { queryKeys } from "@/lib/query-keys";
import { groupTeamsByDay } from "@/lib/teams/group-by-day";
import { TeamCreateDialog } from "./team-create-dialog";
import { TeamDayTable } from "./team-day-table";
import { TeamEditDialog } from "./team-edit-dialog";

/** 팀 관리 화면의 실제 내용. 자리표시 화면을 대체한다(work02-7c-2a) */
export function TeamsPageClient() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  const query = useQuery({
    queryKey: queryKeys.teams,
    queryFn: ({ signal }) => listTeams({ signal }),
  });

  return (
    <>
      <PageHeader
        title="팀 관리"
        description="공연 팀을 등록하고 순서를 바꾸며 카드뉴스 이미지를 올립니다."
        actions={<Button onClick={() => setCreateOpen(true)}>팀 등록</Button>}
      />

      {query.isPending ? <LoadingState /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}

      {query.isSuccess ? (
        query.data.length === 0 ? (
          <EmptyState title="등록된 팀이 없습니다" description="위의 '팀 등록' 버튼으로 첫 팀을 추가해 주세요." />
        ) : (
          <div className="grid gap-8">
            {groupTeamsByDay(query.data).map((group) => (
              <TeamDayTable key={group.day} day={group.day} teams={group.teams} onEdit={setEditingTeam} />
            ))}
          </div>
        )
      ) : null}

      <TeamCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <TeamEditDialog team={editingTeam} onOpenChange={(open) => !open && setEditingTeam(null)} />
    </>
  );
}
