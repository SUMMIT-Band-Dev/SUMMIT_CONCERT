"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export default function TimeTableView({ days }: {
  days: { dayKey: string; label: string; imageUrl: string | null }[];
}) {
  const [selectedDayKey, setSelectedDayKey] = useState(days[0]?.dayKey);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const selectedDay = days.find((day) => day.dayKey === selectedDayKey) ?? days[0];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isDesktopPointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
      if (isDesktopPointer && event.key === "Escape" && isZoomOpen) {
        setIsZoomOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isZoomOpen]);

  return (
    <>
      <section className="relative z-10 mx-auto w-full max-w-360 px-5 pb-20 pt-12 text-center md:px-8 md:pt-20 lg:px-12 lg:pt-24">
        <h1 className="text-[22px] font-semibold leading-7 md:text-[30px] md:leading-9.5 lg:text-[34px] lg:leading-10.5">
          공연 타임 테이블
        </h1>

        {days.length > 0 ? (
          <div className="mt-8 flex items-center justify-center gap-8 md:mt-10 md:gap-10">
            {days.map((day) => (
              <button
                key={day.dayKey}
                type="button"
                onClick={() => setSelectedDayKey(day.dayKey)}
                className={`text-[19px] font-medium leading-5.75 transition-colors md:text-[22px] md:leading-6.75 lg:text-[26px] lg:leading-8 ${selectedDay?.dayKey === day.dayKey ? "text-white" : "text-white/45"
                  }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        ) : null}

        {selectedDay?.imageUrl ? (
          <div className="mx-auto mt-14 w-full md:mt-16 lg:mt-20">
            <Image
              key={selectedDay.dayKey}
              src={selectedDay.imageUrl}
              alt={`${selectedDay.label} 타임 테이블`}
              width={966}
              height={770}
              sizes="100vw"
              unoptimized
              className="h-auto w-full cursor-zoom-in rounded-[20px] border border-white/20 object-contain"
              onClick={() => setIsZoomOpen(true)}
            />
          </div>
        ) : null}
      </section>
      {isZoomOpen && selectedDay?.imageUrl ? (
        <div
          className="fixed inset-0 z-[100] bg-black/92 backdrop-blur-[1px]"
          onClick={() => setIsZoomOpen(false)}
        >
          <button
            type="button"
            aria-label="확대 이미지 닫기"
            onClick={() => setIsZoomOpen(false)}
            className="absolute right-4 top-4 z-[110] inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/35 bg-black/45 text-[28px] leading-none text-white transition-colors hover:bg-black/70 md:right-6 md:top-6"
          >
            ×
          </button>
          <div className="flex h-full w-full items-center justify-center p-5 md:p-8">
            <Image
              src={selectedDay.imageUrl}
              alt={`${selectedDay.label} 타임 테이블 확대 이미지`}
              width={966}
              height={770}
              sizes="100vw"
              unoptimized
              className="h-auto max-h-[90vh] w-auto max-w-[95vw] rounded-[14px] object-contain"
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
