import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// className 결합 헬퍼(shadcn/ui 표준). 뒤에 온 Tailwind 클래스가 앞의 충돌 클래스를 이긴다
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
