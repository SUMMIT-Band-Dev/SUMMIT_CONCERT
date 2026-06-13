"use client";

import FadeInUp from "@/components/fade-in-up";

type ChannelCard = {
  id: "instagram" | "youtube";
  label: string;
  description: string;
  href: string;
};

const channelCards: ChannelCard[] = [
  {
    id: "instagram",
    label: "@summit_ssu 방문하기",
    description: "SUMMIT의 인스타그램에 방문해보세요.",
    href: "https://www.instagram.com/summit_ssu/",
  },
  {
    id: "youtube",
    label: "써밋 유튜브 방문하기",
    description: "SUMMIT의 유튜브에 방문해보세요.",
    href: "https://www.youtube.com/@summitband4978",
  },
];

function InstagramIcon() {
  return (
    <svg aria-hidden viewBox="0 0 32 32" className="h-[54px] w-[54px] text-white md:h-[58px] md:w-[58px]" fill="none">
      <rect x="4" y="4" width="24" height="24" rx="7" stroke="currentColor" strokeWidth="2.6" />
      <circle cx="16" cy="16" r="5.5" stroke="currentColor" strokeWidth="2.6" />
      <circle cx="23.1" cy="8.9" r="1.7" fill="currentColor" />
    </svg>
  );
}

function YoutubeIcon() {
  return (
    <svg aria-hidden viewBox="0 0 32 32" className="h-[54px] w-[54px] text-white md:h-[58px] md:w-[58px]" fill="none">
      <rect x="3.5" y="7" width="25" height="18" rx="6" fill="currentColor" />
      <path d="M14 12.6 21 16l-7 3.4v-6.8Z" fill="black" />
    </svg>
  );
}

function renderChannelIcon(id: ChannelCard["id"]) {
  return id === "instagram" ? <InstagramIcon /> : <YoutubeIcon />;
}

export default function OfficialChannelSection() {
  return (
    <>
      <FadeInUp delay={0.06}>
        <h2 className="text-[32px] font-semibold leading-[38px] md:text-[44px] md:leading-[52px]">
          Official Channels
        </h2>
      </FadeInUp>

      <div className="mt-6 grid grid-cols-1 gap-5 md:mt-8 md:grid-cols-2 md:gap-6 lg:mt-10 lg:gap-8">
        {channelCards.map((card, index) => (
          <FadeInUp key={card.id} delay={0.1 + index * 0.07} y={20}>
            <a
              href={card.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex min-h-[148px] flex-col justify-center gap-2 rounded-[24px] border border-transparent bg-[#161920] px-6 py-5 shadow-[0_20px_38px_rgba(0,0,0,0.34)] transition-all duration-300 hover:-translate-y-1 hover:border-white/30 md:min-h-[228px] md:gap-3 md:px-8 md:py-6"
            >
              <div>{renderChannelIcon(card.id)}</div>
              <div>
                <p className="whitespace-nowrap text-[clamp(10px,2.6vw,13px)] font-normal leading-[1.2] text-white/82">
                  {card.label}
                </p>
                <p className="mt-2 whitespace-nowrap text-[clamp(13px,3.4vw,19px)] font-semibold leading-[1.2] text-white md:mt-3">
                  {card.description}
                </p>
              </div>
            </a>
          </FadeInUp>
        ))}
      </div>
    </>
  );
}
