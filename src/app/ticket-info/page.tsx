import { getConcert, getVenue, getTicket, getInfoSections } from "@/lib/concert-content";
import { formatTicketDateRange } from "@/lib/concert-content-format";
import Image from "next/image";
import FadeInUp from "@/components/common/fade-in-up";
import SiteHeader from "@/components/layout/site-header";

export default async function TicketInfoPage() {
  const [concert, venue, ticket, sections] = await Promise.all([getConcert(), getVenue(), getTicket(), getInfoSections("ticket")]);
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader />

      <main className="relative isolate min-h-screen overflow-hidden pt-16 md:pt-21 lg:pt-25.5">
        <div className="pointer-events-none absolute inset-0 z-0">
          {concert.posterImageUrl ? (
            <Image
              src={concert.posterImageUrl}
              alt="티켓 안내 배경"
              fill
              priority
              sizes="100vw"
              className="object-cover object-center"
            />
          ) : null}
          <div className="absolute inset-0 bg-[#0a0d1f]/74" />
        </div>

        <section className="relative z-10 mx-auto w-full max-w-305 px-5 pb-16 pt-12 md:px-8 lg:px-12">
          <FadeInUp delay={0.04}>
            <h1 className="text-center text-[24px] font-semibold leading-[1.24] md:text-[34px] lg:text-[40px]">
              티켓 안내
            </h1>
          </FadeInUp>

          <div className="mt-8 grid grid-cols-1 gap-6 md:mt-10 md:grid-cols-2 md:items-stretch md:gap-8">
            <FadeInUp delay={0.14}>
              <article className="group overflow-hidden rounded-[18px] border border-white/25 bg-[#0f1223]/28 shadow-[0_18px_44px_rgba(0,0,0,0.3)] backdrop-blur-[6px] transition-all duration-300 hover:-translate-y-1 hover:border-white hover:shadow-[0_20px_36px_rgba(0,0,0,0.36)]">
                {ticket.frontImageUrl || ticket.backImageUrl ? (
                  <div className="grid grid-cols-2 gap-4 px-5 pb-6 pt-6 md:gap-5 md:px-7 md:pb-7 md:pt-8">
                    {ticket.frontImageUrl ? (
                      <div className="overflow-hidden rounded-[14px] border border-white/25 shadow-[0_16px_24px_rgba(0,0,0,0.32)]">
                        <Image
                          src={ticket.frontImageUrl}
                          alt="티켓 앞면"
                          width={420}
                          height={760}
                          sizes="(max-width: 768px) 45vw, 22vw"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : null}
                    {ticket.backImageUrl ? (
                      <div className="overflow-hidden rounded-[14px] border border-white/25 shadow-[0_16px_24px_rgba(0,0,0,0.32)]">
                        <Image
                          src={ticket.backImageUrl}
                          alt="티켓 뒷면"
                          width={420}
                          height={760}
                          sizes="(max-width: 768px) 45vw, 22vw"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="border-t border-white/20 px-5 pb-6 pt-4 md:px-7 md:pb-7">
                  <h2 className="text-[16px] font-semibold md:text-[20px]">티켓 앞면 / 뒷면</h2>
                  {ticket.description ? <p className="mt-1.5 whitespace-pre-line text-[12px] leading-[1.6] text-white/60 md:text-[13px]">{ticket.description}</p> : null}
                </div>
              </article>
            </FadeInUp>

            <FadeInUp delay={0.18}>
              <article className="group flex h-full flex-col overflow-hidden rounded-[18px] border border-white/25 bg-[#0f1223]/28 p-5 shadow-[0_18px_44px_rgba(0,0,0,0.3)] backdrop-blur-[6px] transition-all duration-300 hover:-translate-y-1 hover:border-white hover:shadow-[0_20px_36px_rgba(0,0,0,0.36)] md:p-7">
                <h2 className="text-[18px] font-semibold md:text-[24px]">요금 안내</h2>
                <div className="mt-5 flex flex-1 flex-col space-y-6">
                  {sections.map((section, index) => (
                    <section key={`${index}-${section.title}`}>
                      <h3 className="text-[15px] font-semibold text-[#ffe8b5] md:text-[18px]">{section.title}</h3>
                      <ul className="mt-3 space-y-2 text-[13px] leading-[1.65] text-white/90 md:text-[15px]">
                        {section.items.map((item, itemIndex) => (
                          <li key={itemIndex} className="flex gap-1.5"><span className="shrink-0">-</span><span>{item}</span></li>
                        ))}
                      </ul>
                    </section>
                  ))}
                  <section className="mt-auto border-t border-white/20 pt-6">
                    <h3 className="text-[15px] font-semibold text-[#ffe8b5] md:text-[18px]">공연 기본 정보</h3>
                    <dl className="mt-4 space-y-4 text-[13px] leading-[1.65] md:text-[15px]">
                      <div>
                        <dt className="font-semibold text-white/70">공연명</dt>
                        <dd className="mt-1 text-white/92">{concert.titleEn}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-white/70">일시</dt>
                        <dd className="mt-1 text-white/92">{formatTicketDateRange(concert.startDate, concert.endDate, concert.showTime)}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-white/70">장소</dt>
                        <dd className="mt-1 text-white/92">{venue.name}</dd>
                      </div>
                      {concert.subtitle ? (
                        <div>
                          <dt className="font-semibold text-white/70">부제</dt>
                          <dd className="mt-1 text-white/92">{concert.subtitle}</dd>
                        </div>
                      ) : null}
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
