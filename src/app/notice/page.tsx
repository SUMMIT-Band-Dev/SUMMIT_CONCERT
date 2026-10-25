import { getConcert, getInfoSections } from "@/lib/concert-content";
import Image from "next/image";
import FadeInUp from "@/components/common/fade-in-up";
import SiteHeader from "@/components/layout/site-header";

export default async function NoticePage() {
  const [concert, sections] = await Promise.all([getConcert(), getInfoSections("notice")]);
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader />

      <main className="relative isolate min-h-screen overflow-hidden pt-16 md:pt-21 lg:pt-25.5">
        <div className="pointer-events-none absolute inset-0 z-0">
          {concert.posterImageUrl ? (
            <Image
              src={concert.posterImageUrl}
              alt="관람 유의사항 배경"
              fill
              priority
              sizes="100vw"
              className="object-cover object-center"
            />
          ) : null}
          <div className="absolute inset-0 bg-[#0e132d]/70" />
        </div>

        <section className="relative z-10 mx-auto flex min-h-[calc(100svh-64px)] w-full max-w-295 flex-col px-5 pb-16 pt-12 md:min-h-[calc(100svh-84px)] md:px-8 lg:min-h-[calc(100svh-102px)] lg:px-12">
          <FadeInUp delay={0.04}>
            <h1 className="text-center text-[26px] font-semibold leading-[1.25] md:text-[36px] lg:text-[42px]">
              관람 유의사항
            </h1>
          </FadeInUp>

          <div className="mt-8 flex flex-1 items-center md:mt-10">
            <div className="w-full space-y-6 md:space-y-8">
              {sections.map((section, index) => (
                <FadeInUp key={`${index}-${section.title}`} delay={0.1 + index * 0.06}>
                  <article className="overflow-hidden rounded-[18px] border border-white/25 bg-[#0f1223]/28 shadow-[0_18px_44px_rgba(0,0,0,0.3)] backdrop-blur-[6px] transition-all duration-300 hover:-translate-y-1 hover:border-white hover:shadow-[0_20px_36px_rgba(0,0,0,0.36)]">
                    <div className="flex items-center border-b border-white/20 bg-[#0f1223]/36 px-5 py-3 md:px-7 md:py-4">
                      <h2 className="text-[18px] font-semibold md:text-[24px]">
                        {section.title}
                      </h2>
                    </div>
                    <ul className="space-y-4 px-5 py-5 text-[14px] leading-[1.65] text-white/92 md:px-7 md:py-6 md:text-[17px]">
                      {section.items.map((item, itemIndex) => (
                        <li key={itemIndex} className="flex items-start gap-3">
                          <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/12 text-[12px] font-semibold md:h-7 md:w-7 md:text-[13px]">
                            {itemIndex + 1}
                          </span>
                          <p>{item}</p>
                        </li>
                      ))}
                    </ul>
                  </article>
                </FadeInUp>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
