import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/page-states";

export const metadata: Metadata = { title: "유튜브 연결 관리 · SUMMIT 관리자" };

// 자리표시 화면: 7c-4에서 추천 리뷰 표(상태 뱃지, 승인/반려 버튼)와 배치 실행 영역으로 교체한다
export default function YoutubePage() {
  return (
    <>
      <PageHeader title="유튜브 연결 관리" description="영상 링크가 없는 곡의 추천 영상을 검토하고 확정합니다." />
      <EmptyState title="준비 중입니다" description="유튜브 연결 관리 화면은 다음 단계에서 제공됩니다." />
    </>
  );
}
