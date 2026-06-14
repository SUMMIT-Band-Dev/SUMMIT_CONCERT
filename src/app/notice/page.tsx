import Image from "next/image";
import FadeInUp from "@/components/fade-in-up";
import SiteHeader from "@/components/site-header";

const safetyNoticeItems = [
  "관객분들의 안전한 공연 관람을 위해 계단 위, 실내 계단 앞에서 서서 관람하는 행위는 삼가해 주시기 바라며, 난간에 기대거나 장내 2층에 서서 관람하시는 행위는 추락 위험이 있으니 삼가해 주시기 바랍니다.",
  "본 건물 1층 출입구 앞 및 1층 주차장 내에서는 금연을 요청드립니다. 흡연이 필요하신 경우, 건물 측면 공간 또는 주차 타워 인근의 쓰레기 수거장 앞을 이용해 주시기 바랍니다.",
];

const parkingNoticeItems = [
  "본 건물 주차는 당일 대관 시간에 한하여 공연팀에 1대만 주차 가능하며, 대관 3일 전까지 차주 연락처와 차량 번호를 남겨 주셔야 가능합니다.",
  "이중 주차 시에는 연락처가 잘 보이게 표시 부탁드립니다.",
  "그 이외의 차량(관객 및 출연자 포함)은 플렉스라운지 맞은편에 위치한 유료 주차장 이용을 권장드립니다.",
];

export default function NoticePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader />

      <main className="relative isolate min-h-screen overflow-hidden pt-16 md:pt-[84px] lg:pt-[102px]">
        <div className="pointer-events-none absolute inset-0 z-0">
          <Image
            src="/concert-poster-latest.png"
            alt="관람 유의사항 배경"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-[#0e132d]/70" />
        </div>

        <section className="relative z-10 mx-auto flex min-h-[calc(100svh-64px)] w-full max-w-[1180px] flex-col px-5 pb-16 pt-12 md:min-h-[calc(100svh-84px)] md:px-8 lg:min-h-[calc(100svh-102px)] lg:px-12">
          <FadeInUp delay={0.04}>
            <h1 className="text-center text-[26px] font-semibold leading-[1.25] md:text-[36px] lg:text-[42px]">
              관람 유의사항
            </h1>
          </FadeInUp>

          <div className="mt-8 flex flex-1 items-center md:mt-10">
            <div className="w-full space-y-6 md:space-y-8">
              <FadeInUp delay={0.1}>
                <article className="overflow-hidden rounded-[18px] border border-white/25 bg-[#0f1223]/28 shadow-[0_18px_44px_rgba(0,0,0,0.3)] backdrop-blur-[6px] transition-all duration-300 hover:-translate-y-1 hover:border-white hover:shadow-[0_20px_36px_rgba(0,0,0,0.36)]">
                  <div className="flex items-center border-b border-white/20 bg-[#0f1223]/36 px-5 py-3 md:px-7 md:py-4">
                    <h2 className="text-[18px] font-semibold md:text-[24px]">
                      관객 안전 안내
                    </h2>
                  </div>
                  <ul className="space-y-4 px-5 py-5 text-[14px] leading-[1.65] text-white/92 md:px-7 md:py-6 md:text-[17px]">
                    {safetyNoticeItems.map((item, index) => (
                      <li key={item} className="flex items-start gap-3">
                        <span className="mt-[2px] inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/12 text-[12px] font-semibold md:h-7 md:w-7 md:text-[13px]">
                          {index + 1}
                        </span>
                        <p>{item}</p>
                      </li>
                    ))}
                  </ul>
                </article>
              </FadeInUp>

              <FadeInUp delay={0.16}>
                <article className="overflow-hidden rounded-[18px] border border-white/25 bg-[#0f1223]/28 shadow-[0_18px_44px_rgba(0,0,0,0.3)] backdrop-blur-[6px] transition-all duration-300 hover:-translate-y-1 hover:border-white hover:shadow-[0_20px_36px_rgba(0,0,0,0.36)]">
                  <div className="flex items-center border-b border-white/20 bg-[#0f1223]/36 px-5 py-3 md:px-7 md:py-4">
                    <h2 className="text-[18px] font-semibold md:text-[24px]">
                      주차 안내
                    </h2>
                  </div>
                  <ul className="space-y-4 px-5 py-5 text-[14px] leading-[1.65] text-white/92 md:px-7 md:py-6 md:text-[17px]">
                    {parkingNoticeItems.map((item, index) => (
                      <li key={item} className="flex items-start gap-3">
                        <span className="mt-[2px] inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/12 text-[12px] font-semibold md:h-7 md:w-7 md:text-[13px]">
                          {index + 1}
                        </span>
                        <p>{item}</p>
                      </li>
                    ))}
                  </ul>
                </article>
              </FadeInUp>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
