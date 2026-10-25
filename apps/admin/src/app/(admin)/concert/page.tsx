import type { Metadata } from "next";
import { ConcertPageClient } from "@/components/concert-content/concert-page-client";
export const metadata: Metadata = { title: "공연 기본 정보 · SUMMIT 관리자" };
export default function ConcertPage() {
  return <ConcertPageClient />;
}
