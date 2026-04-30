import Image from "next/image";
import CardCarousel from "@/components/card-carousel";
import FacilityServiceSection from "@/components/facility-service-section";
import SiteHeader from "@/components/site-header";
import FadeInUp from "@/components/fade-in-up";

export default function Home() {
  return (
    <div className="flex min-h-screen items-start justify-center overflow-hidden bg-black text-white">
      <main className="relative w-full max-w-[430px] overflow-hidden bg-black/78 md:max-w-4xl lg:max-w-6xl">
        <div className="pointer-events-none absolute inset-0 z-0">
          <div className="blue-flow-gradient" />
          <div className="blue-flow-gradient blue-flow-gradient-secondary" />
        </div>

        <div className="relative z-10">
          <SiteHeader />
          <div className="pt-16 md:pt-20 lg:pt-24">

            <FadeInUp delay={0.05}>
              <section className="relative h-[728px] overflow-hidden md:h-[760px] lg:h-[800px]">
              <div className="absolute -left-14 top-0 h-full w-[542px]">
                <Image
                  src="/concert-poster.png"
                  alt="2025 SUMMIT 겨울 공연 포스터"
                  fill
                  priority
                  className="object-cover object-top"
                  sizes="542px"
                />
              </div>
              <div
                className="absolute inset-x-0 top-[530px] bottom-0 bg-black"
                style={{
                  WebkitMaskImage:
                    "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.75) 72%, black 100%)",
                  maskImage:
                    "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.75) 72%, black 100%)",
                }}
              />

              <FadeInUp
                className="absolute left-[19px] top-[609px] w-[270px] text-white"
                delay={0.2}
              >
                <article>
                  <h1
                    className="text-center text-2xl font-semibold leading-[28.64px]"
                    style={{ fontFamily: "Pretendard, system-ui, sans-serif" }}
                  >
                    2025년 SUMMIT 겨울공연
                  </h1>

                  <div
                    className="mt-3 w-[208px] text-[14px] font-medium leading-[16.71px]"
                    style={{ fontFamily: "Pretendard, system-ui, sans-serif" }}
                  >
                    <p className="text-center">드림홀 (서울 마포구 서교동 394-44)</p>
                    <p className="mt-2">2025-12-18 - 2025-12-19</p>
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
