"use client";

import type { ReactNode, RefObject } from "react";
import { Menu } from "lucide-react";

interface TopbarProps {
  onOpenMenu: () => void;
  /** 서랍을 닫은 뒤 포커스를 되돌릴 메뉴 버튼 */
  menuButtonRef?: RefObject<HTMLButtonElement | null>;
  /** 오른쪽 슬롯(전역 동작이 생기면 여기에) */
  children?: ReactNode;
}

/**
 * 상단 바: 모바일 메뉴 버튼 중심.
 * 2026-09-22: 현재 위치(브레드크럼)는 PageHeader(제목 위)로 옮겼다 — 데스크톱(1024px 이상)에서는
 * 메뉴 버튼이 숨어(lg:hidden) 이 바가 사실상 비어 있고, 모바일에서만 서랍을 여는 역할을 한다.
 */
export function Topbar({ onOpenMenu, menuButtonRef, children }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-(--topbar-height) items-center gap-3 border-b bg-card px-(--page-padding)">
      <button
        ref={menuButtonRef}
        type="button"
        onClick={onOpenMenu}
        aria-label="메뉴 열기"
        className="-ml-2 flex size-(--control-height) items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring lg:hidden"
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>

      {children ? <div className="ml-auto flex items-center gap-2">{children}</div> : null}
    </header>
  );
}
