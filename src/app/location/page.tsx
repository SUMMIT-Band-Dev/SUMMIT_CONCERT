import { getConcert, getVenue } from "@/lib/concert-content";
import Image from "next/image";
import Link from "next/link";
import FadeInUp from "@/components/common/fade-in-up";
import NaverMap from "@/components/common/naver-map";
import SiteHeader from "@/components/layout/site-header";

export default async function LocationPage() {
  const [concert, venue] = await Promise.all([getConcert(), getVenue()]);
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader />

      <main className="relative isolate min-h-screen overflow-hidden pt-16 md:pt-21 lg:pt-25.5">
        <div className="pointer-events-none absolute inset-0 z-0">
          {concert.posterImageUrl ? (
            <Image
              src={concert.posterImageUrl}
              alt="오시는 길 배경"
              fill
              priority
              sizes="100vw"
              className="object-cover object-center"
            />
          ) : null}
          <div className="absolute inset-0 bg-[#121738]/58" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_26%_74%,rgba(255,170,196,0.22),transparent_46%),radial-gradient(circle_at_74%_24%,rgba(153,193,255,0.2),transparent_48%)]" />
        </div>

        <section className="relative z-10 mx-auto flex min-h-[calc(100svh-64px)] w-full flex-col items-center justify-center px-2 pb-10 pt-8 md:min-h-0 md:justify-start md:px-3 md:pb-16 md:pt-14 lg:px-4 lg:pt-16">
          <FadeInUp delay={0.05}>
            <h1 className="text-center text-[22px] font-semibold leading-7 md:text-[30px] md:leading-9.5 lg:text-[34px] lg:leading-10.5">
              오시는 길
            </h1>
          </FadeInUp>

          <div className="mt-6 flex w-full flex-col items-center justify-center gap-6 md:mt-10 lg:mt-12 lg:gap-12">
            <FadeInUp delay={0.12} className="w-full">
              <div className="relative left-1/2 flex w-[calc(100vw-72px)] -translate-x-1/2 flex-col items-center justify-center space-y-4 md:w-[calc(100vw-128px)] lg:w-[calc(100vw-220px)]">
                <div className="relative h-[56svh] min-h-90 w-full overflow-hidden rounded-[4px] bg-[#d9d9d9] shadow-[0_18px_34px_rgba(0,0,0,0.28)] md:h-[47svh] md:min-h-90 lg:h-[53svh] lg:min-h-115">
                  <NaverMap latitude={venue.latitude} longitude={venue.longitude} name={venue.name} address={venue.address} />
                </div>
                <div className="flex flex-col items-center justify-center gap-3 text-center md:flex-row md:flex-wrap md:gap-4">
                  {venue.naverMapUrl ? (
                    <Link
                      href={venue.naverMapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-[10px] border border-white/35 bg-black/35 px-5 py-2.5 text-[16px] font-semibold text-white transition-opacity hover:opacity-85"
                    >
                      네이버 지도에서 보기
                    </Link>
                  ) : null}
                  <p className="text-[16px] leading-[1.45] text-white/88 md:text-[18px]">
                    {venue.addressDetail ? `${venue.address} ${venue.addressDetail}` : venue.address}
                  </p>
                </div>
              </div>
            </FadeInUp>
          </div>
        </section>
      </main>
    </div>
  );
}
