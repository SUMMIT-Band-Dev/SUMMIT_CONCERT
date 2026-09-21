import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/page-states";

export const metadata: Metadata = { title: "팀 관리 · SUMMIT 관리자" };

// 자리표시 화면: 7c-2에서 표(팀 목록) + 우측 주 동작("팀 등록")으로 교체한다
export default function TeamsPage() {
  return (
    <>
      <PageHeader title="팀 관리" description="공연 팀을 등록하고 순서를 바꾸며 카드뉴스 이미지를 올립니다." />
      <EmptyState title="준비 중입니다" description="팀 등록·수정·순서 변경 화면은 다음 단계에서 제공됩니다." />
    </>
  );
}
