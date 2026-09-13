"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import FadeInUp from "@/components/common/fade-in-up";
import TrackCoverImage from "@/components/ui/track-cover-image";
import { SquareGrayArtwork } from "@/components/ui/artwork-placeholders";
import { openTrackVideo } from "@/lib/open-track-video";
import type { DayType } from "@/types/setlist";
import type { TeamPlaylist } from "@/app/event-goods/types";

const dayLabels: Record<DayType, string> = {
  1: "1일차 공연",
  2: "2일차 공연",
};

function DayPlaylistSection({ day, teams }: { day: DayType; teams: TeamPlaylist[] }) {
  let trackIndex = 0;
  const visibleTeams = teams.filter((team) => team.tracks.length > 0);

  return (
    <motion.article
      key={day}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="overflow-hidden rounded-[18px] border border-white/25 bg-[#0f1223]/28 shadow-[0_18px_44px_rgba(0,0,0,0.3)] backdrop-blur-[6px]"
    >
      <div className="border-b border-white/20 bg-[#0f1223]/36 px-5 py-4 md:px-7">
        <h2 className="text-[20px] font-semibold md:text-[28px]">{dayLabels[day]}</h2>
        <p className="mt-1 text-[12px] tracking-[0.08em] text-white/65 md:text-[13px]">
          PLAYLIST
        </p>
      </div>

      <div className="space-y-6 px-4 py-5 md:px-6 md:py-6">
        {visibleTeams.length === 0 ? (
          <p className="py-8 text-center text-[14px] text-white/70">
            등록된 셋리스트가 없습니다.
          </p>
        ) : (
          visibleTeams.map((team) => (
            <section key={`${day}-${team.teamName}`}>
              <h3 className="mb-3 text-[15px] font-semibold text-[#ffe8b5] md:text-[18px]">
                {team.teamName}
              </h3>
              <div className="space-y-2">
                {team.tracks.map((track) => {
                  trackIndex += 1;
                  const displayIndex = trackIndex;

                  return (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => openTrackVideo(track)}
                      className="flex w-full items-center gap-3 rounded-[10px] border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left transition-all hover:border-white/30 hover:bg-white/[0.1]"
                    >
                      <div className="w-[24px] shrink-0 text-center text-[12px] font-semibold text-white/55">
                        {String(displayIndex).padStart(2, "0")}
                      </div>
                      <div className="h-[56px] w-[56px] shrink-0 overflow-hidden rounded-[8px]">
                        {track.coverShape === "square" ? (
                          <SquareGrayArtwork />
                        ) : (
                          <TrackCoverImage
                            src={track.coverSrc ?? team.imageSrc}
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
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </motion.article>
  );
}

export default function EventGoodsView({
  teamsByDay,
}: {
  teamsByDay: Record<DayType, TeamPlaylist[]>;
}) {
  const [selectedDay, setSelectedDay] = useState<DayType>(1);

  const hasAnyTracks = useMemo(
    () =>
      teamsByDay[1].some((team) => team.tracks.length > 0) ||
      teamsByDay[2].some((team) => team.tracks.length > 0),
    [teamsByDay],
  );

  const hasSelectedDayTracks = useMemo(
    () => teamsByDay[selectedDay].some((team) => team.tracks.length > 0),
    [teamsByDay, selectedDay],
  );

  return (
    <>
      {hasAnyTracks ? (
        <FadeInUp delay={0.08}>
          <div className="mt-6 flex items-center justify-center gap-5 md:mt-8 md:gap-8">
            <button
              type="button"
              onClick={() => setSelectedDay(1)}
              className={`text-[18px] font-semibold leading-[1.2] transition-colors md:text-[22px] lg:text-[26px] ${
                selectedDay === 1 ? "text-white" : "text-[#ababab]"
              }`}
            >
              1일차 공연
            </button>
            <button
              type="button"
              onClick={() => setSelectedDay(2)}
              className={`text-[18px] font-semibold leading-[1.2] transition-colors md:text-[22px] lg:text-[26px] ${
                selectedDay === 2 ? "text-white" : "text-[#ababab]"
              }`}
            >
              2일차 공연
            </button>
          </div>
        </FadeInUp>
      ) : null}

      {!hasAnyTracks ? (
        <p className="mt-12 text-center text-[14px] text-white/70">
          표시할 셋리스트가 없습니다.
        </p>
      ) : !hasSelectedDayTracks ? (
        <p className="mt-12 text-center text-[14px] text-white/70">
          {dayLabels[selectedDay]} 셋리스트가 없습니다.
        </p>
      ) : (
        <div className="mt-8 md:mt-10">
          <DayPlaylistSection day={selectedDay} teams={teamsByDay[selectedDay]} />
        </div>
      )}
    </>
  );
}
