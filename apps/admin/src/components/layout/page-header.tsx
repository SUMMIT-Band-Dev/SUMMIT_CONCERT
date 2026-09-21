import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** 오른쪽의 주 동작 버튼(예: "팀 등록"). 화면이 없는 동안은 넘기지 않는다 */
  actions?: ReactNode;
}

/** 페이지 헤더: 제목 + 설명 + 우측 주 동작. 현재 위치(브레드크럼)는 상단 바가 보여 준다 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-title font-semibold leading-snug">{title}</h1>
        {description ? <p className="mt-1 text-body text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
