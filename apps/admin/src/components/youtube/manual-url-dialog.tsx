"use client";

import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { removeYoutubeUrl, updateYoutubeUrl } from "@/lib/api/youtube";
import type { ApiError } from "@/lib/api/errors";
import type { Song } from "@/lib/api/types";
import { queryKeys } from "@/lib/query-keys";
import { checkYoutubeUrl, YOUTUBE_URL_MAX_LENGTH } from "@/lib/youtube/youtube-url";

/** 대상 곡마다 새로 마운트해 현재 주소를 채운다. 빈 값 저장은 연결 해제다(F025). */
export function ManualUrlDialog({ song, onOpenChange }: { song: Song; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const inputId = useId();
  const errorId = useId();
  const [url, setUrl] = useState(song.youtubeUrl ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);
  const mutation = useMutation<Song, ApiError, string>({
    mutationFn: (value) => (value ? updateYoutubeUrl(song.id, value) : removeYoutubeUrl(song.id)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.teamSongs(song.teamId ?? "") });
      onOpenChange(false);
    },
  });
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending) return;
    const value = url.trim();
    const reason = value ? checkYoutubeUrl(value) : null;
    setValidationError(reason);
    if (!reason) mutation.mutate(value);
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!mutation.isPending) onOpenChange(open);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>유튜브 주소 수정</DialogTitle>
          <DialogDescription>{song.title}에 연결할 영상 주소를 입력해 주세요. 빈 값으로 저장하면 연결을 해제합니다.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="grid gap-4">
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
            <Label htmlFor={inputId}>유튜브 영상 주소</Label>
            <Input
              id={inputId}
              type="url"
              inputMode="url"
              maxLength={YOUTUBE_URL_MAX_LENGTH + 1}
              placeholder="https://www.youtube.com/watch?v=…"
              value={url}
              disabled={mutation.isPending}
              aria-invalid={validationError ? true : undefined}
              aria-describedby={validationError ? errorId : undefined}
              onChange={(event) => {
                setUrl(event.target.value);
                setValidationError(null);
                mutation.reset();
              }}
            />
            {validationError ? (
              <p id={errorId} role="alert" className="text-sm text-destructive">
                {validationError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => onOpenChange(false)}>
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
