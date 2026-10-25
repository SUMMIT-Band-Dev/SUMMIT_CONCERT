import type { Metadata } from "next";
import { VenuePageClient } from "@/components/concert-content/venue-page-client";

export const metadata: Metadata = { title: "공연장 정보 · SUMMIT 관리자" };

export default function VenuePage() {
  return <VenuePageClient />;
}
