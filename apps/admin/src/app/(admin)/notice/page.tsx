import type { Metadata } from "next";
import { NoticePageClient } from "@/components/concert-content/notice-page-client";
export const metadata: Metadata = { title: "관람 유의사항 · SUMMIT 관리자" };
export default function NoticePage() {
  return <NoticePageClient />;
}
