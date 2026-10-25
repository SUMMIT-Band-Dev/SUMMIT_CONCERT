import Image from "next/image";
import SiteHeader from "@/components/layout/site-header";
import TimeTableView from "@/components/sections/time-table-view";
import { getConcert, getPerformanceDays } from "@/lib/concert-content";
import { formatTimetableTabLabel } from "@/lib/concert-content-format";

export default async function TimeTablePage() {
  const [concert, performanceDays] = await Promise.all([getConcert(), getPerformanceDays()]);
  const days = performanceDays.map((day) => ({
    dayKey: day.dayKey,
    label: formatTimetableTabLabel(day.dayKey, day.dayLabel),
    imageUrl: day.timetableImageUrl,
  }));

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader />
      <main className="relative min-h-screen overflow-hidden pt-16 md:pt-21 lg:pt-25.5">
        <div className="pointer-events-none absolute inset-0 z-0">
          {concert.posterImageUrl ? (
            <Image
              src={concert.posterImageUrl}
              alt="타임 테이블 배경"
              fill
              priority
              sizes="100vw"
              className="object-cover object-top opacity-90"
            />
          ) : null}
          <div className="absolute inset-0 bg-[#090b1f]/58" />
        </div>
        <TimeTableView days={days} />
      </main>
    </div>
  );
}
