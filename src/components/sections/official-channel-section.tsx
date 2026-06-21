import FadeInUp from "@/components/common/fade-in-up";

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
    <svg
      aria-hidden
      viewBox="0 0 32 32"
      className="h-[50px] w-[50px] text-white transition-colors duration-300 group-hover:text-[#3b82f6] md:h-[58px] md:w-[58px]"
      fill="none"
    >
      <rect x="4" y="4" width="24" height="24" rx="7" stroke="currentColor" strokeWidth="2.6" />
      <circle cx="16" cy="16" r="5.5" stroke="currentColor" strokeWidth="2.6" />
      <circle cx="23.1" cy="8.9" r="1.7" fill="currentColor" />
    </svg>
  );
}

function YoutubeIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 32 32"
      className="h-[50px] w-[50px] text-white transition-colors duration-300 group-hover:text-[#3b82f6] md:h-[58px] md:w-[58px]"
      fill="none"
    >
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
    <section id="official-channel-section" className="relative">
      <div className="pointer-events-none absolute inset-0 bg-black/18 md:hidden" />
      <div className="relative z-10">
        <FadeInUp delay={0.06}>
          <h2 className="text-[32px] font-semibold leading-[38px] md:text-[44px] md:leading-[52px]">
            Official Channels
          </h2>
        </FadeInUp>

        <FadeInUp delay={0.14} y={20}>
          <div className="mt-6 grid grid-cols-1 gap-5 md:mt-8 md:grid-cols-2 md:gap-6 lg:mt-10 lg:gap-8">
            {channelCards.map((card) => (
              <a
                key={card.id}
                href={card.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex min-h-[148px] flex-col justify-center gap-2 rounded-[24px] border border-white/12 bg-[#131929]/95 px-6 py-5 transition-all duration-300 md:min-h-[228px] md:gap-3 md:px-8 md:py-6 md:hover:-translate-y-1 md:hover:border-white/65 md:hover:shadow-[0_20px_36px_rgba(0,0,0,0.36)]"
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
            ))}
          </div>
        </FadeInUp>
      </div>
    </section>
  );
}
