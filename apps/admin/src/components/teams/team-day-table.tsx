"use client";

import { useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reorderTeams } from "@/lib/api/teams";
import type { Team } from "@/lib/api/types";
import type { ApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/query-keys";
import { formatDayLabel, UNASSIGNED_DAY_KEY } from "@/lib/teams/group-by-day";
import { cn } from "@/lib/utils";

interface TeamDayTableProps {
  day: string;
  teams: Team[];
  onEdit: (team: Team) => void;
}

/**
 * 하루치 팀 표. 드래그로 순서를 바꾸면 PATCH /teams/reorder가 끝나 응답을 받은 뒤에만 화면을 바꾼다
 * (query-client.ts의 방침: "서버가 권위인 변경은 서버 응답을 받은 뒤 화면을 바꾼다" — 재정렬이 그 예시로 명시돼 있다).
 * 드래그 도중에는 로딩만 표시하고, 실패하면 오류를 보여 준 뒤 원래 순서 그대로 둔다(별도 롤백 로직 불필요).
 */
export function TeamDayTable({ day, teams, onEdit }: TeamDayTableProps) {
  const queryClient = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [pendingOrderIds, setPendingOrderIds] = useState<string[] | null>(null);
  // day가 없는 팀(API 계약상 nullable)은 재정렬 엔드포인트가 요구하는 day 값이 없어 드래그를 막는다
  const sortable = day !== UNASSIGNED_DAY_KEY;

  const mutation = useMutation<Team[], ApiError, string[]>({
    mutationFn: (teamIds) => reorderTeams({ day, teamIds }),
    onSuccess: (reordered) => {
      queryClient.setQueryData<Team[]>(queryKeys.teams, (current) => {
        if (!current) return current;
        const others = current.filter((team) => team.day !== day);
        return [...others, ...reordered];
      });
    },
    onSettled: () => setPendingOrderIds(null),
  });

  const orderedIds = teams.map((team) => team.id);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const fromIndex = orderedIds.indexOf(String(active.id));
    const toIndex = orderedIds.indexOf(String(over.id));
    if (fromIndex === -1 || toIndex === -1) return;

    const nextIds = [...orderedIds];
    nextIds.splice(fromIndex, 1);
    nextIds.splice(toIndex, 0, String(active.id));

    setPendingOrderIds(nextIds);
    mutation.mutate(nextIds);
  }

  // 요청 중에는 낙관적으로 줄을 옮기지 않고, 드래그 중이던 임시 순서를 "적용 시도 중" 배지로만 보여 준다
  const displayTeams = pendingOrderIds
    ? pendingOrderIds.map((id) => teams.find((team) => team.id === id)).filter((team): team is Team => team !== undefined)
    : teams;

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-section font-medium">{formatDayLabel(day)}</h2>
        {mutation.isPending ? <span className="text-small text-muted-foreground">순서 적용 중…</span> : null}
      </div>

      {mutation.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {mutation.error.messages.join(" ")}
        </p>
      ) : null}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <Table totalCount={teams.length}>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" aria-hidden="true" />
              <TableHead className="w-14 text-center">순서</TableHead>
              <TableHead>팀명</TableHead>
              <TableHead className="w-24 text-center">동작</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
              {displayTeams.map((team, index) => (
                <SortableTeamRow
                  key={team.id}
                  team={team}
                  order={index + 1}
                  disabled={!sortable || mutation.isPending}
                  onEdit={onEdit}
                />
              ))}
            </SortableContext>
          </TableBody>
        </Table>
      </DndContext>
    </div>
  );
}

interface SortableTeamRowProps {
  team: Team;
  order: number;
  disabled: boolean;
  onEdit: (team: Team) => void;
}

function SortableTeamRow({ team, order, disabled, onEdit }: SortableTeamRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: team.id, disabled });

  return (
    <TableRow
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "relative z-10 bg-accent")}
    >
      <TableCell>
        <button
          type="button"
          aria-label={`${team.teamName} 순서 옮기기`}
          disabled={disabled}
          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden="true" className="size-4" />
        </button>
      </TableCell>
      <TableCell className="text-center tabular">{order}</TableCell>
      <TableCell className="font-medium">{team.teamName}</TableCell>
      <TableCell className="text-center">
        <Button type="button" variant="subtle" size="sm" onClick={() => onEdit(team)}>
          수정
        </Button>
      </TableCell>
    </TableRow>
  );
}
