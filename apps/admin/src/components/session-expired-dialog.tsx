"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LoginForm } from "@/components/login-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth/auth-context";

interface SessionExpiredDialogProps {
  open: boolean;
  /** 마지막으로 로그인한 계정 이름(있으면 미리 채운다) */
  username?: string;
}

/**
 * 세션(토큰)이 만료됐을 때 **현재 페이지 위에** 띄우는 재로그인 대화상자.
 *
 * 로그인 페이지로 이동하지 않는 이유: 이동하면 지금 화면이 언마운트되어 작성 중이던 폼 내용을 잃는다.
 * 페이지를 그대로 두면 폼 상태(React Hook Form 등)가 보존되고, 재로그인 뒤 저장을 다시 누르기만 하면 된다.
 * 닫기 수단은 일부러 없앴다(만료된 채로 계속 조작하면 요청마다 401). 나가려면 "로그아웃"을 쓴다.
 */
export function SessionExpiredDialog({ open, username }: SessionExpiredDialogProps) {
  const { signOut } = useAuth();
  const queryClient = useQueryClient();

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>다시 로그인해 주세요</DialogTitle>
          <DialogDescription>
            로그인 시간이 지났습니다. 화면에 입력하던 내용은 그대로 남아 있으니, 다시 로그인한 뒤 저장을 다시 눌러 주세요.
          </DialogDescription>
        </DialogHeader>

        <LoginForm
          initialUsername={username}
          onSuccess={() => {
            // 만료 중에 401을 받은 조회를 새 토큰으로 다시 가져온다
            void queryClient.invalidateQueries();
          }}
        />

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={signOut}>
            로그아웃
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
