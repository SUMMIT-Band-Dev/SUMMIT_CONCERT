import Image from "next/image";
import CardCarousel from "@/components/card-carousel";
import FacilityServiceSection from "@/components/facility-service-section";
import SiteHeader from "@/components/site-header";

export default function Home() {
  return (
    <div className="flex min-h-screen w-full items-start overflow-hidden bg-black text-white">
      <main className="relative isolate w-full overflow-hidden bg-black/78">
        <div className="pointer-events-none absolute inset-0 z-0">
          <div className="blue-flow-gradient" />
          <div className="blue-flow-gradient blue-flow-gradient-secondary" />
        </div>

        <div className="relative z-10">
          <SiteHeader />
          <div className="pt-16">
            <section className="relative isolate h-[calc(100svh-64px)] min-h-[728px] overflow-hidden bg-black [contain:paint] md:min-h-[760px] lg:min-h-[820px]">
              <div className="hero-poster-media absolute -left-14 bottom-0 z-0 h-full w-[542px] md:inset-0 md:h-full md:w-full">
                <Image
                  src="/concert-poster.png"
                  alt="여름 공연 포스터 배경"
                  fill
                  priority
                  sizes="100vw"
                  className="hero-poster-video h-full w-full object-cover object-bottom"
                />
              </div>

              <div className="absolute z-20 inset-x-0 bottom-0 w-full px-5 pb-10 text-white md:px-8 md:pb-10 lg:px-12 lg:pb-[120px]">
                <article className="w-fit">
                  <h1
                    className="whitespace-nowrap text-left text-2xl font-semibold leading-[28.64px] lg:text-4xl lg:leading-[1.2]"
                    style={{
                      fontFamily: "Pretendard, system-ui, sans-serif",
                    }}
                  >
                    2026년 SUMMIT 여름공연
                  </h1>

                  <div
                    className="mt-3 w-fit text-[14px] font-medium leading-[16.71px] lg:mt-4 lg:text-base lg:leading-6"
                    style={{
                      fontFamily: "Pretendard, system-ui, sans-serif",
                    }}
                  >
                    <p className="whitespace-nowrap text-left">플렉스 라운지</p>
                    <p className="mt-2 whitespace-nowrap text-left">
                      2026-06-25 - 2026-06-26
                    </p>
                  </div>
                </article>
              </div>
            </section>

            <div className="md:mt-14 lg:mt-24">
              <CardCarousel />
            </div>
            <div className="md:mt-12 lg:mt-20">
              <FacilityServiceSection />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
