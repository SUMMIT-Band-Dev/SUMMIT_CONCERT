import Image from "next/image";
import FadeInUp from "@/components/fade-in-up";
import SiteHeader from "@/components/site-header";

type BookDayCard = {
  id: string;
  dayLabel: string;
  dateLabel: string;
  artists: string[];
  href: string;
};

const bookDayCards: BookDayCard[] = [
  {
    id: "day1",
    dayLabel: "Day 1",
    dateLabel: "6.25 (목) 18:00",
    artists: [
      "8c8, 뉴비, 즐겜굴비,",
      "써밋 음악도둑, 26살과 26학번,",
      "하로로는노는게제일좋아, 숙취의 미학",
    ],
    href: "https://forms.gle/btyQmp4VH7PyiHav8",
  },
  {
    id: "day2",
    dayLabel: "Day 2",
    dateLabel: "6.26 (금) 18:00",
    artists: [
      "오미자, 낭만치사량, 쉬었음밴드,",
      "머리위 쥑쥑이, 컴학늙크크와 공주들,",
      "모스붕어, 도레미파솔라석희, 자연발생",
    ],
    href: "https://forms.gle/bZJJyJShKztjg72z8",
  },
];

export default function BookPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader />

      <main className="relative min-h-screen overflow-hidden pt-16 md:pt-[84px] lg:pt-[102px]">
        <div className="pointer-events-none absolute inset-0 z-0">
          <Image
            src="/concert-poster-latest.png"
            alt="예매 페이지 배경"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-90"
          />
          <div className="absolute inset-0 bg-[#090b1f]/55" />
          <div className="absolute inset-x-0 bottom-0 h-[48vh] bg-gradient-to-b from-transparent via-black/60 to-black/85" />
        </div>

        <section className="relative z-10 mx-auto flex min-h-[calc(100svh-64px)] w-full max-w-[1440px] items-center justify-center px-5 pb-12 pt-8 text-center md:min-h-[calc(100svh-84px)] md:px-8 md:pb-14 md:pt-10 lg:min-h-[calc(100svh-102px)] lg:px-[72px] lg:pb-16 lg:pt-12">
          <div className="relative -top-1 w-full md:-top-1.5">
            <FadeInUp delay={0.04} y={18}>
              <h1 className="text-[22px] font-semibold leading-[28px] md:text-[30px] md:leading-[38px] lg:text-[34px] lg:leading-[42px]">
                관람하실 공연 날짜를 선택해 주세요.
              </h1>
            </FadeInUp>

            <div className="mt-10 grid w-full max-w-[900px] grid-cols-1 gap-5 md:mx-auto md:mt-12 md:grid-cols-2 md:gap-8 lg:mt-14">
              {bookDayCards.map((card, index) => (
                <FadeInUp key={card.id} delay={0.1 + index * 0.08} y={20} className="w-full">
                  <article className="mx-auto flex w-full max-w-[360px] flex-col items-center rounded-[18px] border border-white/25 bg-[#0f1223]/28 px-6 pb-6 pt-7 shadow-[0_18px_44px_rgba(0,0,0,0.3)] backdrop-blur-[6px] md:min-h-[320px] md:max-w-none md:px-8 md:pb-8 md:pt-8">
                    <h2 className="text-[34px] font-semibold leading-none md:text-[40px]">
                      {card.dayLabel}
                    </h2>
                    <p className="mt-4 text-[20px] font-semibold leading-[24px] md:mt-5 md:text-[24px] md:leading-[29px]">
                      {card.dateLabel}
                    </p>

                    <div className="mt-5 space-y-1 text-[13px] font-medium leading-[18px] text-white/88 md:mt-6 md:text-[14px] md:leading-[20px]">
                      {card.artists.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>

                    <a
                      href={card.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-7 inline-flex h-[52px] w-[216px] items-center justify-center rounded-[14px] bg-black/45 text-[20px] font-semibold leading-none text-white transition-colors duration-200 hover:bg-[#2b315f]/90 active:bg-[#3a427f] md:mt-8 md:h-[58px] md:w-[236px] md:text-[22px]"
                    >
                      사전 예매하기
                    </a>
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
