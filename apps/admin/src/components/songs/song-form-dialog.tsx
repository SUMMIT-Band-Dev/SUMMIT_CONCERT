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
import { createSong, updateSong } from "@/lib/api/songs";
import type { ApiError } from "@/lib/api/errors";
import type { Song } from "@/lib/api/types";
import { queryKeys } from "@/lib/query-keys";
import { SINGER_MAX_LENGTH, SONG_TITLE_MAX_LENGTH, songSchema, type SongFormValues } from "@/lib/songs/song-schema";

interface SongFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  /** 없으면 등록, 있으면 그 곡을 수정 */
  song?: Song;
}

const EMPTY_VALUES: SongFormValues = { title: "", singer: "" };

/**
 * 곡 등록·수정 대화상자 (PRD F009).
 *
 * 등록과 수정이 같은 두 필드(제목·가수)를 쓰고 서버 검증 규칙도 같아서 한 컴포넌트로 둔다
 * (팀 쪽은 등록에만 공연순서가 있어 나눠야 했다).
 *
 * 수정 시 안내가 하나 붙는다 — 제목·가수가 실제로 바뀌면 서버가 유튜브 검토 상태를
 * `pending`으로 되돌린다(URL은 유지). 곡을 다른 곡으로 바꿔 놓고 이전 곡의 영상이 승인된 채
 * 남는 것을 막는 서버 동작인데, 모르면 "왜 검토 상태가 바뀌었지?"가 된다.
 */
export function SongFormDialog({ open, onOpenChange, teamId, song }: SongFormDialogProps) {
  const queryClient = useQueryClient();
  const ids = { title: useId(), singer: useId() };
  const isEdit = song !== undefined;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SongFormValues>({
    resolver: zodResolver(songSchema),
    defaultValues: EMPTY_VALUES,
  });

  const mutation = useMutation<Song, ApiError, SongFormValues>({
    mutationFn: (values) => (song ? updateSong(song.id, values) : createSong(teamId, values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.teamSongs(teamId) });
      onOpenChange(false);
    },
  });

  // 열릴 때마다 대상 곡의 값(등록이면 빈 값)으로 채우고 이전 오류를 지운다
  useEffect(() => {
    if (open) {
      reset(song ? { title: song.title, singer: song.singer ?? "" } : EMPTY_VALUES);
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset/mutation.reset은 매 렌더 새 참조라 열림 여부와 대상 곡만 의존성으로 둔다
  }, [open, song?.id]);

  const onSubmit = handleSubmit((values) => {
    if (mutation.isPending) return;
    mutation.mutate(values);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "곡 수정" : "곡 등록"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "제목이나 가수를 실제로 바꾸면 유튜브 검토 상태가 '검토 대기'로 돌아갑니다(연결된 영상 주소는 유지됩니다)."
              : "곡 제목과 가수를 입력해 주세요. 같은 팀에 같은 제목·가수의 곡이 있으면 등록되지 않습니다."}
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
            <Label htmlFor={ids.title}>곡 제목</Label>
            <Input
              id={ids.title}
              type="text"
              maxLength={SONG_TITLE_MAX_LENGTH + 1}
              aria-invalid={errors.title ? true : undefined}
              {...register("title")}
            />
            {errors.title ? <p className="text-sm text-destructive">{errors.title.message}</p> : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={ids.singer}>가수</Label>
            <Input
              id={ids.singer}
              type="text"
              maxLength={SINGER_MAX_LENGTH + 1}
              aria-invalid={errors.singer ? true : undefined}
              {...register("singer")}
            />
            {errors.singer ? <p className="text-sm text-destructive">{errors.singer.message}</p> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "저장 중…" : isEdit ? "저장" : "등록"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
