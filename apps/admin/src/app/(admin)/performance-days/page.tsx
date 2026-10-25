import type { Metadata } from "next";
import { PerformanceDaysPageClient } from "@/components/concert-content/performance-days-page-client";
export const metadata: Metadata = { title: "일차별 공연 · SUMMIT 관리자" };
export default function PerformanceDaysPage() {
  return <PerformanceDaysPageClient />;
}
