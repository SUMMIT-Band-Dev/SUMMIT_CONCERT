"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BatchConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  limit: number;
  remaining: number;
  pending: boolean;
  onConfirm: () => void;
}

/**
 * 배치 실행 확인 다이얼로그 (PRD F011). **항상 거친다** — 건너뛰기 옵션을 두지 않는다.
 *
 * 서버는 관리자가 실수로 배치를 누르는 것을 막지 않는다(대상 곡을 지정할 수 없고
 * 기본값이 5곡이라, 유일한 방어선이 이 확인창과 곡 수 명시다). 실행 버튼 라벨에
 * 곡 수를 박아 넣어 다이얼로그를 대충 읽어도 몇 곡인지 보이게 한다.
 */
export function BatchConfirmDialog({ open, onOpenChange, limit, remaining, pending, onConfirm }: BatchConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>유튜브 검색을 {limit}곡 실행합니다</DialogTitle>
          <DialogDescription>
            오늘 남은 검색 횟수 {remaining}회 중 최대 {limit}회를 사용합니다.
            <br />
            <strong className="font-medium text-destructive">
              이 작업은 되돌릴 수 없습니다. 결과를 지우거나 반려해도 사용한 검색 횟수는 복구되지 않습니다.
            </strong>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button type="button" disabled={pending} onClick={onConfirm}>
            {pending ? "검색 중… (최대 50초)" : `${limit}곡 검색 실행`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
