"use client";

import { useEffect, useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateYoutubeUrl } from "@/lib/api/youtube";
import type { ApiError } from "@/lib/api/errors";
import type { Song } from "@/lib/api/types";
import { checkYoutubeUrl } from "@/lib/youtube/youtube-url";

interface ManualUrlDialogProps {
  /** null이면 닫힘 */
  song: { songId: string; songTitle: string } | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * 유튜브 URL 직접 입력 대화상자 (PRD F013).
 *
 * 추천 후보가 마음에 안 들 때(원곡이 아니거나 커버 영상일 때) 목록을 벗어나지 않고 바로
 * 넘어가는 동선이다. 사람이 직접 넣은 URL은 서버가 항상 `approved`로 확정한다 — 화면이
 * 검토 상태를 따로 보낼 수 없다(`updateYoutubeUrl` 주석 참조).
 */
export function ManualUrlDialog({ song, onOpenChange }: ManualUrlDialogProps) {
  const queryClient = useQueryClient();
  const urlInputId = useId();
  const open = song !== null;
  const [url, setUrl] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  // 다른 곡으로 열릴 때 이전 입력이 남지 않게 한다(album-cover-dialog.tsx와 같은 방식).
  useEffect(() => {
    if (!open) return;
    return () => {
      setUrl("");
      setValidationError(null);
    };
  }, [open, song?.songId]);

  const mutation = useMutation<Song, ApiError, string>({
    mutationFn: (value) => {
      if (!song) throw new Error("곡이 지정되지 않았습니다.");
      return updateYoutubeUrl(song.songId, value);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["youtube", "recommendations"] });
      onOpenChange(false);
    },
  });

  function handleSubmit() {
    if (mutation.isPending) return;

    // 서버와 같은 규칙으로 먼저 걸러 구체적인 사유를 보여 준다(album-cover-dialog.tsx와 동일 방침).
    const reason = checkYoutubeUrl(url);
    if (reason) {
      setValidationError(reason);
      return;
    }
    setValidationError(null);
    mutation.mutate(url.trim());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>유튜브 주소 직접 입력</DialogTitle>
          <DialogDescription>
            {song ? `${song.songTitle}에 연결할 유튜브 영상 주소를 입력해 주세요.` : null} 재생목록·타임스탬프가
            붙은 주소는 자동으로 영상 하나의 주소로 정리됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
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
            <Label htmlFor={urlInputId}>유튜브 영상 주소</Label>
            <Input
              id={urlInputId}
              type="url"
              inputMode="url"
              placeholder="https://www.youtube.com/watch?v=…"
              value={url}
              aria-invalid={validationError ? true : undefined}
              onChange={(event) => {
                setUrl(event.target.value);
                setValidationError(null);
              }}
            />
            {validationError ? (
              <p role="alert" className="text-sm text-destructive">
                {validationError}
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button type="button" disabled={url.trim().length === 0 || mutation.isPending} onClick={handleSubmit}>
            {mutation.isPending ? "저장 중…" : "이 주소로 확정"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
