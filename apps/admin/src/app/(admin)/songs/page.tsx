import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/page-states";
import { SplitPanel } from "@/components/layout/split-panel";

export const metadata: Metadata = { title: "곡 관리 · SUMMIT 관리자" };

// 자리표시 화면: 7c-3에서 왼쪽에 팀 목록, 오른쪽에 선택한 팀의 곡 패널(/songs?teamId=)을 채운다
export default function SongsPage() {
  return (
    <>
      <PageHeader title="곡 관리" description="팀을 선택해 그 팀의 곡을 등록·수정하고 앨범 커버를 정합니다." />
      <SplitPanel
        listLabel="팀 목록"
        detailLabel="곡 패널"
        list={<EmptyState bare title="팀 목록" description="팀 관리에서 등록한 팀이 여기에 표시됩니다." />}
        detail={<EmptyState bare title="준비 중입니다" description="팀을 선택하면 그 팀의 곡 패널이 여기에 열립니다." />}
      />
    </>
  );
}
