import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// 데이터 표. 행 높이 44px(--row-height). 데이터가 작아(팀 15, 곡 64) 페이징은 두지 않는다.
// 행 끝의 상세/동작 버튼은 마지막 칸(TableCell 안 Button, variant="subtle")에 둔다.
// 2026-09-22: 머리글을 옅은 면(bg-muted)에서 흰 배경 + 굵은 글자로 바꾸고, 상단에 "전체 N건" 표시를 추가했다.
// 번호·상태·일자처럼 숫자/짧은 값 열은 호출부에서 TableHead/TableCell 에 className="text-center" 를 얹어 가운데 정렬한다(이름 열은 기본값인 왼쪽 정렬 유지).

interface TableProps extends ComponentProps<"table"> {
  /** "전체 N건" 표시. 화면에 실제 데이터가 있을 때만 넘긴다 */
  totalCount?: number;
}

export function Table({ className, totalCount, ...props }: TableProps) {
  return (
    <div className="w-full overflow-hidden rounded-lg border bg-card">
      {typeof totalCount === "number" ? (
        <div className="flex items-center justify-between border-b px-4 py-2 text-small text-muted-foreground">
          <span>전체 {totalCount}건</span>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table data-slot="table" className={cn("w-full caption-bottom text-body", className)} {...props} />
      </div>
    </div>
  );
}

export function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("bg-card [&_tr]:h-10", className)} {...props} />;
}

export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("h-(--row-height) border-b transition-colors hover:bg-accent/60", className)} {...props} />;
}

export function TableHead({ className, ...props }: ComponentProps<"th">) {
  return <th className={cn("px-4 text-left text-small font-bold whitespace-nowrap text-foreground", className)} {...props} />;
}

export function TableCell({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("px-4 align-middle", className)} {...props} />;
}
