import type { Metadata } from "next";
import { SongsPageClient } from "@/components/songs/songs-page-client";

export const metadata: Metadata = { title: "곡 관리 · SUMMIT 관리자" };

// 서버 컴포넌트는 메타데이터만 맡는다. 데이터 조회는 토큰이 브라우저에만 있어
// 클라이언트 컴포넌트가 담당한다(teams/page.tsx와 같은 이유).
export default function SongsPage() {
  return <SongsPageClient />;
}
