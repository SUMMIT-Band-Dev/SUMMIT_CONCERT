"use client";

import type { RefObject } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { SidebarContent } from "./sidebar";

interface MobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username?: string;
  onLogout: () => void;
  /** 닫힌 뒤 포커스를 돌려줄 요소(서랍을 연 메뉴 버튼). 트리거가 이 컴포넌트 밖에 있어 직접 지정한다 */
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
}

/**
 * 1024px 미만에서 사이드바를 대신하는 서랍.
 * Radix Dialog 위에 만들어 포커스 가둠·Esc 닫기·스크롤 잠금·스크린리더 안내를 그대로 받는다.
 * 메뉴를 누르면 닫힌다.
 */
export function MobileDrawer({ open, onOpenChange, username, onLogout, returnFocusRef }: MobileDrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 lg:hidden" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusRef?.current?.focus();
          }}
          className="fixed inset-y-0 left-0 z-50 w-(--sidebar-width) max-w-[85vw] outline-none data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left lg:hidden"
        >
          <DialogPrimitive.Title className="sr-only">관리자 메뉴</DialogPrimitive.Title>
          <SidebarContent
            username={username}
            onLogout={() => {
              onOpenChange(false);
              onLogout();
            }}
            onNavigate={() => onOpenChange(false)}
          />
          <DialogPrimitive.Close
            aria-label="메뉴 닫기"
            className="absolute right-2 top-3.5 flex size-8 items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-active-foreground focus-visible:outline-2 focus-visible:outline-sidebar-indicator"
          >
            <X aria-hidden="true" className="size-[18px]" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
