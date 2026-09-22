import type { Metadata } from "next";
import { TeamsPageClient } from "@/components/teams/teams-page-client";

export const metadata: Metadata = { title: "팀 관리 · SUMMIT 관리자" };

// 서버 컴포넌트는 메타데이터만 맡는다. 실제 데이터 조회는 토큰이 브라우저(localStorage)에만
// 있어 서버에서 낼 수 없으므로, 클라이언트 컴포넌트(TanStack Query)가 담당한다(use-me.ts와 동일한 이유).
export default function TeamsPage() {
  return <TeamsPageClient />;
}
