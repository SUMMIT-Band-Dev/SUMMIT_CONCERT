"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { BRAND_NAME, findNavItem } from "@/lib/nav";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** 오른쪽의 주 동작 버튼(예: "팀 등록"). 화면이 없는 동안은 넘기지 않는다 */
  actions?: ReactNode;
}

/**
 * 페이지 헤더: 브레드크럼 + 제목 + 설명 + 우측 주 동작.
 * 2026-09-22: 현재 위치(브레드크럼)를 상단 바에서 이곳(제목 위)으로 옮겼다 — 상단 바는 모바일 메뉴 버튼 중심으로 단순화했다.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  const pathname = usePathname();
  const section = findNavItem(pathname);

  return (
    <div className="mb-6">
      <nav aria-label="현재 위치" className="mb-1.5">
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

      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-page-title font-semibold leading-snug">{title}</h1>
          {description ? <p className="mt-1 text-body text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
