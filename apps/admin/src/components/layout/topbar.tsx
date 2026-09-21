"use client";

import type { ReactNode, RefObject } from "react";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu } from "lucide-react";
import { BRAND_NAME, findNavItem } from "@/lib/nav";

interface TopbarProps {
  onOpenMenu: () => void;
  /** 서랍을 닫은 뒤 포커스를 되돌릴 메뉴 버튼 */
  menuButtonRef?: RefObject<HTMLButtonElement | null>;
  /** 오른쪽 슬롯(전역 동작이 생기면 여기에) */
  children?: ReactNode;
}

/** 상단 바: 모바일 메뉴 버튼 + 현재 위치(브레드크럼) */
export function Topbar({ onOpenMenu, menuButtonRef, children }: TopbarProps) {
  const pathname = usePathname();
  const section = findNavItem(pathname);

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

      <nav aria-label="현재 위치">
        <ol className="flex items-center gap-1.5 text-small text-muted-foreground">
          <li>{BRAND_NAME}</li>
          {section ? (
            <>
              <li aria-hidden="true">
                <ChevronRight className="size-3.5" />
              </li>
              <li aria-current="page" className="font-medium text-foreground">
                {section.label}
              </li>
            </>
          ) : null}
        </ol>
      </nav>

      {children ? <div className="ml-auto flex items-center gap-2">{children}</div> : null}
    </header>
  );
}
