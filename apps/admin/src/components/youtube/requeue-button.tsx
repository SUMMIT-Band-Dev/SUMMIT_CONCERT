"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { requeueYoutubeSong } from "@/lib/api/youtube";
import type { ApiError } from "@/lib/api/errors";
import type { Song } from "@/lib/api/types";

interface RequeueButtonProps {
  songId: string;
  songTitle: string;
}

/**
 * 재검색 대기로 되돌리기 (반려됐거나 결과가 0건이었던 곡). 쿼터를 쓰지 않는 DB 갱신이지만,
 * "다음 배치 실행 때 쿼터 1회를 쓴다"는 사실은 미리 알려 준다.
 *
 * ⚠️ **알려진 한계**: 재큐해도 목록 API가 `invalidatedAt`을 노출하지 않아, 새로고침하면
 * 이 항목은 여전히 "반려됨"/"결과 없음" 탭에 남는다(같은 버튼을 다시 누르면 서버가 400을
 * 준다). 이번 세션 안에서는 버튼을 비활성화 상태로 바꿔 중복 클릭만 막는다.
 */
export function RequeueButton({ songId, songTitle }: RequeueButtonProps) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [done, setDone] = useState(false);

  const mutation = useMutation<Song, ApiError, void>({
    mutationFn: () => requeueYoutubeSong(songId),
    onSuccess: () => {
      setDone(true);
      setConfirmOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["youtube", "recommendations"] });
    },
  });

  if (done) {
    return (
      <span className="text-caption text-muted-foreground">재검색 대기로 전환됨</span>
    );
  }

  return (
    <>
      <Button type="button" variant="subtle" size="sm" onClick={() => setConfirmOpen(true)}>
        재검색 대기로
      </Button>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>재검색 대기로 전환</DialogTitle>
            <DialogDescription>
              {songTitle}을(를) 배치 검색 대상으로 되돌립니다. 다음 배치 실행 때 검색되며,
              그때 오늘의 검색 횟수를 1회 사용합니다.
            </DialogDescription>
          </DialogHeader>

          {mutation.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {mutation.error.messages.join(" ")}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              취소
            </Button>
            <Button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? "전환 중…" : "재검색 대기로 전환"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
