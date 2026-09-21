"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import FadeInUp from "@/components/common/fade-in-up";
import TrackActionIndicator from "@/components/ui/track-action-indicator";
import TrackCoverImage from "@/components/ui/track-cover-image";
import { SquareGrayArtwork } from "@/components/ui/artwork-placeholders";
import { getDayLabel, getSortedDays } from "@/lib/line-up";
import { getTrackActionLabel, openTrackVideo } from "@/lib/open-track-video";
import type { DayType, TeamPlaylist } from "@/types/setlist";

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
        <h2 className="text-[20px] font-semibold md:text-[28px]">{getDayLabel(day)}</h2>
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
                      aria-label={getTrackActionLabel(track)}
                      className="flex w-full items-center gap-3 rounded-[10px] border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left transition-all hover:border-white/30 hover:bg-white/[0.1]"
                    >
                      <div className="w-6 shrink-0 text-center text-[12px] font-semibold text-white/55">
                        {String(displayIndex).padStart(2, "0")}
                      </div>
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[8px]">
                        {track.coverShape === "square" || !track.coverSrc ? (
                          <SquareGrayArtwork />
                        ) : (
                          <TrackCoverImage
                            src={track.coverSrc}
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
                      <TrackActionIndicator track={track} />
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
  const [pickedDay, setPickedDay] = useState<DayType | null>(null);

  // 일차 탭은 곡이 있는 팀이 하나라도 있는 일차만, 숫자순으로 만든다.
  const days = useMemo(
    () =>
      getSortedDays(
        Object.entries(teamsByDay)
          .filter(([, teams]) => teams.some((team) => team.tracks.length > 0))
          .map(([day]) => Number(day)),
      ),
    [teamsByDay],
  );
  const selectedDay =
    pickedDay !== null && days.includes(pickedDay) ? pickedDay : days[0];

  return (
    <>
      {selectedDay === undefined ? (
        <p className="mt-12 text-center text-[14px] text-white/70">
          표시할 셋리스트가 없습니다.
        </p>
      ) : (
        <>
          <FadeInUp delay={0.08}>
            <div className="mt-6 flex items-center justify-center gap-5 md:mt-8 md:gap-8">
              {days.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setPickedDay(day)}
                  className={`text-[18px] font-semibold leading-[1.2] transition-colors md:text-[22px] lg:text-[26px] ${
                    selectedDay === day ? "text-white" : "text-[#ababab]"
                  }`}
                >
                  {getDayLabel(day)}
                </button>
              ))}
            </div>
          </FadeInUp>

          <div className="mt-8 md:mt-10">
            <DayPlaylistSection day={selectedDay} teams={teamsByDay[selectedDay]} />
          </div>
        </>
      )}
    </>
  );
}
