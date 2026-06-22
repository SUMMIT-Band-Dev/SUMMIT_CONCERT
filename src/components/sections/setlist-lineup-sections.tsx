"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { memo } from "react";
import FadeInUp from "@/components/common/fade-in-up";

type DayType = 1 | 2; // 1일차 or 2일차

type SetlistCard = {
  id: number; // id
  day: DayType; // 날짜
  title: string; // 제목
  artist: string; // 아티스트
  imageSrc: string; // 이미지
  isPosterDummy: boolean; // 더미 이미지
};

type SetlistLineupSectionsProps = {
  cards: SetlistCard[]; // SetlistCard 배열
  selectedDay: DayType; // 1 또는 2
  onSelectCard: (card: SetlistCard) => void; // 카드를 인자로 받는 함수
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
        {cards.map(
          (
            card,
            index, // 카드 데이터 배열
          ) => (
            <button
              key={card.id}
              type="button"
              onClick={() => onSelectCard(card)}
              className="group w-[303px] text-left"
            >
              <div className="relative h-[378px] w-[303px] overflow-hidden rounded-[18px] border border-white/70 shadow-[0_20px_44px_rgba(0,0,0,0.42)] transition duration-300 group-hover:-translate-y-1 group-hover:border-white group-hover:shadow-[0_26px_58px_rgba(0,0,0,0.5)]">
                {card.isPosterDummy ? (
                  <DummyPosterArtwork />
                ) : (
                  <Image
                    src={card.imageSrc}
                    alt={`${card.title} cover`}
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="303px"
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
              <div className="mt-3 w-full">
                <p className="text-center text-[20px] font-semibold leading-[1.2] text-white">
                  {card.title}
                </p>
                <div className="mt-3 h-[2px] w-full bg-gradient-to-r from-transparent via-white/55 to-transparent" />
              </div>
            </button>
          ),
        )}
      </motion.div>

      <FadeInUp delay={0.24} once={false}>
        <div className="mt-10 hidden gap-x-8 gap-y-10 md:grid md:grid-cols-2 lg:grid-cols-4">
          {cards.map((card, index) => (
            <button
              key={card.id}
              type="button"
              onClick={() => onSelectCard(card)}
              className="group text-left"
            >
              <div className="relative aspect-[297/371] w-full overflow-hidden rounded-[18px] border border-white/70 shadow-[0_24px_54px_rgba(0,0,0,0.45)] transition duration-300 group-hover:-translate-y-1 group-hover:border-white group-hover:shadow-[0_30px_64px_rgba(0,0,0,0.56)]">
                {card.isPosterDummy ? (
                  <DummyPosterArtwork />
                ) : (
                  <Image
                    src={card.imageSrc}
                    alt={`${card.title} cover`}
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="(min-width: 1280px) 297px, (min-width: 768px) 44vw, 303px"
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
              <div className="mt-3">
                <p className="text-center text-[21px] font-semibold leading-[1.2] text-white md:text-[22px]">
                  {card.title}
                </p>
                <div className="mt-3 h-[2px] w-full bg-gradient-to-r from-transparent via-white/55 to-transparent" />
              </div>
            </button>
          ))}
        </div>
      </FadeInUp>
    </>
  );
}

const SetlistLineupSections = memo(SetlistLineupSectionsImpl);

export default SetlistLineupSections;
