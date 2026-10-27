import type { Metadata } from "next";
import { TicketPageClient } from "@/components/concert-content/ticket-page-client";
export const metadata: Metadata = { title: "티켓 안내 · SUMMIT 관리자" };
export default function TicketPage() {
  return <TicketPageClient />;
}
