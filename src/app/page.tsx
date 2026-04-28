import Image from "next/image";
import CardCarousel from "@/components/card-carousel";
import FacilityServiceSection from "@/components/facility-service-section";

export default function Home() {
  return (
    <div className="flex min-h-screen items-start justify-center bg-black px-4 py-10 text-white">
      <main className="w-full max-w-[430px] overflow-hidden bg-black">
        <header className="flex h-16 items-center justify-between bg-black px-5">
          <p
            className="text-[18px] leading-[19.8px]"
            style={{ fontFamily: '"Puradak Gentle Gothic OTF", Pretendard, sans-serif' }}
          >
            SUMMIT
          </p>

          <button
            type="button"
            aria-label="메뉴 열기"
            className="flex h-6 w-6 flex-col items-center justify-center gap-[3px]"
          >
            <span className="block h-[2px] w-[18px] rounded-full bg-white" />
            <span className="block h-[2px] w-[18px] rounded-full bg-white" />
            <span className="block h-[2px] w-[18px] rounded-full bg-white" />
          </button>
        </header>

        <section className="relative h-[728px] overflow-hidden">
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

          <article className="absolute left-[19px] top-[609px] w-[270px] text-white">
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
        </section>

        <CardCarousel />
        <FacilityServiceSection />
      </main>
    </div>
  );
}
