import Image from "next/image";
import FadeInUp from "@/components/common/fade-in-up";
import SiteHeader from "@/components/layout/site-header";

export default function TicketInfoPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader />

      <main className="relative isolate min-h-screen overflow-hidden pt-16 md:pt-[84px] lg:pt-[102px]">
        <div className="pointer-events-none absolute inset-0 z-0">
          <Image
            src="/concert-poster-latest.png"
            alt="티켓 안내 배경"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-[#0a0d1f]/74" />
        </div>

        <section className="relative z-10 mx-auto w-full max-w-[1220px] px-5 pb-16 pt-12 md:px-8 lg:px-12">
          <FadeInUp delay={0.04}>
            <h1 className="text-center text-[24px] font-semibold leading-[1.24] md:text-[34px] lg:text-[40px]">
              티켓 안내
            </h1>
          </FadeInUp>

          <div className="mt-8 grid grid-cols-1 gap-6 md:mt-10 md:grid-cols-2 md:items-stretch md:gap-8">
            <FadeInUp delay={0.14}>
              <article className="group overflow-hidden rounded-[18px] border border-white/25 bg-[#0f1223]/28 shadow-[0_18px_44px_rgba(0,0,0,0.3)] backdrop-blur-[6px] transition-all duration-300 hover:-translate-y-1 hover:border-white hover:shadow-[0_20px_36px_rgba(0,0,0,0.36)]">
                <div className="grid grid-cols-2 gap-4 px-5 pb-6 pt-6 md:gap-5 md:px-7 md:pb-7 md:pt-8">
                  <div className="overflow-hidden rounded-[14px] border border-white/25 shadow-[0_16px_24px_rgba(0,0,0,0.32)]">
                    <Image
                      src="/ticket-front.png"
                      alt="티켓 앞면"
                      width={420}
                      height={760}
                      sizes="(max-width: 768px) 45vw, 22vw"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="overflow-hidden rounded-[14px] border border-white/25 shadow-[0_16px_24px_rgba(0,0,0,0.32)]">
                    <Image
                      src="/ticket-back.png"
                      alt="티켓 뒷면"
                      width={420}
                      height={760}
                      sizes="(max-width: 768px) 45vw, 22vw"
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
                <div className="border-t border-white/20 px-5 pb-6 pt-4 md:px-7 md:pb-7">
                  <h2 className="text-[16px] font-semibold md:text-[20px]">티켓 앞면 / 뒷면</h2>
                  <p className="mt-1.5 text-[12px] leading-[1.6] text-white/60 md:text-[13px]">여름 정기공연 공연자에게 배부되는 티켓 굿즈입니다.</p>
                </div>
              </article>
            </FadeInUp>

            <FadeInUp delay={0.18}>
              <article className="group flex h-full flex-col overflow-hidden rounded-[18px] border border-white/25 bg-[#0f1223]/28 p-5 shadow-[0_18px_44px_rgba(0,0,0,0.3)] backdrop-blur-[6px] transition-all duration-300 hover:-translate-y-1 hover:border-white hover:shadow-[0_20px_36px_rgba(0,0,0,0.36)] md:p-7">
                <h2 className="text-[18px] font-semibold md:text-[24px]">요금 안내</h2>
                <div className="mt-5 flex flex-1 flex-col space-y-6">
                  <section>
                    <h3 className="text-[15px] font-semibold text-[#ffe8b5] md:text-[18px]">입장 요금 안내</h3>
                    <ul className="mt-3 space-y-2 text-[13px] leading-[1.65] text-white/90 md:text-[15px]">
                      <li className="pl-4 -indent-4">- 사전 예매: 5,000원</li>
                      <li className="pl-4 -indent-4">- 현장 예매: 6,000원</li>
                    </ul>
                  </section>
                  <section>
                    <h3 className="text-[15px] font-semibold text-[#ffe8b5] md:text-[18px]">여분 티켓 안내</h3>
                    <ul className="mt-3 space-y-2 text-[13px] leading-[1.65] text-white/90 md:text-[15px]">
                      <li className="flex gap-1.5"><span className="shrink-0">-</span><span>현장 상황에 따라 여분의 티켓이 무료로 배부될 수 있습니다.</span></li>
                      <li className="flex gap-1.5"><span className="shrink-0">-</span><span>여분 티켓은 선착순으로 제공되며, 수량 소진 시 배부가 조기 마감됩니다.</span></li>
                    </ul>
                  </section>
                  <section className="mt-auto border-t border-white/20 pt-6">
                    <h3 className="text-[15px] font-semibold text-[#ffe8b5] md:text-[18px]">공연 기본 정보</h3>
                    <dl className="mt-4 space-y-4 text-[13px] leading-[1.65] md:text-[15px]">
                      <div>
                        <dt className="font-semibold text-white/70">공연명</dt>
                        <dd className="mt-1 text-white/92">2026 SUMMIT Summer Festival</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-white/70">일시</dt>
                        <dd className="mt-1 text-white/92">2026.06.25 ~ 06.26 / 18:00 ~ 21:00</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-white/70">장소</dt>
                        <dd className="mt-1 text-white/92">플렉스 라운지</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-white/70">부제</dt>
                        <dd className="mt-1 text-white/92">황혼에 물드는 우리의 여름</dd>
                      </div>
                    </dl>
                  </section>
                </div>
              </article>
            </FadeInUp>
          </div>
        </section>
      </main>
    </div>
  );
}
