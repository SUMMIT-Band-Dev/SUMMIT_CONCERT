import type { Metadata } from "next";

export const metadata: Metadata = { title: "팀 관리 · SUMMIT 관리자" };

// 임시 자리표시 화면: 디자인(레이아웃·토큰) 승인 후 7c-2~4에서 실제 화면으로 교체한다
export default function TeamsPage() {
  return (
    <>
      <h1 className="text-lg font-semibold">팀 관리</h1>
      <p>준비 중입니다.</p>
    </>
  );
}
