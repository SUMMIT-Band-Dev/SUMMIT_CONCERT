import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// 상태 뱃지(표의 "상태" 열 등). 색은 globals.css 의 --badge-* 토큰만 참조한다.
// 색만으로 의미를 전하지 않도록 글자(상태 이름)를 반드시 함께 쓴다.
// 2026-09-22: 알약형(rounded-full)에서 테두리형 각진(rounded-sm) 칩으로 변경, 테두리는 글자와 같은 색을 쓴다.
const badgeVariants = cva(
  "inline-flex h-6 items-center gap-1 rounded-sm border px-2.5 text-caption font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-badge-neutral-fg bg-badge-neutral-bg text-badge-neutral-fg",
        success: "border-badge-success-fg bg-badge-success-bg text-badge-success-fg",
        warning: "border-badge-warning-fg bg-badge-warning-bg text-badge-warning-fg",
        danger: "border-badge-danger-fg bg-badge-danger-bg text-badge-danger-fg",
        info: "border-badge-info-fg bg-badge-info-bg text-badge-info-fg",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type StatusTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function StatusBadge({ tone, className, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="status-badge" className={cn(badgeVariants({ tone }), className)} {...props} />;
}
