"use client";

import { useRef, useState, type ReactNode } from "react";
import { MobileDrawer } from "./mobile-drawer";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

interface AppShellProps {
  username?: string;
  onLogout: () => void;
  children: ReactNode;
}

/**
 * 관리자 화면의 틀(승인된 레이아웃 C안): 왼쪽 어두운 고정 사이드바 + 위쪽 밝은 상단 바 + 콘텐츠.
 * 1024px 미만에서는 사이드바 대신 서랍을 쓴다. 색·크기는 전부 globals.css 의 토큰을 참조한다.
 * 로그인 여부 판단(보호 라우트)은 이 컴포넌트의 일이 아니다 — auth-gate.tsx 가 맡는다.
 */
export function AppShell({ username, onLogout, children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[60] focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-body focus:text-foreground"
      >
        본문으로 건너뛰기
      </a>

      <Sidebar username={username} onLogout={onLogout} />
      <MobileDrawer open={drawerOpen} onOpenChange={setDrawerOpen} username={username} onLogout={onLogout} returnFocusRef={menuButtonRef} />

      <div className="lg:pl-(--sidebar-width)">
        <Topbar onOpenMenu={() => setDrawerOpen(true)} menuButtonRef={menuButtonRef} />
        <main id="main-content" className="mx-auto w-full max-w-(--content-max-width) p-(--page-padding)">
          {children}
        </main>
      </div>
    </div>
  );
}
