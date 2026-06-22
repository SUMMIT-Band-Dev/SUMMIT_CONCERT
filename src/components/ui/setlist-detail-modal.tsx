"use client";

import type { ComponentType } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import type { SetlistCard } from "@/types/setlist";

type TrackItem = {
  id: number;
  title: string;
  artist: string;
  coverShape: "square" | "image";
  coverSrc?: string;
  youtubeUrl?: string;
};

type CoverImageProps = {
  src: string;
  alt: string;
  size: number;
};

type SetlistDetailModalProps = {
  selectedCard: SetlistCard | null;
  trackItems: TrackItem[];
  onClose: () => void;
  onTrackClick: (track: TrackItem) => void;
  TrackCoverImage: ComponentType<CoverImageProps>;
  DummyPosterArtwork: ComponentType;
  SquareGrayArtwork: ComponentType;
};

export default function SetlistDetailModal({
  selectedCard,
  trackItems,
  onClose,
  onTrackClick,
  TrackCoverImage,
  DummyPosterArtwork,
  SquareGrayArtwork,
}: SetlistDetailModalProps) {
  return (
    <AnimatePresence>
      {selectedCard ? (
        <motion.div
          className="fixed inset-0 z-[90]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[1px]" />
          <div className="relative flex h-full w-full items-end justify-center px-4 pb-0 pt-0 md:items-center md:p-8">
            <motion.div
              className="max-h-[min(760px,88svh)] w-[min(360px,92vw)] overflow-y-auto rounded-t-2xl border border-b-0 border-white/10 bg-black/70 shadow-[0_-14px_36px_rgba(0,0,0,0.45)] md:hidden"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 150, damping: 22 }}
            >
              <div className="relative overflow-hidden px-6 pb-3 pt-8">
                <div className="pointer-events-none absolute inset-0">
                  <motion.div
                    className="absolute -left-20 top-2 h-60 w-60 rounded-full bg-white/45 mix-blend-screen blur-xl"
                    animate={{
                      x: [0, 88, -34, 0],
                      y: [0, -42, 24, 0],
                      scale: [1, 1.15, 0.92, 1],
                      opacity: [0.28, 0.72, 0.36, 0.28],
                    }}
                    transition={{ duration: 5.2, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
                  />
                  <motion.div
                    className="absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-sky-200/42 mix-blend-screen blur-xl"
                    animate={{
                      x: [0, -82, 30, 0],
                      y: [0, 34, -24, 0],
                      scale: [1, 0.9, 1.12, 1],
                      opacity: [0.24, 0.66, 0.32, 0.24],
                    }}
                    transition={{ duration: 6, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
                  />
                  <motion.div
                    className="absolute -left-24 top-0 h-[140%] w-24 rotate-12 bg-white/35 mix-blend-screen blur-lg"
                    animate={{ x: [-30, 340, -30], opacity: [0.14, 0.5, 0.14] }}
                    transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <motion.div
                    className="absolute -right-28 top-0 h-[140%] w-20 -rotate-12 bg-cyan-100/30 mix-blend-screen blur-lg"
                    animate={{ x: [20, -320, 20], opacity: [0.12, 0.44, 0.12] }}
                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
                <div className="relative mx-auto w-[323px] rounded-[16px] border border-white/20 bg-white/[0.04] p-[10px] shadow-[0_16px_36px_rgba(0,0,0,0.36)]">
                  <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[16px]">
                    <motion.div
                      className="absolute -left-24 top-0 h-[140%] w-20 rotate-12 bg-white/28 blur-2xl"
                      animate={{ x: [-30, 250, -30], opacity: [0.18, 0.34, 0.18] }}
                      transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.div
                      className="absolute -left-10 top-8 h-32 w-32 rounded-full bg-white/28 blur-xl"
                      animate={{
                        x: [0, 34, -14, 0],
                        y: [0, -20, 14, 0],
                        scale: [1, 1.1, 0.94, 1],
                        opacity: [0.28, 0.6, 0.34, 0.28],
                      }}
                      transition={{ duration: 6.6, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
                    />
                    <motion.div
                      className="absolute -right-12 bottom-6 h-36 w-36 rounded-full bg-sky-200/24 blur-xl"
                      animate={{
                        x: [0, -30, 14, 0],
                        y: [0, 14, -16, 0],
                        scale: [1, 0.92, 1.08, 1],
                        opacity: [0.24, 0.56, 0.3, 0.24],
                      }}
                      transition={{ duration: 7.8, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
                    />
                  </div>
                  <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-full border border-white/30 px-2.5 py-1 text-[9px] font-semibold tracking-[0.12em] text-white/75">
                    NOW PLAYING
                  </div>
                  <div className="pointer-events-none absolute bottom-3 right-3 z-20 rounded-full border border-white/30 px-2.5 py-1 text-[9px] font-semibold text-white/75">
                    DAY {selectedCard.day}
                  </div>
                  <div className="relative z-10 mx-auto h-[378px] w-[303px] overflow-hidden rounded-[8px]">
                    {selectedCard.isPosterDummy ? (
                      <DummyPosterArtwork />
                    ) : (
                      <Image
                        src={selectedCard.imageSrc}
                        alt={`${selectedCard.title} cover`}
                        fill
                        unoptimized
                        className="object-cover"
                        sizes="303px"
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="relative mt-8 overflow-hidden px-4 pb-8 pt-4 text-white">
                <div className="pointer-events-none absolute inset-0">
                  <Image
                    src="/concert-poster-latest.png"
                    alt=""
                    fill
                    sizes="100vw"
                    className="object-cover object-center opacity-20"
                  />
                  <div className="absolute inset-0 bg-black/72" />
                </div>
                <div className="pointer-events-none absolute inset-0 ring-1 ring-white/10" />
                <div className="relative">
                  <p className="text-[11px] tracking-[0.06em] text-white/65">
                    PLAYLIST
                  </p>
                  <div className="mt-3 space-y-2 pr-1">
                    {trackItems.map((track, index) => (
                      <button
                        key={track.id}
                        type="button"
                        onClick={() => onTrackClick(track)}
                        className="flex w-full items-center gap-3 rounded-[10px] border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left transition-all hover:border-white/30 hover:bg-white/[0.1]"
                      >
                        <div className="w-[22px] shrink-0 text-center text-[11px] font-semibold text-white/55">
                          {String(index + 1).padStart(2, "0")}
                        </div>
                        <div className="h-[56px] w-[56px] shrink-0 overflow-hidden rounded-[8px]">
                          {track.coverShape === "square" ? (
                            <SquareGrayArtwork />
                          ) : (
                            <TrackCoverImage
                              src={track.coverSrc ?? selectedCard.imageSrc}
                              alt={`${track.title} cover`}
                              size={56}
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-semibold leading-[1.2]">
                            {track.title}
                          </p>
                          <p className="mt-1 truncate text-[11px] leading-[1.2] text-white/75">
                            {track.artist}
                          </p>
                        </div>
                        <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/35 text-[12px] text-white/85">
                          ▶
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-4 inline-flex h-[41px] w-full items-center justify-center rounded-[8px] bg-[#e2e2e2] text-[16px] font-medium text-black"
                  >
                    닫기
                  </button>
                  <div className="h-4" />
                </div>
              </div>
            </motion.div>

            <motion.div
              className="hidden h-[min(720px,84svh)] w-[min(1080px,92vw)] overflow-hidden bg-black/70 md:flex"
              initial={{ y: 120, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 120, opacity: 0 }}
              transition={{ type: "spring", stiffness: 150, damping: 22 }}
            >
              <div className="relative flex flex-1 items-center justify-center overflow-hidden px-10 py-10">
                <div className="pointer-events-none absolute inset-0">
                  <motion.div
                    className="absolute -left-28 top-4 h-80 w-80 rounded-full bg-white/40 mix-blend-screen blur-xl"
                    animate={{
                      x: [0, 120, -48, 0],
                      y: [0, -56, 36, 0],
                      scale: [1, 1.16, 0.9, 1],
                      opacity: [0.24, 0.68, 0.3, 0.24],
                    }}
                    transition={{ duration: 5.4, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
                  />
                  <motion.div
                    className="absolute -right-24 bottom-0 h-[22rem] w-[22rem] rounded-full bg-sky-200/40 mix-blend-screen blur-xl"
                    animate={{
                      x: [0, -108, 46, 0],
                      y: [0, 46, -34, 0],
                      scale: [1, 0.88, 1.15, 1],
                      opacity: [0.22, 0.64, 0.28, 0.22],
                    }}
                    transition={{ duration: 6.2, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
                  />
                  <motion.div
                    className="absolute -left-28 top-0 h-[145%] w-28 rotate-12 bg-white/30 mix-blend-screen blur-lg"
                    animate={{ x: [-60, 480, -60], opacity: [0.12, 0.44, 0.12] }}
                    transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <motion.div
                    className="absolute -right-32 top-0 h-[145%] w-24 -rotate-12 bg-cyan-100/24 mix-blend-screen blur-lg"
                    animate={{ x: [60, -460, 60], opacity: [0.1, 0.38, 0.1] }}
                    transition={{ duration: 5.3, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
                <div className="relative w-[405px] rounded-[18px] border border-white/20 bg-white/[0.04] p-[13px] shadow-[0_24px_54px_rgba(0,0,0,0.48)]">
                  <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[18px]">
                    <motion.div
                      className="absolute -left-28 top-0 h-[145%] w-24 rotate-12 bg-white/26 blur-2xl"
                      animate={{ x: [-40, 320, -40], opacity: [0.14, 0.3, 0.14] }}
                      transition={{ duration: 5.8, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.div
                      className="absolute -left-12 top-12 h-40 w-40 rounded-full bg-white/26 blur-xl"
                      animate={{
                        x: [0, 42, -20, 0],
                        y: [0, -26, 18, 0],
                        scale: [1, 1.12, 0.92, 1],
                        opacity: [0.26, 0.58, 0.32, 0.26],
                      }}
                      transition={{ duration: 6.9, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
                    />
                    <motion.div
                      className="absolute -right-14 bottom-10 h-44 w-44 rounded-full bg-sky-200/22 blur-xl"
                      animate={{
                        x: [0, -36, 20, 0],
                        y: [0, 16, -20, 0],
                        scale: [1, 0.9, 1.1, 1],
                        opacity: [0.22, 0.52, 0.28, 0.22],
                      }}
                      transition={{ duration: 8.2, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
                    />
                  </div>
                  <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-full border border-white/30 px-3 py-1 text-[10px] font-semibold tracking-[0.14em] text-white/75">
                    NOW PLAYING
                  </div>
                  <div className="pointer-events-none absolute bottom-4 right-4 z-20 rounded-full border border-white/30 px-3 py-1 text-[10px] font-semibold text-white/75">
                    DAY {selectedCard.day}
                  </div>
                  <div className="relative z-10 h-[473px] w-[379px] overflow-hidden rounded-[8px]">
                    {selectedCard.isPosterDummy ? (
                      <DummyPosterArtwork />
                    ) : (
                      <Image
                        src={selectedCard.imageSrc}
                        alt={`${selectedCard.title} cover`}
                        fill
                        unoptimized
                        className="object-cover"
                        sizes="379px"
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="relative w-[395px] overflow-hidden border-l border-white/15 px-7 pb-6 pt-7 text-white">
                <div className="pointer-events-none absolute inset-0">
                  <Image
                    src="/concert-poster-latest.png"
                    alt=""
                    fill
                    sizes="395px"
                    className="object-cover object-center opacity-[0.34]"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,10,10,0.58)_0%,rgba(6,6,6,0.76)_100%)]" />
                </div>
                <div className="pointer-events-none absolute inset-0 ring-1 ring-white/10" />
                <div className="relative flex h-full flex-col justify-center">
                  <h2 className="text-[24px] font-semibold leading-[28.64px]">
                    {selectedCard.title}
                  </h2>
                  <p className="mt-1 text-[11px] tracking-[0.06em] text-white/65">
                    PLAYLIST
                  </p>

                  <div className="mt-4 max-h-[390px] space-y-2 overflow-y-auto pr-1">
                    {trackItems.map((track, index) => (
                      <button
                        key={track.id}
                        type="button"
                        onClick={() => onTrackClick(track)}
                        className="flex w-full items-center gap-3 rounded-[10px] border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left transition-all hover:border-white/30 hover:bg-white/[0.1]"
                      >
                        <div className="w-[24px] shrink-0 text-center text-[12px] font-semibold text-white/55">
                          {String(index + 1).padStart(2, "0")}
                        </div>
                        <div className="h-[56px] w-[56px] shrink-0 overflow-hidden rounded-[8px]">
                          {track.coverShape === "square" ? (
                            <SquareGrayArtwork />
                          ) : (
                            <TrackCoverImage
                              src={track.coverSrc ?? selectedCard.imageSrc}
                              alt={`${track.title} cover`}
                              size={56}
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-semibold leading-[1.25] text-white">
                            {track.title}
                          </p>
                          <p className="mt-1 truncate text-[11px] leading-[1.2] text-white/70">
                            {track.artist}
                          </p>
                        </div>
                        <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/35 text-[12px] text-white/85">
                          ▶
                        </div>
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-5 inline-flex h-[48px] w-full items-center justify-center rounded-[8px] bg-[#e2e2e2] text-[16px] font-medium text-black"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
