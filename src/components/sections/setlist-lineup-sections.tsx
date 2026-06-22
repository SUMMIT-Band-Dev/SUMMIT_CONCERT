"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { memo } from "react";
import FadeInUp from "@/components/common/fade-in-up";
import type { DayType, SetlistCard } from "@/types/setlist";

type SetlistLineupSectionsProps = {
  cards: SetlistCard[]; // SetlistCard 배열
  selectedDay: DayType; // 1 또는 2
  onSelectCard: (card: SetlistCard) => void; // 카드를 인자로 받는 함수
};

// 모바일/데스크톱 카드의 차이는 레이아웃 관련 className과 이미지 sizes 뿐이므로
// variant별 설정값만 따로 모아두고 마크업은 LineupCard에서 공유한다.
type CardVariant = "mobile" | "desktop";

const cardVariantStyles: Record<
  CardVariant,
  {
    button: string;
    frame: string;
    imageSizes: string;
    titleWrapper: string;
    title: string;
  }
> = {
  mobile: {
    button: "group w-[303px] text-left",
    frame:
      "relative h-[378px] w-[303px] overflow-hidden rounded-[18px] border border-white/70 shadow-[0_20px_44px_rgba(0,0,0,0.42)] transition duration-300 group-hover:-translate-y-1 group-hover:border-white group-hover:shadow-[0_26px_58px_rgba(0,0,0,0.5)]",
    imageSizes: "303px",
    titleWrapper: "mt-3 w-full",
    title: "text-center text-[20px] font-semibold leading-[1.2] text-white",
  },
  desktop: {
    button: "group text-left",
    frame:
      "relative aspect-[297/371] w-full overflow-hidden rounded-[18px] border border-white/70 shadow-[0_24px_54px_rgba(0,0,0,0.45)] transition duration-300 group-hover:-translate-y-1 group-hover:border-white group-hover:shadow-[0_30px_64px_rgba(0,0,0,0.56)]",
    imageSizes: "(min-width: 1280px) 297px, (min-width: 768px) 44vw, 303px",
    titleWrapper: "mt-3",
    title:
      "text-center text-[21px] font-semibold leading-[1.2] text-white md:text-[22px]",
  },
};

function DummyPosterArtwork() {
  // 임시 더미 포스터 출력
  return (
    <div className="flex h-full w-full flex-col items-center justify-center rounded-[8px] bg-[#5a5a5a] text-center">
      <div className="h-[24%] w-[24%] rounded-full bg-[#777777]" />
      <p className="mt-4 text-[12px] font-medium text-white/80">임시 포스터</p>
    </div>
  );
}

type LineupCardProps = {
  card: SetlistCard; // 카드 한 장의 데이터
  index: number; // 카드 순번 (#01, #02 ... 표시용)
  selectedDay: DayType; // Day 뱃지에 표시할 일차
  variant: CardVariant; // 모바일/데스크톱 스타일 선택
  onSelect: (card: SetlistCard) => void; // 클릭 시 부모로 전달할 함수
};

// 카드 한 장의 마크업을 담당한다. 모바일/데스크톱 공통 구조를 여기서 단일화하고
// 레이아웃 차이는 variant로 주입받은 className만 바꿔서 처리한다.
function LineupCard({
  card,
  index,
  selectedDay,
  variant,
  onSelect,
}: LineupCardProps) {
  const styles = cardVariantStyles[variant];

  return (
    <button
      type="button"
      onClick={() => onSelect(card)}
      className={styles.button}
    >
      <div className={styles.frame}>
        {card.isPosterDummy ? (
          <DummyPosterArtwork />
        ) : (
          <Image
            src={card.imageSrc}
            alt={`${card.title} cover`}
            fill
            unoptimized
            className="object-cover"
            sizes={styles.imageSizes}
          />
        )}
        <div className="pointer-events-none absolute inset-0 ring-1 ring-white/25" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/45 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/65 via-black/25 to-transparent" />
        <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/70 bg-black/35 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
          Day {selectedDay}
        </div>
        <div className="pointer-events-none absolute bottom-3 right-3 rounded-full border border-white/70 bg-black/35 px-3 py-1 text-[10px] font-semibold tracking-[0.08em] text-white">
          #{String(index + 1).padStart(2, "0")}
        </div>
      </div>
      <div className={styles.titleWrapper}>
        <p className={styles.title}>{card.title}</p>
        <div className="mt-3 h-[2px] w-full bg-gradient-to-r from-transparent via-white/55 to-transparent" />
      </div>
    </button>
  );
}

function SetlistLineupSectionsImpl({
  cards,
  selectedDay,
  onSelectCard,
}: SetlistLineupSectionsProps) {
  return (
    <>
      <FadeInUp delay={0.16} once={false}>
        <div className="mt-8 flex items-center justify-between border-b border-white/20 pb-3">
          <p className="text-[13px] font-semibold uppercase tracking-[0.24em] text-white/70 md:text-[14px]">
            Lineup Introduction
          </p>
          <p className="text-[11px] font-medium text-white/55 md:text-[12px]">
            poster + team profile
          </p>
        </div>
      </FadeInUp>

      <motion.div
        className="mt-8 flex flex-col items-center gap-8 pb-3 md:hidden"
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.2, ease: "easeOut" }}
      >
        {cards.map((card, index) => (
          <LineupCard
            key={card.id}
            card={card}
            index={index}
            selectedDay={selectedDay}
            variant="mobile"
            onSelect={onSelectCard}
          />
        ))}
      </motion.div>

      <FadeInUp delay={0.24} once={false}>
        <div className="mt-10 hidden gap-x-8 gap-y-10 md:grid md:grid-cols-2 lg:grid-cols-4">
          {cards.map((card, index) => (
            <LineupCard
              key={card.id}
              card={card}
              index={index}
              selectedDay={selectedDay}
              variant="desktop"
              onSelect={onSelectCard}
            />
          ))}
        </div>
      </FadeInUp>
    </>
  );
}

const SetlistLineupSections = memo(SetlistLineupSectionsImpl);

export default SetlistLineupSections;
