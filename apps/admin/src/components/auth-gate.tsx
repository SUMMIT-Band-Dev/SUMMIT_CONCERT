"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SessionExpiredDialog } from "@/components/session-expired-dialog";
import { useAuth } from "@/lib/auth/auth-context";
import { decideGuard } from "@/lib/auth/guard";
import { buildLoginRedirect } from "@/lib/auth/next-path";
import { useMe } from "@/lib/auth/use-me";

/**
 * 관리자 영역의 보호 라우트(레이아웃과 무관한 부분).
 * 미로그인이면 로그인 페이지로 보내고(돌아올 경로를 ?next=로 실어), 세션이 만료되면 페이지를 유지한 채 재로그인 대화상자를 띄운다.
 * 이 가드는 화면 이동(UX)일 뿐이고 데이터를 지키는 경계는 API의 JWT Guard다(guard.ts 주석 참고).
 *
 * ⚠️ 아래 임시 메뉴(TemporaryNav)는 디자인 승인 전의 **자리표시**다. 스타일 없이 링크와 로그아웃만 둔다.
 *    승인된 레이아웃(사이드바 + 상단 바)을 구현할 때 이 컴포넌트에서 메뉴 부분만 떼어 내고 가드는 그대로 둔다.
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
      <p role="status" aria-live="polite">
        확인 중입니다…
      </p>
    );
  }

  return (
    <>
      <TemporaryNav
        username={me.data?.username}
        onLogout={() => {
          isLoggingOut.current = true;
          signOut();
        }}
      />
      <main id="main-content">{children}</main>
      <SessionExpiredDialog open={decision === "render-with-reauth"} username={me.data?.username} />
    </>
  );
}

// 임시 메뉴(자리표시, 스타일 없음). PRD 메뉴 구조: 팀 관리 / 곡 관리 / 유튜브 연결 관리 / 로그아웃
function TemporaryNav({ username, onLogout }: { username?: string; onLogout: () => void }) {
  return (
    <nav aria-label="관리자 메뉴 (임시)" className="flex flex-wrap gap-4 p-4">
      <Link href="/teams">팀 관리</Link>
      <Link href="/songs">곡 관리</Link>
      <Link href="/youtube">유튜브 연결 관리</Link>
      {/* 계정 이름은 서버가 준 문자열이므로 텍스트로만 렌더링한다 */}
      {username ? <span>{username}</span> : null}
      <button type="button" onClick={onLogout}>
        로그아웃
      </button>
    </nav>
  );
}
