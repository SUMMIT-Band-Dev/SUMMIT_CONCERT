import Image from "next/image";
import Link from "next/link";
import CardCarousel from "@/components/card-carousel";
import FadeInUp from "@/components/fade-in-up";
import FacilityServiceSection from "@/components/facility-service-section";
import OfficialChannelSection from "@/components/official-channel-section";
import SiteHeader from "@/components/site-header";
import SummitFooterSection from "@/components/sitie-footer";

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
                  width={835}
                  height={1024}
                  priority
                  sizes="100vw"
                  className="h-[100svh] w-full object-cover object-top md:h-auto md:object-contain"
                />
                <div className="absolute inset-x-0 bottom-0 h-[56svh] bg-gradient-to-b from-transparent via-black/70 to-black md:h-[62svh] lg:h-[68svh]" />
              </div>
              <div className="pointer-events-none absolute inset-x-0 top-[31svh] z-20 flex flex-col items-center justify-center gap-3 md:top-[15svh] md:gap-4 lg:top-[24svh] lg:gap-8">
                <FadeInUp delay={0.06}>
                  <Image
                    src="/hero-hanja.png"
                    alt="황혼 타이틀"
                    width={512}
                    height={200}
                    className="h-auto w-[220px] md:w-[300px] lg:w-[400px]"
                  />
                </FadeInUp>
                <FadeInUp delay={0.12}>
                  <Image
                    src="/hero-subtitle.png"
                    alt="황혼에 물드는, 우리의 여름"
                    width={434}
                    height={45}
                    className="h-auto w-[210px] md:w-[290px] lg:w-[360px]"
                  />
                </FadeInUp>
              </div>

              <div className="absolute z-20 inset-x-0 bottom-[10svh] w-full px-5 pb-8 text-white md:bottom-0 md:px-8 md:pb-10 lg:px-12 lg:pb-[120px]">
                <article className="mx-auto flex w-full max-w-[705px] flex-col items-center text-center">
                  <FadeInUp delay={0.18}>
                    <h1
                      className="whitespace-nowrap text-center text-[24px] font-semibold leading-[28.64px] md:text-[30px] md:leading-[35px] lg:text-[36px] lg:leading-[42.96px]"
                      style={{
                        fontFamily: "Pretendard, system-ui, sans-serif",
                      }}
                    >
                      2026년 SUMMIT 여름공연
                    </h1>
                  </FadeInUp>

                  <FadeInUp delay={0.24}>
                    <div
                      className="mt-2 w-full text-[14px] font-normal leading-[16.71px] md:mt-3 md:text-[18px] md:leading-[22px] lg:text-[24px] lg:leading-[28.64px]"
                      style={{
                        fontFamily: "Pretendard, system-ui, sans-serif",
                      }}
                    >
                      <p className="mx-auto max-w-[560px] text-center">
                        플렉스라운지 (서울특별시 마포구 양화로 100-10)
                      </p>
                      <p className="mt-1 whitespace-nowrap text-center md:mt-2">
                        2026-06-26 ~ 2026-06-27
                      </p>
                    </div>
                  </FadeInUp>

                  <FadeInUp delay={0.3}>
                    <Link
                      href="/book"
                      className="mt-5 inline-flex h-[48px] w-[200px] items-center justify-center rounded-[12px] border border-white/20 bg-black/25 text-[20px] font-medium leading-none text-white backdrop-blur-[1px] md:mt-6 md:h-[48px] md:w-[152px] md:rounded-[14px] md:text-[22px] lg:h-[64px] lg:w-[180px] lg:rounded-[16px] lg:text-[28px]"
                      style={{
                        fontFamily: "Pretendard, system-ui, sans-serif",
                      }}
                    >
                      예매하기
                    </Link>
                  </FadeInUp>
                </article>
              </div>
            </section>

            <div className="relative md:mt-14 lg:mt-24">
              <div className="pointer-events-none absolute inset-0 z-10 md:hidden overflow-hidden">
                <div className="blue-flow-gradient" />
                <div className="blue-flow-gradient blue-flow-gradient-secondary" />
                <div className="absolute inset-x-0 bottom-0 h-[36svh] bg-gradient-to-b from-transparent via-black/60 to-black" />
              </div>
              <div className="relative z-20">
                <CardCarousel />
              </div>
              <div className="relative z-20 md:mt-12 lg:mt-20">
                <FacilityServiceSection />
              </div>
              <div className="relative z-20">
                <section className="px-5 pb-16 pt-12 md:px-8 md:pb-20 md:pt-16 lg:px-12 lg:pb-24 lg:pt-20">
                  <div className="w-full">
                    <OfficialChannelSection />
                    <div className="mt-10 md:mt-14">
                      <SummitFooterSection />
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
