import Image from "next/image";
import CardCarousel from "@/components/card-carousel";
import FacilityServiceSection from "@/components/facility-service-section";
import SiteHeader from "@/components/site-header";

export default function Home() {
  return (
    <div className="flex min-h-screen w-full items-start overflow-hidden bg-black text-white">
      <main className="relative isolate w-full overflow-hidden bg-black/78">
        <div className="relative z-10">
          <SiteHeader />
          <div>
            <section className="relative h-[100svh] min-h-[728px] overflow-visible bg-black md:min-h-[760px] lg:min-h-[820px]">
              <div className="hero-poster-media pointer-events-none absolute inset-x-0 top-0 z-0 w-full">
                <Image
                  src="/concert-poster-latest.png"
                  alt="여름 공연 포스터 배경"
                  width={819}
                  height={1170}
                  priority
                  className="h-auto w-full object-contain object-top"
                />
                <div className="absolute inset-x-0 bottom-0 h-[56svh] bg-gradient-to-b from-transparent via-black/70 to-black md:h-[62svh] lg:h-[68svh]" />
              </div>

              <div className="absolute z-20 inset-x-0 bottom-0 w-full px-5 pb-10 text-white md:px-8 md:pb-10 lg:px-12 lg:pb-[120px]">
                <article className="w-fit">
                  <h1
                    className="whitespace-nowrap text-left text-2xl font-semibold leading-[28.64px] md:text-[32px] md:leading-[38px] lg:text-[40px] lg:leading-[47.73px]"
                    style={{
                      fontFamily: "Pretendard, system-ui, sans-serif",
                    }}
                  >
                    2026년 SUMMIT 여름공연
                  </h1>

                  <div
                    className="mt-3 w-fit text-[14px] font-medium leading-[16.71px] md:mt-4 md:text-[22px] md:leading-[26px] lg:text-[28px] lg:leading-[33.41px]"
                    style={{
                      fontFamily: "Pretendard, system-ui, sans-serif",
                    }}
                  >
                    <p className="max-w-[560px] text-left">
                      플렉스라운지 (서울특별시 마포구 양화로 100-10)
                    </p>
                    <p className="mt-2 whitespace-nowrap text-left">
                      2026-06-26 ~ 2026-06-27
                    </p>
                  </div>

                  <button
                    type="button"
                    className="mt-5 inline-flex h-[44px] w-[132px] items-center justify-center rounded-[12px] border border-white/20 bg-black/25 text-[20px] font-medium leading-none text-white backdrop-blur-[1px] md:mt-6 md:h-[48px] md:w-[152px] md:rounded-[14px] md:text-[22px] lg:h-[57px] lg:w-[180px] lg:rounded-[16px] lg:text-[28px]"
                    style={{
                      fontFamily: "Pretendard, system-ui, sans-serif",
                    }}
                  >
                    예매하기
                  </button>
                </article>
              </div>
            </section>

            <div className="relative z-20 md:mt-14 lg:mt-24">
              <CardCarousel />
            </div>
            <div className="relative z-20 md:mt-12 lg:mt-20">
              <FacilityServiceSection />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
