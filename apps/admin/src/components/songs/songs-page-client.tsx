"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/layout/page-states";
import { SplitPanel } from "@/components/layout/split-panel";
import { listTeams } from "@/lib/api/teams";
import type { Song, Team } from "@/lib/api/types";
import { queryKeys } from "@/lib/query-keys";
import { formatDayLabel, groupTeamsByDay } from "@/lib/teams/group-by-day";
import { cn } from "@/lib/utils";
import { AlbumCoverDialog } from "./album-cover-dialog";
import { SongFormDialog } from "./song-form-dialog";
import { SongTable } from "./song-table";

/**
 * 곡 관리 화면 (PRD F008~F010). 7c-1에서 만들어 둔 `SplitPanel`을 처음으로 쓰는 화면이다 —
 * PRD가 정한 흐름이 "팀 선택 → 해당 팀 곡 패널"이라 좌(팀 목록)/우(곡 표) 구조가 그대로 맞는다.
 */
export function SongsPageClient() {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [coverSong, setCoverSong] = useState<Song | null>(null);

  const teamsQuery = useQuery({
    queryKey: queryKeys.teams,
    queryFn: ({ signal }) => listTeams({ signal }),
  });

  const teams = teamsQuery.data ?? [];
  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? null;

  return (
    <>
      <PageHeader title="곡 관리" description="팀을 선택해 해당 팀의 곡을 등록·수정하고 앨범 커버를 설정합니다." />

      {teamsQuery.isPending ? <LoadingState /> : null}
      {teamsQuery.isError ? <ErrorState error={teamsQuery.error} onRetry={() => teamsQuery.refetch()} /> : null}

      {teamsQuery.isSuccess ? (
        teams.length === 0 ? (
          <EmptyState title="등록된 팀이 없습니다" description="곡을 등록하려면 먼저 팀 관리에서 팀을 추가해 주세요." />
        ) : (
          <SplitPanel
            listLabel="팀 목록"
            detailLabel="선택한 팀의 곡"
            list={
              <nav className="grid gap-4">
                {groupTeamsByDay(teams).map((group) => (
                  <div key={group.day} className="grid gap-1">
                    <p className="px-1 text-caption font-medium text-muted-foreground">{formatDayLabel(group.day)}</p>
                    <ul className="grid gap-0.5">
                      {group.teams.map((team) => (
                        <li key={team.id}>
                          <TeamSelectButton
                            team={team}
                            selected={team.id === selectedTeamId}
                            onSelect={() => setSelectedTeamId(team.id)}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </nav>
            }
            detail={
              selectedTeam ? (
                <SongTable
                  // 팀을 바꾸면 표를 새로 마운트해 이전 팀의 상태가 남지 않게 한다
                  key={selectedTeam.id}
                  team={selectedTeam}
                  onCreate={() => setCreateOpen(true)}
                  onEdit={setEditingSong}
                  onSetCover={setCoverSong}
                />
              ) : (
                <EmptyState title="팀을 선택해 주세요" description="왼쪽 목록에서 팀을 고르면 그 팀의 곡이 표시됩니다." bare />
              )
            }
          />
        )
      ) : null}

      {selectedTeam ? (
        <>
          <SongFormDialog open={createOpen} onOpenChange={setCreateOpen} teamId={selectedTeam.id} />
          <SongFormDialog
            open={editingSong !== null}
            onOpenChange={(open) => !open && setEditingSong(null)}
            teamId={selectedTeam.id}
            song={editingSong ?? undefined}
          />
          <AlbumCoverDialog song={coverSong} teamId={selectedTeam.id} onOpenChange={(open) => !open && setCoverSong(null)} />
        </>
      ) : null}
    </>
  );
}

function TeamSelectButton({ team, selected, onSelect }: { team: Team; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      onClick={onSelect}
      className={cn(
        "flex h-(--nav-item-height) w-full items-center gap-2 rounded-md px-3 text-body transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
        selected ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <span className="truncate">{team.teamName}</span>
    </button>
  );
}
