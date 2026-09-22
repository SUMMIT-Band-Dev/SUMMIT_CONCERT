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
import { createTeam } from "@/lib/api/teams";
import type { Team } from "@/lib/api/types";
import { type ApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/query-keys";
import { createTeamSchema, DAY_MAX_LENGTH, PERFORMANCE_ORDER_MAX, TEAM_NAME_MAX_LENGTH, type CreateTeamFormValues } from "@/lib/teams/team-schema";

interface TeamCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_VALUES: CreateTeamFormValues = { teamName: "", day: "", performanceOrder: 1 };

/** 팀 등록 대화상자. 이름·공연일자·공연순서 세 필드(카드뉴스 이미지는 work02-7c-2b에서 별도) */
export function TeamCreateDialog({ open, onOpenChange }: TeamCreateDialogProps) {
  const queryClient = useQueryClient();
  const ids = { teamName: useId(), day: useId(), performanceOrder: useId() };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTeamFormValues>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const mutation = useMutation<Team, ApiError, CreateTeamFormValues>({
    mutationFn: (values) => createTeam(values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.teams });
      onOpenChange(false);
    },
  });

  // 열릴 때마다 이전 입력·오류를 지운다(다시 열었을 때 지난 등록 내용이 남지 않게)
  useEffect(() => {
    if (open) {
      reset(DEFAULT_VALUES);
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset/mutation.reset은 매 렌더 새 참조라 open만 의존성으로 둔다
  }, [open]);

  const onSubmit = handleSubmit((values) => {
    if (mutation.isPending) return;
    mutation.mutate(values);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>팀 등록</DialogTitle>
          <DialogDescription>팀명·공연일자·공연순서를 입력해 주세요. 같은 일자에 순서가 이미 있으면 등록이 거부됩니다.</DialogDescription>
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

          <div className="grid gap-1.5">
            <Label htmlFor={ids.performanceOrder}>공연순서</Label>
            <Input
              id={ids.performanceOrder}
              type="number"
              min={1}
              max={PERFORMANCE_ORDER_MAX}
              aria-invalid={errors.performanceOrder ? true : undefined}
              {...register("performanceOrder", { valueAsNumber: true })}
            />
            {errors.performanceOrder ? <p className="text-sm text-destructive">{errors.performanceOrder.message}</p> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "등록 중…" : "등록"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
