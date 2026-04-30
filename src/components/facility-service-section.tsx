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
    <svg
      aria-hidden
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 27h22" />
      <path d="M8.5 27V9.5h15V27" />
      <path d="M11.5 27v-6h9v6" />
      <path d="M11.5 13h2.5" />
      <path d="M18 13h2.5" />
      <path d="M11.5 17h2.5" />
      <path d="M18 17h2.5" />
      <path d="M10 9.5V6h12v3.5" />
    </svg>
  );
}

function TimeTableIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5.5" y="7.5" width="21" height="19" rx="3.5" />
      <path d="M10 5.5v4" />
      <path d="M22 5.5v4" />
      <path d="M5.5 12.5h21" />
      <circle cx="11.5" cy="18" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="18" r="1" fill="currentColor" stroke="none" />
      <circle cx="20.5" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TicketInfoIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 11.5a3 3 0 1 1 0 6V24h20v-6.5a3 3 0 1 1 0-6V8H6v3.5Z" />
      <path d="M16 10.5v2.5" />
      <path d="M16 15.5v2.5" />
      <path d="M16 20.5v2.5" />
    </svg>
  );
}

function EventMdIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="6" y="11" width="20" height="15" rx="2.5" />
      <path d="M16 11v15" />
      <path d="M6 16.5h20" />
      <path d="M11.5 11v-2a2 2 0 1 1 4 0v2" />
      <path d="M16.5 11v-2a2 2 0 1 1 4 0v2" />
    </svg>
  );
}

function ContactUsIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 27s8-7.4 8-13a8 8 0 1 0-16 0c0 5.6 8 13 8 13Z" />
      <circle cx="16" cy="14" r="3" />
    </svg>
  );
}

function NoticeIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 5.5 27 25.5H5L16 5.5Z" />
      <path d="M16 12v7" />
      <circle cx="16" cy="22.2" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function renderCardIcon(cardId: ServiceCard["id"]) {
  const iconClassName = "h-8 w-8 text-white transition-colors duration-300 group-hover:text-[#10131a]";

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
        <h2 className="text-[32px] font-semibold leading-[38px] md:text-[36px] md:leading-[43px]">
          시설 및 서비스
        </h2>
      </FadeInUp>

      <FadeInUp delay={0.16} once={false}>
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-3 lg:gap-10">
          {serviceCards.map((card) => (
            <article
              key={card.id}
              className="group flex h-[149px] flex-col items-center rounded-[24px] border border-transparent bg-[#161920] px-4 py-[29px] transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white hover:shadow-[0_20px_36px_rgba(0,0,0,0.36)]"
            >
              {renderCardIcon(card.id)}

              <div className="mt-4 w-full text-center">
                <p className="text-xs font-normal leading-[14.32px] text-white transition-colors duration-300 group-hover:text-[#5b6475]">
                  {card.englishLabel}
                </p>
                <p className="mt-2 text-[18px] font-semibold leading-[21.48px] text-white transition-colors duration-300 group-hover:text-[#10131a]">
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
