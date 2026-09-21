"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { SessionExpiredDialog } from "@/components/session-expired-dialog";
import { useAuth } from "@/lib/auth/auth-context";
import { decideGuard } from "@/lib/auth/guard";
import { buildLoginRedirect } from "@/lib/auth/next-path";
import { useMe } from "@/lib/auth/use-me";

/**
 * 관리자 영역의 보호 라우트(레이아웃과 무관한 부분).
 * 미로그인이면 로그인 페이지로 보내고(돌아올 경로를 ?next=로 실어), 세션이 만료되면 페이지를 유지한 채 재로그인 대화상자를 띄운다.
 * 이 가드는 화면 이동(UX)일 뿐이고 데이터를 지키는 경계는 API의 JWT Guard다(guard.ts 주석 참고).
 * 화면 틀(사이드바 + 상단 바)은 layout/app-shell.tsx 가 맡고, 이 컴포넌트는 로그인 여부 판단만 한다.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status, signOut } = useAuth();
  const decision = decideGuard(status);
  const me = useMe(status);
  // 직접 로그아웃한 경우에는 돌아올 경로(next)를 붙이지 않는다
  const isLoggingOut = useRef(false);

  useEffect(() => {
    if (decision !== "redirect-to-login") return;
    router.replace(isLoggingOut.current ? "/login" : buildLoginRedirect(window.location.pathname, window.location.search));
  }, [decision, router]);

  if (decision === "wait" || decision === "redirect-to-login") {
    return (
      <p role="status" aria-live="polite" className="p-(--page-padding) text-body text-muted-foreground">
        확인 중입니다…
      </p>
    );
  }

  return (
    <>
      <AppShell
        username={me.data?.username}
        onLogout={() => {
          isLoggingOut.current = true;
          signOut();
        }}
      >
        {children}
      </AppShell>
      <SessionExpiredDialog open={decision === "render-with-reauth"} username={me.data?.username} />
    </>
  );
}
