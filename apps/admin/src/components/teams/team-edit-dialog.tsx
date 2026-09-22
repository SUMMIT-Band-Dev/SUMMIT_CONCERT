"use client";

import { useEffect, useId } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateTeam } from "@/lib/api/teams";
import type { Team } from "@/lib/api/types";
import { type ApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/query-keys";
import { DAY_MAX_LENGTH, TEAM_NAME_MAX_LENGTH, updateTeamSchema, type UpdateTeamFormValues } from "@/lib/teams/team-schema";
import { TeamCardImageField } from "./team-card-image-field";

interface TeamEditDialogProps {
  /** null이면 닫힘. 값이 있으면 그 팀을 수정 대상으로 연다 */
  team: Team | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * 팀 수정 대화상자. 팀명·공연일자만 고친다(서버 UpdateTeamDto와 동일 — 순서는 재정렬 전용).
 * 일자를 바꾸면 서버가 순서를 대상 일자의 맨 뒤로 재배치한다는 점을 안내한다.
 */
export function TeamEditDialog({ team, onOpenChange }: TeamEditDialogProps) {
  const queryClient = useQueryClient();
  const ids = { teamName: useId(), day: useId() };
  const open = team !== null;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateTeamFormValues>({
    resolver: zodResolver(updateTeamSchema),
    defaultValues: { teamName: team?.teamName ?? "", day: team?.day ?? "" },
  });

  const mutation = useMutation<Team, ApiError, UpdateTeamFormValues>({
    mutationFn: (values) => {
      if (!team) throw new Error("수정할 팀이 지정되지 않았습니다.");
      return updateTeam(team.id, values);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.teams });
      onOpenChange(false);
    },
  });

  // 대상 팀이 바뀌거나 열릴 때 그 팀의 현재 값으로 채운다
  useEffect(() => {
    if (team) {
      reset({ teamName: team.teamName, day: team.day ?? "" });
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset/mutation.reset은 매 렌더 새 참조라 team만 의존성으로 둔다
  }, [team]);

  const onSubmit = handleSubmit((values) => {
    if (mutation.isPending) return;
    mutation.mutate(values);
  });

  const dayChanged = team && team.day !== undefined && team.day !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 기본 너비(sm)로는 이미지 미리보기 + 파일 선택이 좁아 한 단계 넓힌다 */}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>팀 수정</DialogTitle>
          <DialogDescription>
            {dayChanged
              ? "공연일자를 바꾸면 해당 팀의 공연순서는 새 일자의 맨 뒤로 옮겨집니다."
              : "팀명과 공연일자를 수정합니다."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          {mutation.isError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>
                {mutation.error.messages.map((message, index) => (
                  <span key={index} className="block">
                    {message}
                  </span>
                ))}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-1.5">
            <Label htmlFor={ids.teamName}>팀명</Label>
            <Input
              id={ids.teamName}
              type="text"
              maxLength={TEAM_NAME_MAX_LENGTH + 1}
              aria-invalid={errors.teamName ? true : undefined}
              {...register("teamName")}
            />
            {errors.teamName ? <p className="text-sm text-destructive">{errors.teamName.message}</p> : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={ids.day}>공연일자</Label>
            <Input
              id={ids.day}
              type="text"
              placeholder="day1"
              maxLength={DAY_MAX_LENGTH + 1}
              aria-invalid={errors.day ? true : undefined}
              {...register("day")}
            />
            {errors.day ? <p className="text-sm text-destructive">{errors.day.message}</p> : null}
          </div>

          {/* 이미지 업로드는 위 텍스트 저장(PATCH)과 별개의 엔드포인트·별개의 동작이라 선으로 구분한다 */}
          {team ? (
            <div className="border-t pt-4">
              {/* key: 다른 팀을 열면 새로 마운트되어 이전 팀의 선택·미리보기가 남지 않는다 */}
              <TeamCardImageField key={team.id} team={team} />
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "저장 중…" : "저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
