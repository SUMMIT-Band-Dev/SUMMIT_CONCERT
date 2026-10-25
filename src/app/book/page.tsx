import { getConcert, getPerformanceDays, getLineupByDay } from "@/lib/concert-content";
import { formatBookingLineup } from "@/lib/concert-content-format";
import Image from "next/image";
import FadeInUp from "@/components/common/fade-in-up";
import SiteHeader from "@/components/layout/site-header";

export default async function BookPage() {
  const [concert, days, lineupByDay] = await Promise.all([getConcert(), getPerformanceDays(), getLineupByDay()]);
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader />

      <main className="relative min-h-screen overflow-hidden pt-16 md:pt-21 lg:pt-25.5">
        <div className="pointer-events-none absolute inset-0 z-0">
          {concert.posterImageUrl ? (
            <Image
              src={concert.posterImageUrl}
              alt="예매 페이지 배경"
              fill
              priority
              sizes="100vw"
              className="object-cover object-center opacity-90"
            />
          ) : null}
          <div className="absolute inset-0 bg-[#090b1f]/55" />
          <div className="absolute inset-x-0 bottom-0 h-[48vh] bg-linear-to-b from-transparent via-black/60 to-black/85" />
        </div>

        <section className="relative z-10 mx-auto flex min-h-[calc(100svh-64px)] w-full max-w-360 items-center justify-center px-5 pb-12 pt-8 text-center md:min-h-[calc(100svh-84px)] md:px-8 md:pb-14 md:pt-10 lg:min-h-[calc(100svh-102px)] lg:px-18 lg:pb-16 lg:pt-12">
          <div className="relative -top-1 w-full md:-top-1.5">
            <FadeInUp delay={0.04} y={18}>
              <h1 className="text-[22px] font-semibold leading-7 md:text-[30px] md:leading-9.5 lg:text-[34px] lg:leading-10.5">
                관람하실 공연 날짜를 선택해 주세요.
              </h1>
            </FadeInUp>

            <div className="mt-10 grid w-full max-w-225 grid-cols-1 gap-5 md:mx-auto md:mt-12 md:grid-cols-2 md:gap-8 lg:mt-14">
              {days.map((day, index) => (
                <FadeInUp
                  key={day.dayKey}
                  delay={0.1 + index * 0.08}
                  y={20}
                  className="w-full"
                >
                  <article className="mx-auto flex w-full max-w-90 flex-col items-center rounded-[18px] border border-white/25 bg-[#0f1223]/28 px-6 pb-6 pt-7 shadow-[0_18px_44px_rgba(0,0,0,0.3)] backdrop-blur-[6px] transition-all duration-300 hover:-translate-y-1 hover:border-white hover:shadow-[0_20px_36px_rgba(0,0,0,0.36)] md:min-h-80 md:max-w-none md:px-8 md:pb-8 md:pt-8">
                    <h2 className="text-[34px] font-semibold leading-none md:text-[40px]">
                      {day.dayLabel}
                    </h2>
                    <p className="mt-4 text-[20px] font-semibold leading-6 md:mt-5 md:text-[24px] md:leading-7.25">
                      {day.dateLabel}
                    </p>

                    <div className="mt-5 space-y-1 text-[13px] font-medium leading-4.5 text-white/88 md:mt-6 md:text-[14px] md:leading-5">
                      <p className="whitespace-pre-line">{formatBookingLineup(day.lineupOverride, lineupByDay[day.dayKey] ?? [])}</p>
                    </div>

                    {day.bookingUrl ? (
                      <a
                        href={day.bookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-7 inline-flex h-13 w-54 items-center justify-center rounded-[14px] bg-black/45 text-[20px] font-semibold leading-none text-white transition-colors duration-200 hover:bg-[#2b315f]/90 active:bg-[#3a427f] md:mt-8 md:h-14.5 md:w-59 md:text-[22px]"
                      >
                        사전 예매하기
                      </a>
                    ) : null}
                  </article>
                </FadeInUp>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
