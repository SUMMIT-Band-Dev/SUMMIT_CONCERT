import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// 데이터 표. 행 높이 44px(--row-height), 머리글은 옅은 면. 데이터가 작아(팀 15, 곡 64) 페이징은 두지 않는다.
// 행 끝의 상세/동작 버튼은 마지막 칸(TableCell 안 Button)에 둔다.

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border bg-card">
      <table data-slot="table" className={cn("w-full caption-bottom text-body", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("bg-muted [&_tr]:h-10", className)} {...props} />;
}

export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("h-(--row-height) border-b transition-colors hover:bg-accent/60", className)} {...props} />;
}

export function TableHead({ className, ...props }: ComponentProps<"th">) {
  return <th className={cn("px-4 text-left text-small font-medium whitespace-nowrap text-muted-foreground", className)} {...props} />;
}

export function TableCell({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("px-4 align-middle", className)} {...props} />;
}
