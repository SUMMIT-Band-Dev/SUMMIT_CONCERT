"use client";

import Image from "next/image";
import { useState } from "react";
import SiteHeader from "@/components/site-header";

export default function TimeTablePage() {
  const [selectedDay, setSelectedDay] = useState<1 | 2>(1);

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader />

      <main className="relative min-h-screen overflow-hidden pt-16 md:pt-[84px] lg:pt-[102px]">
        <div className="pointer-events-none absolute inset-0 z-0">
          <Image
            src="/concert-poster-latest.png"
            alt="타임 테이블 배경"
            fill
            priority
            sizes="100vw"
            className="object-cover object-top opacity-90"
          />
          <div className="absolute inset-0 bg-[#090b1f]/58" />
        </div>

        <section className="relative z-10 mx-auto w-full max-w-[1440px] px-5 pb-20 pt-12 text-center md:px-8 md:pt-20 lg:px-12 lg:pt-24">
          <h1 className="text-[22px] font-semibold leading-[28px] md:text-[30px] md:leading-[38px] lg:text-[34px] lg:leading-[42px]">
            공연 타임 테이블
          </h1>

          <div className="mt-8 flex items-center justify-center gap-8 md:mt-10 md:gap-10">
            <button
              type="button"
              onClick={() => setSelectedDay(1)}
              className={`text-[19px] font-medium leading-[23px] transition-colors md:text-[22px] md:leading-[27px] lg:text-[26px] lg:leading-[32px] ${
                selectedDay === 1 ? "text-white" : "text-white/45"
              }`}
            >
              1일차 공연
            </button>
            <button
              type="button"
              onClick={() => setSelectedDay(2)}
              className={`text-[19px] font-medium leading-[23px] transition-colors md:text-[22px] md:leading-[27px] lg:text-[26px] lg:leading-[32px] ${
                selectedDay === 2 ? "text-white" : "text-white/45"
              }`}
            >
              2일차 공연
            </button>
          </div>

          <div className="mx-auto mt-14 w-full md:mt-16 lg:mt-20">
            <Image
              key={selectedDay}
              src={selectedDay === 1 ? "/time-table-day1-20260613-1702.png" : "/time-table-day2-20260613-1704.png"}
              alt={selectedDay === 1 ? "1일차 공연 타임 테이블" : "2일차 공연 타임 테이블"}
              width={966}
              height={770}
              sizes="100vw"
              unoptimized
              className="h-auto w-full rounded-[20px] border border-white/20 object-contain"
            />
          </div>
        </section>
      </main>
    </div>
  );
}
