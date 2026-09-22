import type { Metadata } from "next";
import { YoutubePageClient } from "@/components/youtube/youtube-page-client";

export const metadata: Metadata = { title: "유튜브 연결 관리 · SUMMIT 관리자" };

export default function YoutubePage() {
  return <YoutubePageClient />;
}
