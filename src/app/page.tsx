import Image from "next/image";
import CardCarousel from "@/components/card-carousel";
import FacilityServiceSection from "@/components/facility-service-section";
import SiteHeader from "@/components/site-header";
import FadeInUp from "@/components/fade-in-up";

export default function Home() {
  return (
    <div className="flex min-h-screen w-full items-start overflow-hidden bg-black text-white">
      <main className="relative w-full overflow-hidden bg-black/78">
        <div className="pointer-events-none absolute inset-0 z-0">
          <div className="blue-flow-gradient" />
          <div className="blue-flow-gradient blue-flow-gradient-secondary" />
        </div>

        <div className="relative z-10">
          <SiteHeader />
          <div className="pt-16">
            <FadeInUp delay={0.05}>
              <section className="relative h-[calc(100svh-64px)] min-h-[728px] overflow-hidden md:min-h-[760px] lg:min-h-[820px]">
                <div className="absolute -left-14 top-0 h-full w-[542px] lg:left-0 lg:w-full">
                  <Image
                    src="/concert-poster.png"
                    alt="2025 SUMMIT 겨울 공연 포스터"
                    fill
                    priority
                    className="object-cover object-top"
                    sizes="(min-width: 1024px) 1280px, 542px"
                  />
                </div>
                <div className="absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-black via-black/75 to-transparent lg:h-[52%] lg:from-black/95 lg:via-black/70" />

                <FadeInUp
                  className="absolute inset-x-0 bottom-0 w-full px-5 pb-10 text-white md:px-8 md:pb-10 lg:px-12 lg:pb-[120px]"
                  delay={0.2}
                >
                  <article className="w-fit">
                    <h1
                      className="whitespace-nowrap text-center text-2xl font-semibold leading-[28.64px] lg:text-left lg:text-4xl lg:leading-[1.2]"
                      style={{
                        fontFamily: "Pretendard, system-ui, sans-serif",
                      }}
                    >
                      2025년 SUMMIT 겨울공연
                    </h1>

                    <div
                      className="mt-3 w-fit text-[14px] font-medium leading-[16.71px] lg:mt-4 lg:text-base lg:leading-6"
                      style={{
                        fontFamily: "Pretendard, system-ui, sans-serif",
                      }}
                    >
                      <p className="whitespace-nowrap text-center lg:text-left">
                        드림홀 (서울 마포구 서교동 394-44)
                      </p>
                      <p className="mt-2 whitespace-nowrap text-center lg:text-left">
                        2025-12-18 - 2025-12-19
                      </p>
                    </div>
                  </article>
                </FadeInUp>
              </section>
            </FadeInUp>

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
