"use client";

import FadeInUp from "@/components/fade-in-up";

type ServiceCard = {
  id:
    | "TimeTableCard"
    | "NoticeCard"
    | "ContactUsCard"
    | "Event&MDCard"
    | "TicketInfoCard"
    | "StageInfoCard";
  englishLabel: string;
  koreanLabel: string;
};

type IconProps = {
  className?: string;
};

function StageInfoIcon({ className }: IconProps) {
  return (
    <svg aria-hidden viewBox="4 4 24 24" className={className} fill="currentColor">
      <rect x="6" y="27" width="20" height="2" rx="1" />
      <rect x="8" y="9" width="16" height="18" rx="2" />
      <rect x="10" y="6" width="12" height="3" rx="1" />
      <rect x="11" y="13" width="3" height="3" rx="0.6" fill="rgba(0,0,0,0.3)" />
      <rect x="18" y="13" width="3" height="3" rx="0.6" fill="rgba(0,0,0,0.3)" />
      <rect x="11" y="17" width="3" height="3" rx="0.6" fill="rgba(0,0,0,0.3)" />
      <rect x="18" y="17" width="3" height="3" rx="0.6" fill="rgba(0,0,0,0.3)" />
      <rect x="12" y="21" width="8" height="6" rx="1" fill="rgba(0,0,0,0.3)" />
    </svg>
  );
}

function TimeTableIcon({ className }: IconProps) {
  return (
    <svg aria-hidden viewBox="4 4 24 24" className={className} fill="currentColor">
      <rect x="5" y="7" width="22" height="20" rx="3.5" />
      <rect x="5" y="12" width="22" height="2.5" fill="rgba(0,0,0,0.28)" />
      <rect x="9" y="4.5" width="2.2" height="5" rx="1.1" />
      <rect x="20.8" y="4.5" width="2.2" height="5" rx="1.1" />
      <circle cx="11.5" cy="19" r="1.25" fill="rgba(0,0,0,0.34)" />
      <circle cx="16" cy="19" r="1.25" fill="rgba(0,0,0,0.34)" />
      <circle cx="20.5" cy="19" r="1.25" fill="rgba(0,0,0,0.34)" />
    </svg>
  );
}

function TicketInfoIcon({ className }: IconProps) {
  return (
    <svg aria-hidden viewBox="4 4 24 24" className={className} fill="currentColor">
      <path d="M6 11.5a3 3 0 1 1 0 6V24h20v-6.5a3 3 0 1 1 0-6V8H6v3.5Z" />
      <rect x="15.2" y="10.5" width="1.6" height="2.8" rx="0.8" fill="rgba(0,0,0,0.32)" />
      <rect x="15.2" y="15.2" width="1.6" height="2.8" rx="0.8" fill="rgba(0,0,0,0.32)" />
      <rect x="15.2" y="20" width="1.6" height="2.8" rx="0.8" fill="rgba(0,0,0,0.32)" />
    </svg>
  );
}

function EventMdIcon({ className }: IconProps) {
  return (
    <svg aria-hidden viewBox="4 4 24 24" className={className} fill="currentColor">
      <rect x="6" y="11" width="20" height="15" rx="2.5" />
      <rect x="15" y="11" width="2" height="15" fill="rgba(0,0,0,0.3)" />
      <rect x="6" y="16" width="20" height="2" fill="rgba(0,0,0,0.3)" />
      <rect x="10.8" y="7.2" width="4.2" height="4" rx="2" />
      <rect x="17" y="7.2" width="4.2" height="4" rx="2" />
    </svg>
  );
}

function ContactUsIcon({ className }: IconProps) {
  return (
    <svg aria-hidden viewBox="4 4 24 24" className={className} fill="currentColor">
      <path d="M16 27s8-7.4 8-13a8 8 0 1 0-16 0c0 5.6 8 13 8 13Z" />
      <circle cx="16" cy="14" r="3" fill="rgba(0,0,0,0.33)" />
    </svg>
  );
}

function NoticeIcon({ className }: IconProps) {
  return (
    <svg aria-hidden viewBox="4 4 24 24" className={className} fill="currentColor">
      <path d="M16 5.5 27 25.5H5L16 5.5Z" />
      <rect x="15.15" y="12" width="1.7" height="7.2" rx="0.85" fill="rgba(0,0,0,0.36)" />
      <circle cx="16" cy="22.1" r="1.15" fill="rgba(0,0,0,0.36)" />
    </svg>
  );
}

function renderCardIcon(cardId: ServiceCard["id"]) {
  const iconClassName =
    "h-14 w-14 text-white transition-colors duration-300 group-hover:text-[#3b82f6]";

  switch (cardId) {
    case "StageInfoCard":
      return <StageInfoIcon className={iconClassName} />;
    case "TimeTableCard":
      return <TimeTableIcon className={iconClassName} />;
    case "TicketInfoCard":
      return <TicketInfoIcon className={iconClassName} />;
    case "Event&MDCard":
      return <EventMdIcon className={iconClassName} />;
    case "ContactUsCard":
      return <ContactUsIcon className={iconClassName} />;
    case "NoticeCard":
      return <NoticeIcon className={iconClassName} />;
    default:
      return null;
  }
}

const serviceCards: ServiceCard[] = [
  {
    id: "StageInfoCard",
    englishLabel: "Stage Info",
    koreanLabel: "공연장 안내",
  },
  {
    id: "TimeTableCard",
    englishLabel: "Time Table",
    koreanLabel: "타임 테이블",
  },
  {
    id: "TicketInfoCard",
    englishLabel: "Ticket Info",
    koreanLabel: "티켓 안내",
  },
  {
    id: "Event&MDCard",
    englishLabel: "Event & MD",
    koreanLabel: "이벤트 및 굿즈",
  },
  {
    id: "ContactUsCard",
    englishLabel: "Contact Us",
    koreanLabel: "오시는 길",
  },
  {
    id: "NoticeCard",
    englishLabel: "Notice",
    koreanLabel: "관람 유의사항",
  },
];

export default function FacilityServiceSection() {
  return (
    <section className="px-5 pb-16 pt-10 md:px-6 lg:px-8">
      <FadeInUp delay={0.08} once={false}>
        <h2 className="text-[32px] font-semibold leading-[38px] md:text-[44px] md:leading-[52px]">
          시설 및 서비스
        </h2>
      </FadeInUp>

      <FadeInUp delay={0.16} once={false}>
        <div className="mt-8 grid grid-cols-6 gap-4 md:mt-10 md:gap-5 lg:mt-12 lg:gap-6">
          {serviceCards.map((card) => (
            <article
              key={card.id}
              className="group flex h-[204px] min-w-0 flex-col items-center rounded-[24px] border border-transparent bg-[#161920] px-4 py-[42px] transition-all duration-300 hover:-translate-y-1 hover:border-white hover:shadow-[0_20px_36px_rgba(0,0,0,0.36)]"
            >
              {renderCardIcon(card.id)}

              <div className="mt-8 w-full text-center">
                <p className="text-[13px] font-normal leading-[15.5px] text-white transition-colors duration-300">
                  {card.englishLabel}
                </p>
                <p className="mt-2 text-[19px] font-semibold leading-[22.67px] text-white transition-colors duration-300">
                  {card.koreanLabel}
                </p>
              </div>
            </article>
          ))}
        </div>
      </FadeInUp>
    </section>
  );
}
