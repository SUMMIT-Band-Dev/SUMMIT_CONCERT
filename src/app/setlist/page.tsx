"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import FadeInUp from "@/components/fade-in-up";
import SiteHeader from "@/components/site-header";

type DayType = 1 | 2;

type SetlistCard = {
  id: number;
  day: DayType;
  title: string;
  artist: string;
  imageSrc: string;
};

type TrackItem = {
  id: number;
  title: string;
  artist: string;
  coverShape: "square" | "image";
  coverSrc?: string;
};

const setlistCards: SetlistCard[] = [
  { id: 1, day: 1, title: "Twilight", artist: "SUMMIT SUMMER CONCERT", imageSrc: "/setlist-cover-temp.png" },
  { id: 2, day: 1, title: "Sunset Sky", artist: "SUMMIT SUMMER CONCERT", imageSrc: "/setlist-cover-temp.png" },
  { id: 3, day: 1, title: "Dreaming", artist: "SUMMIT SUMMER CONCERT", imageSrc: "/setlist-cover-temp.png" },
  { id: 4, day: 1, title: "Blue Hour", artist: "SUMMIT SUMMER CONCERT", imageSrc: "/setlist-cover-temp.png" },
  { id: 5, day: 2, title: "Night Drive", artist: "SUMMIT SUMMER CONCERT", imageSrc: "/setlist-cover-temp.png" },
  { id: 6, day: 2, title: "Moonlight", artist: "SUMMIT SUMMER CONCERT", imageSrc: "/setlist-cover-temp.png" },
  { id: 7, day: 2, title: "Afterglow", artist: "SUMMIT SUMMER CONCERT", imageSrc: "/setlist-cover-temp.png" },
  { id: 8, day: 2, title: "Last Song", artist: "SUMMIT SUMMER CONCERT", imageSrc: "/setlist-cover-temp.png" },
];

const trackListByDay: Record<DayType, TrackItem[]> = {
  1: [
    { id: 101, title: "Twilight", artist: "SUMMIT Band", coverShape: "square" },
    { id: 102, title: "Sunset Sky", artist: "SUMMIT Band", coverShape: "square" },
    { id: 103, title: "Dreaming", artist: "SUMMIT Band", coverShape: "square" },
    { id: 104, title: "Blue Hour", artist: "SUMMIT Band", coverShape: "square" },
    { id: 105, title: "After Party", artist: "SUMMIT Band", coverShape: "square" },
    { id: 106, title: "Encore", artist: "SUMMIT Band", coverShape: "square" },
  ],
  2: [
    { id: 201, title: "Night Drive", artist: "SUMMIT Band", coverShape: "square" },
    { id: 202, title: "Moonlight", artist: "SUMMIT Band", coverShape: "square" },
    { id: 203, title: "Afterglow", artist: "SUMMIT Band", coverShape: "square" },
    { id: 204, title: "Last Song", artist: "SUMMIT Band", coverShape: "square" },
    { id: 205, title: "Midnight", artist: "SUMMIT Band", coverShape: "square" },
    { id: 206, title: "Finale", artist: "SUMMIT Band", coverShape: "square" },
  ],
};

function SquareGrayArtwork() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-[8px] bg-[#d9d9d9]">
      <div className="h-[34%] w-[34%] rounded-full bg-[#bcbcbc]" />
    </div>
  );
}

