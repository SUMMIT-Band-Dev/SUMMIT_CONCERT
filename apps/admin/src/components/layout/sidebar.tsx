"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUser, Clapperboard, Clock, LogOut, Music, Users, type LucideIcon } from "lucide-react";
import { useSessionRemainingMs } from "@/lib/auth/use-session-remaining";
import { formatSessionRemaining, isSessionExpiringSoon } from "@/lib/auth/session-remaining";
import { BRAND_NAME, isNavActive, NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";

// 메뉴 아이콘: href 로 lib/nav.ts 의 메뉴와 짝짓는다(메뉴 정의는 표현과 분리)
const NAV_ICONS: Record<string, LucideIcon> = {
  "/teams": Users,
  "/songs": Music,
  "/youtube": Clapperboard,
};

interface SidebarContentProps {
  username?: string;
  onLogout: () => void;
  /** 메뉴를 눌러 이동할 때(서랍을 닫는 데 쓴다) */
  onNavigate?: () => void;
}

/** 어두운 사이드바의 내용. 데스크톱 고정 사이드바와 모바일 서랍이 같은 내용을 쓴다 */
export function SidebarContent({ username, onLogout, onNavigate }: SidebarContentProps) {
  const pathname = usePathname();
  const remainingMs = useSessionRemainingMs();

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-(--topbar-height) shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4">
        <span
          aria-hidden="true"
          className="flex size-7 items-center justify-center rounded-md bg-primary text-small font-bold text-primary-foreground"
        >
          S
        </span>
        <span className="text-section font-semibold text-sidebar-active-foreground">{BRAND_NAME}</span>
      </div>

      <nav aria-label="관리자 메뉴" className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="grid gap-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = NAV_ICONS[item.href];
            const isActive = isNavActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex h-(--nav-item-height) items-center gap-3 rounded-md px-3 text-body transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sidebar-indicator",
                    isActive
                      ? "bg-sidebar-active font-medium text-sidebar-active-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-active-foreground",
                  )}
                >
                  {isActive ? (
                    <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-sidebar-indicator" />
                  ) : null}
                  {Icon ? <Icon aria-hidden="true" className="size-[18px] shrink-0" /> : null}
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2 px-1 pb-1">
          <CircleUser aria-hidden="true" className="size-[18px] shrink-0 text-sidebar-muted" />
          {/* 계정 이름은 서버가 준 문자열이므로 텍스트로만 렌더링한다 */}
          <span className="truncate text-body text-sidebar-active-foreground" title={username}>
            {username ?? " "}
          </span>
        </div>

        {remainingMs !== null ? (
          <p
            className={cn(
              "tabular flex items-center gap-2 px-1 pb-2 text-small",
              isSessionExpiringSoon(remainingMs) ? "text-sidebar-warning" : "text-sidebar-muted",
            )}
          >
            <Clock aria-hidden="true" className="size-4 shrink-0" />
            <span>로그인 유지 {formatSessionRemaining(remainingMs)}</span>
          </p>
        ) : null}

        <button
          type="button"
          onClick={onLogout}
          className="flex h-(--control-height) w-full items-center gap-2 rounded-md px-1 text-body text-sidebar-foreground transition-colors hover:bg-sidebar-hover hover:text-sidebar-active-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sidebar-indicator"
        >
          <LogOut aria-hidden="true" className="size-[18px] shrink-0" />
          로그아웃
        </button>
      </div>
    </div>
  );
}

/** 1024px 이상에서 보이는 고정 사이드바 */
export function Sidebar(props: SidebarContentProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-(--sidebar-width) lg:block">
      <SidebarContent {...props} />
    </aside>
  );
}
