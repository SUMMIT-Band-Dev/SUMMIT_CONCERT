"use client";

import { useEffect, useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { rejectRecommendation } from "@/lib/api/youtube";
import type { ApiError } from "@/lib/api/errors";
import type { Song } from "@/lib/api/types";
import { YOUTUBE_REJECT_REASON_MAX_LENGTH } from "@/lib/youtube/youtube.constants";

interface RejectDialogProps {
  /** null이면 닫힘 */
  attempt: { attemptId: string; songTitle: string } | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * 추천 반려 대화상자 (PRD F012). 사유는 선택 입력이다 — 나중에 재큐할지 판단하는 유일한 근거라
 * 서버가 저장하지만, 관리자가 굳이 안 써도 반려 자체는 된다.
 *
 * 반려하면 해당 곡은 이후 **자동 재검색 대상에서 빠진다.** 영구 제외가 아니라 재큐로 돌아온다
 * (song-table.tsx의 "결과는 텍스트로만" 방침과 동일하게 서버 오류를 그대로 보여 준다).
 */
export function RejectDialog({ attempt, onOpenChange }: RejectDialogProps) {
  const queryClient = useQueryClient();
  const reasonId = useId();
  const open = attempt !== null;
  const [reason, setReason] = useState("");

  // 다른 추천으로 열릴 때 이전 입력이 남지 않게 한다(album-cover-dialog.tsx와 같은 방식 —
  // 닫히거나 대상이 바뀔 때 정리한다).
  useEffect(() => {
    if (!open) return;
    return () => setReason("");
  }, [open, attempt?.attemptId]);

  const mutation = useMutation<Song, ApiError, void>({
    mutationFn: () => {
      if (!attempt) throw new Error("반려할 추천이 지정되지 않았습니다.");
      const trimmed = reason.trim();
      return rejectRecommendation(attempt.attemptId, trimmed.length > 0 ? trimmed : undefined);
    },
    onSuccess: () => {
      // 목록이 곧 상태별로 나뉘어 있어(open → rejected로 상태가 바뀌면 open 목록에서 사라진다),
      // 관련 상태 전체를 무효화한다.
      void queryClient.invalidateQueries({ queryKey: ["youtube", "recommendations"] });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>추천 반려</DialogTitle>
          <DialogDescription>
            {attempt ? `${attempt.songTitle}의 추천 영상을 반려합니다.` : null} 반려한 곡은 자동 재검색 대상에서
            빠집니다(재큐하면 다시 대상이 됩니다).
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
            <Label htmlFor={reasonId}>반려 사유 (선택)</Label>
            <Input
              id={reasonId}
              type="text"
              maxLength={YOUTUBE_REJECT_REASON_MAX_LENGTH + 1}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="예: 라이브 커버 영상, 원곡 아님"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button type="button" variant="destructive" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "반려하는 중…" : "반려"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
