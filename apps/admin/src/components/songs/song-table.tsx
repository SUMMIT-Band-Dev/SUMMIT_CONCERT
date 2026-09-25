"use client";

import { useQuery } from "@tanstack/react-query";
import { ImageOff } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/layout/page-states";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusTone } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listTeamSongs } from "@/lib/api/songs";
import type { Song, Team, YoutubeReviewStatus } from "@/lib/api/types";
import { queryKeys } from "@/lib/query-keys";
import { shrinkAlbumCoverUrl } from "@/lib/songs/album-cover-url";

interface SongTableProps {
  team: Team;
  onCreate: () => void;
  onEdit: (song: Song) => void;
  onSetCover: (song: Song) => void;
}

/** 유튜브 검토 상태 표시. 색만으로 뜻을 전하지 않도록 글자를 함께 쓴다(badge.tsx 방침) */
const REVIEW_STATUS: Record<YoutubeReviewStatus, { label: string; tone: StatusTone }> = {
  pending: { label: "검토 대기", tone: "warning" },
  approved: { label: "승인됨", tone: "success" },
  rejected: { label: "반려됨", tone: "danger" },
};

/**
 * 선택한 팀의 곡 표 (PRD F008).
 *
 * 순서 열이 없다 — `Setlist`에 순서 컬럼이 없어 서버가 `id` 오름차순으로 고정해 내려주고
 * 공개 사이트도 같은 순서로 읽는다. 관리자가 바꿀 수 있는 순서가 아니라서 표시하지 않는다.
 */
export function SongTable({ team, onCreate, onEdit, onSetCover }: SongTableProps) {
  const query = useQuery({
    queryKey: queryKeys.teamSongs(team.id),
    queryFn: ({ signal }) => listTeamSongs(team.id, { signal }),
  });

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-section font-medium">{team.teamName}</h2>
        <Button type="button" size="sm" onClick={onCreate}>
          곡 등록
        </Button>
      </div>

      {query.isPending ? <LoadingState /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}

      {query.isSuccess ? (
        query.data.length === 0 ? (
          <EmptyState title="등록된 곡이 없습니다" description="'곡 등록' 버튼으로 이 팀의 첫 곡을 추가해 주세요." bare />
        ) : (
          <Table totalCount={query.data.length}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">커버</TableHead>
                <TableHead>곡 제목</TableHead>
                <TableHead>가수</TableHead>
                <TableHead className="w-24 text-center">유튜브</TableHead>
                <TableHead className="w-40 text-center">동작</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.map((song) => {
                const status = REVIEW_STATUS[song.youtubeReviewStatus];
                return (
                  <TableRow key={song.id}>
                    <TableCell>
                      <div className="mx-auto flex size-8 items-center justify-center overflow-hidden rounded-md border bg-muted">
                        {song.albumCoverUrl ? (
                          <img
                            src={shrinkAlbumCoverUrl(song.albumCoverUrl)}
                            alt={`${song.title} 앨범 커버`}
                            className="size-full object-cover"
                          />
                        ) : (
                          <ImageOff aria-hidden="true" className="size-4 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{song.title}</TableCell>
                    <TableCell className="text-muted-foreground">{song.singer ?? "—"}</TableCell>
                    <TableCell className="text-center">
                      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button type="button" variant="subtle" size="sm" onClick={() => onEdit(song)}>
                          수정
                        </Button>
                        <Button type="button" variant="subtle" size="sm" onClick={() => onSetCover(song)}>
                          커버
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )
      ) : null}
    </div>
  );
}