export default function SetlistPage() {
  const [selectedDay, setSelectedDay] = useState<DayType>(1);
  const [selectedCard, setSelectedCard] = useState<SetlistCard | null>(null);

  const cards = useMemo(
    () => setlistCards.filter((card) => card.day === selectedDay),
    [selectedDay],
  );
  const trackItems = trackListByDay[selectedDay];

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader />

      <main className="relative pt-16 md:pt-[84px] lg:pt-[102px]">
        <div className="pointer-events-none absolute inset-0 z-0">
          <Image
            src="/concert-poster-latest.png"
            alt="셋리스트 배경"
            fill
            priority
            sizes="100vw"
            className="object-cover object-top opacity-80"
          />
          <div className="absolute inset-0 bg-black/70" />
          <div className="absolute inset-x-0 bottom-0 h-[40vh] bg-gradient-to-b from-transparent to-black" />
        </div>

        <section className="relative z-10 mx-auto w-full max-w-[1440px] px-5 pb-20 pt-10 md:px-8 md:pb-24 md:pt-16 lg:px-[72px] lg:pt-24">
          <FadeInUp delay={0.04}>
            <h1 className="text-[28px] font-semibold leading-[33.4px] md:text-[32px] md:leading-[38px] lg:text-[36px] lg:leading-[42.96px]">
              Setlist
            </h1>
          </FadeInUp>

          <FadeInUp delay={0.1}>
            <div className="mt-4 flex items-center gap-5 md:mt-6 md:gap-8">
              <button
                type="button"
                onClick={() => setSelectedDay(1)}
                className={`text-[20px] font-semibold leading-[23.87px] transition-colors md:text-[24px] md:leading-[28.64px] lg:text-[28px] lg:leading-[33.41px] ${
                  selectedDay === 1 ? "text-white" : "text-[#ababab]"
                }`}
              >
                1일차 공연
              </button>
              <button
                type="button"
                onClick={() => setSelectedDay(2)}
                className={`text-[20px] font-semibold leading-[23.87px] transition-colors md:text-[24px] md:leading-[28.64px] lg:text-[28px] lg:leading-[33.41px] ${
                  selectedDay === 2 ? "text-white" : "text-[#ababab]"
                }`}
              >
                2일차 공연
              </button>
            </div>
          </FadeInUp>

          <FadeInUp delay={0.16} once={false}>
            <div className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 md:hidden">
              {cards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setSelectedCard(card)}
                  className="shrink-0 snap-center overflow-hidden rounded-[8px] border border-white/15 bg-white/5 text-left"
                >
                  <div className="relative h-[378px] w-[303px]">
                    <Image
                      src={card.imageSrc}
                      alt={`${card.title} cover`}
                      fill
                      className="object-cover"
                      sizes="303px"
                    />
                  </div>
                </button>
              ))}
            </div>
          </FadeInUp>

          <FadeInUp delay={0.2} once={false}>
            <div className="mt-10 hidden gap-x-8 gap-y-10 md:grid md:grid-cols-2 lg:grid-cols-4">
              {cards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setSelectedCard(card)}
                  className="overflow-hidden rounded-[8px] border border-white/15 bg-white/5 text-left transition-transform hover:-translate-y-1"
                >
                  <div className="relative aspect-[297/371] w-full">
                    <Image
                      src={card.imageSrc}
                      alt={`${card.title} cover`}
                      fill
                      className="object-cover"
                      sizes="(min-width: 1280px) 297px, (min-width: 768px) 44vw, 303px"
                    />
                  </div>
                </button>
              ))}
            </div>
          </FadeInUp>
        </section>
      </main>

      <AnimatePresence>
        {selectedCard ? (
          <motion.div
            className="fixed inset-0 z-[90]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-[1px]" />
            <div className="relative flex h-full w-full items-start justify-center px-4 pt-[176px] md:items-center md:p-8">
              <motion.div
                className="max-h-[calc(100svh-188px)] w-[min(360px,92vw)] overflow-y-auto rounded-t-2xl bg-black/70 md:hidden"
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                transition={{ type: "spring", stiffness: 150, damping: 22 }}
              >
                <div className="px-6 pt-8">
                  <div className="relative mx-auto h-[378px] w-[303px] overflow-hidden rounded-[8px]">
                    <Image
                      src={selectedCard.imageSrc}
                      alt={`${selectedCard.title} cover`}
                      fill
                      className="object-cover"
                      sizes="303px"
                    />
                  </div>
                </div>

                <div className="mt-8 bg-black/70 px-4 pb-4 pt-4 text-white">
                  <div className="space-y-3 pr-1">
                    {trackItems.map((track) => (
                      <article key={track.id} className="flex items-center gap-4">
                        <div className="h-[96px] w-[96px] shrink-0 overflow-hidden rounded-[8px]">
                          {track.coverShape === "square" ? (
                            <SquareGrayArtwork />
                          ) : (
                            <Image
                              src={track.coverSrc ?? selectedCard.imageSrc}
                              alt={`${track.title} cover`}
                              width={96}
                              height={96}
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                        <div>
                          <p className="text-[20px] font-semibold leading-[23.87px]">{track.title}</p>
                          <p className="mt-1 text-[14px] font-semibold leading-[16.71px] text-white/80">{track.artist}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCard(null)}
                    className="mt-4 inline-flex h-[41px] w-full items-center justify-center rounded-[8px] bg-[#e2e2e2] text-[16px] font-medium text-black"
                  >
                    닫기
                  </button>
                </div>
              </motion.div>

              <motion.div
                className="hidden h-[min(720px,84svh)] w-[min(1080px,92vw)] overflow-hidden bg-black/70 md:flex"
                initial={{ y: 120, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 120, opacity: 0 }}
                transition={{ type: "spring", stiffness: 150, damping: 22 }}
              >
                <div className="flex flex-1 items-center justify-center px-10 py-10">
                  <div className="relative h-[473px] w-[379px] overflow-hidden rounded-[8px]">
                    <Image
                      src={selectedCard.imageSrc}
                      alt={`${selectedCard.title} cover`}
                      fill
                      className="object-cover"
                      sizes="379px"
                    />
                  </div>
                </div>

                <div className="w-[379px] bg-black/70 px-9 pb-6 pt-8 text-white">
                  <h2 className="text-[24px] font-semibold leading-[28.64px]">{selectedCard.title}</h2>
                  <p className="mt-1 text-[10px] leading-[11.93px] text-white/70">앨범 커버를 클릭해보세요!</p>

                  <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4">
                    {trackItems.map((track) => (
                      <article key={track.id} className="w-[133px]">
                        <div className="h-[133px] w-[133px] overflow-hidden rounded-[8px]">
                          {track.coverShape === "square" ? (
                            <SquareGrayArtwork />
                          ) : (
                            <Image
                              src={track.coverSrc ?? selectedCard.imageSrc}
                              alt={`${track.title} cover`}
                              width={133}
                              height={133}
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                        <p className="mt-2 text-[14px] leading-[16.71px]">{track.title}</p>
                        <p className="mt-0.5 text-[10px] leading-[11.93px] text-white/80">{track.artist}</p>
                      </article>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedCard(null)}
                    className="mt-5 inline-flex h-[48px] w-full items-center justify-center rounded-[8px] bg-[#e2e2e2] text-[16px] font-medium text-black"
                  >
                    닫기
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
