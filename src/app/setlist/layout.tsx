import type { ReactNode } from "react";
import Image from "next/image";
import SiteHeader from "@/components/layout/site-header";

export default function SetlistLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader />

      {/* 뷰포트 고정 배경 — 콘텐츠 길이(카드/트랙 수)와 무관하게 크기가 고정되어야
          데이터 도착 전/후로 main 높이가 바뀌어도 이 오버레이가 밀리지 않는다. */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <Image
          src="/concert-poster-latest.png"
          alt="셋리스트 배경"
          fill
          priority
          sizes="100vw"
          className="object-cover object-bottom opacity-95"
        />
        <div className="absolute inset-0 bg-[#090b1f]/42" />
        <div className="absolute inset-x-0 bottom-0 h-[48vh] bg-gradient-to-b from-transparent via-black/45 to-black/70" />
      </div>

      {children}
    </div>
  );
}
