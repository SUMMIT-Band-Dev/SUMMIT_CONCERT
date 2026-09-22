import type { ReactNode } from "react";

interface SplitPanelProps {
  /** 왼쪽 목록 패널(곡 관리: 팀 목록) */
  list: ReactNode;
  /** 오른쪽 상세 패널(곡 관리: 선택한 팀의 곡 패널) */
  detail: ReactNode;
  listLabel: string;
  detailLabel: string;
}

/**
 * 목록(좌) + 상세(우) 분할 슬롯. 구조만 제공하고 내용은 화면(7c-3 곡 관리)이 채운다.
 * 넓은 화면에서는 나란히, 좁은 화면(1024px 미만)에서는 위아래로 쌓인다.
 */
export function SplitPanel({ list, detail, listLabel, detailLabel }: SplitPanelProps) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[var(--list-panel-width)_minmax(0,1fr)]">
      <section aria-label={listLabel} className="rounded-lg border bg-card p-(--card-padding)">
        {list}
      </section>
      <section aria-label={detailLabel} className="rounded-lg border bg-card p-(--card-padding)">
        {detail}
      </section>
    </div>
  );
}
