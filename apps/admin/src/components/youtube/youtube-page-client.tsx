"use client";

import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/layout/page-states";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listTeamSongs } from "@/lib/api/songs";
import { listTeams } from "@/lib/api/teams";
import type { Song, Team } from "@/lib/api/types";
import { queryKeys } from "@/lib/query-keys";
import { checkYoutubeUrl } from "@/lib/youtube/youtube-url";
import { ManualUrlDialog } from "./manual-url-dialog";

/** 팀별 기존 곡 조회를 재사용한다. URL 저장 후 곡 관리 화면과 같은 캐시를 갱신한다. */
export function YoutubePageClient() {
  const [teamId, setTeamId] = useState("");
  const [onlyUnlinked, setOnlyUnlinked] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const filterId = useId();
  const teams = useQuery({ queryKey: queryKeys.teams, queryFn: ({ signal }) => listTeams({ signal }) });
  const visibleTeams = teams.data?.filter((team) => !teamId || team.id === teamId) ?? [];

  return (
    <>
      <PageHeader title="유튜브 연결 관리" description="팀별 영상 연결 현황을 확인하고 유튜브 주소를 등록·수정합니다." />
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor={filterId}>팀 선택</Label>
            <select
              id={filterId}
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
              className="h-(--control-height) max-w-full rounded-md border bg-background px-3 text-body"
            >
              <option value="">전체 팀</option>
              {teams.data?.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.teamName}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-body">
            <input type="checkbox" checked={onlyUnlinked} onChange={(event) => setOnlyUnlinked(event.target.checked)} />
            미연결 곡만 보기
          </label>
        </div>
        {teams.isPending ? <LoadingState /> : null}
        {teams.isError ? <ErrorState error={teams.error} onRetry={() => teams.refetch()} /> : null}
        {teams.isSuccess && visibleTeams.length === 0 ? <EmptyState title="등록된 팀이 없습니다" /> : null}
        {visibleTeams.map((team) => (
          <TeamYoutubeSongs key={team.id} team={team} onlyUnlinked={onlyUnlinked} onEdit={setEditingSong} />
        ))}
      </div>
      {editingSong ? (
        <ManualUrlDialog key={editingSong.id} song={editingSong} onOpenChange={(open) => !open && setEditingSong(null)} />
      ) : null}
    </>
  );
}

function TeamYoutubeSongs({ team, onlyUnlinked, onEdit }: { team: Team; onlyUnlinked: boolean; onEdit: (song: Song) => void }) {
  const query = useQuery({ queryKey: queryKeys.teamSongs(team.id), queryFn: ({ signal }) => listTeamSongs(team.id, { signal }) });
  const songs = query.data?.filter((song) => !onlyUnlinked || !song.youtubeUrl) ?? [];
  return (
    <section className="grid gap-3 rounded-lg border bg-card p-4">
      <h2 className="text-section font-medium">{team.teamName}</h2>
      {query.isPending ? <LoadingState /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.isSuccess ? (
        songs.length === 0 ? (
          <EmptyState title={onlyUnlinked ? "미연결 곡이 없습니다" : "등록된 곡이 없습니다"} bare />
        ) : (
          <Table totalCount={songs.length}>
            <TableHeader>
              <TableRow>
                <TableHead>곡 제목</TableHead>
                <TableHead>가수</TableHead>
                <TableHead>현재 영상 주소</TableHead>
                <TableHead className="w-24">동작</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {songs.map((song) => (
                <TableRow key={song.id}>
                  <TableCell className="font-medium">{song.title}</TableCell>
                  <TableCell>{song.singer ?? "—"}</TableCell>
                  <TableCell className="max-w-80 whitespace-normal break-all">
                    {song.youtubeUrl ? (
                      checkYoutubeUrl(song.youtubeUrl) === null ? (
                        <a
                          href={song.youtubeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline underline-offset-4"
                          aria-label={`${song.title} 영상 새 탭에서 열기`}
                        >
                          {song.youtubeUrl}
                        </a>
                      ) : (
                        <span>{song.youtubeUrl}</span>
                      )
                    ) : (
                      <span className="text-muted-foreground">미연결</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button type="button" variant="subtle" size="sm" onClick={() => onEdit(song)}>
                      수정하기
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )
      ) : null}
    </section>
  );
}
