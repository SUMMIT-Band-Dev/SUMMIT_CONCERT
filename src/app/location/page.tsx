import Image from "next/image";
import Link from "next/link";
import FadeInUp from "@/components/fade-in-up";
import NaverMap from "@/components/naver-map";
import SiteHeader from "@/components/site-header";

const NAVER_MAP_URL =
  "https://map.naver.com/p/search/%ED%94%8C%EB%A0%89%EC%8A%A4%EB%9D%BC%EC%9A%B4%EC%A7%80/place/37392237?placePath=%3FabtExp%3DN-PLC-AD-UI-26%253A2%26bk_query%3D%25ED%2594%258C%25EB%25A0%2589%25EC%258A%25A4%25EB%259D%25BC%25EC%259A%25B4%25EC%25A7%2580%26entry%3Dpll%26from%3Dnx%26fromNxList%3Dtrue&placeSearchOption=abtExp%3DN-PLC-AD-UI-26%253A2%26bk_query%3D%25ED%2594%258C%25EB%25A0%2589%25EC%258A%25A4%25EB%259D%25BC%25EC%259A%25B4%25EC%25A7%2580%26entry%3Dpll%26fromNxList%3Dtrue%26originalQuery%3D%25ED%2594%258C%25EB%25A0%2589%25EC%258A%25A4%25EB%259D%25BC%25EC%259A%25B4%25EC%25A7%2580%26x%3D126.949900%26y%3D37.503300&searchType=place";

export default function LocationPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader />

      <main className="relative isolate min-h-screen overflow-hidden pt-16 md:pt-[84px] lg:pt-[102px]">
        <div className="pointer-events-none absolute inset-0 z-0">
          <Image
            src="/concert-poster-latest.png"
            alt="오시는 길 배경"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-[#121738]/58" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_26%_74%,rgba(255,170,196,0.22),transparent_46%),radial-gradient(circle_at_74%_24%,rgba(153,193,255,0.2),transparent_48%)]" />
        </div>

        <section className="relative z-10 mx-auto flex min-h-[calc(100svh-64px)] w-full flex-col items-center justify-center px-2 pb-10 pt-8 md:min-h-0 md:justify-start md:px-3 md:pb-16 md:pt-14 lg:px-4 lg:pt-16">
          <FadeInUp delay={0.05}>
            <h1 className="text-center text-[22px] font-semibold leading-[28px] md:text-[30px] md:leading-[38px] lg:text-[34px] lg:leading-[42px]">
              오시는 길
            </h1>
          </FadeInUp>

          <div className="mt-6 flex w-full flex-col items-center justify-center gap-6 md:mt-10 lg:mt-12 lg:gap-12">
            <FadeInUp delay={0.12} className="w-full">
              <div className="relative left-1/2 flex w-[calc(100vw-72px)] -translate-x-1/2 flex-col items-center justify-center space-y-4 md:w-[calc(100vw-128px)] lg:w-[calc(100vw-220px)]">
                <div className="relative h-[56svh] min-h-[360px] w-full overflow-hidden rounded-[4px] bg-[#d9d9d9] shadow-[0_18px_34px_rgba(0,0,0,0.28)] md:h-[47svh] md:min-h-[360px] lg:h-[53svh] lg:min-h-[460px]">
                  <NaverMap />
                </div>
                <div className="flex flex-col items-center justify-center gap-3 text-center md:flex-row md:flex-wrap md:gap-4">
                  <Link
                    href={NAVER_MAP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-[10px] border border-white/35 bg-black/35 px-5 py-2.5 text-[16px] font-semibold text-white transition-opacity hover:opacity-85"
                  >
                    네이버 지도에서 보기
                  </Link>
                  <p className="text-[16px] leading-[1.45] text-white/88 md:text-[18px]">
                    서울특별시 마포구 양화로 100-10 지하 1층
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
