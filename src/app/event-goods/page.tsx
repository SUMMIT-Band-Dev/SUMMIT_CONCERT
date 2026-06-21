"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import FadeInUp from "@/components/common/fade-in-up";
import SiteHeader from "@/components/layout/site-header";
import { supabase } from "@/lib/supabase";

type DayType = 1 | 2;

type TrackItem = {
  id: number;
  title: string;
  artist: string;
  coverShape: "square" | "image";
  coverSrc?: string;
  youtubeUrl?: string;
};

type TeamPlaylist = {
  teamName: string;
  imageSrc: string;
  tracks: TrackItem[];
};

type LineUpRow = Record<string, unknown> & {
  id?: number;
  day?: string | number;
  team?: string;
  team_name?: string;
  image_src?: string;
};

type SetlistRow = Record<string, unknown> & {
  id?: number;
  day?: string | number;
  team?: string;
  team_name?: string;
  title?: string;
  singer?: string;
  album?: string;
  youtube_url?: string;
};

const dayLabels: Record<DayType, string> = {
  1: "1일차 공연",
  2: "2일차 공연",
};

function getDayFromRow(row: LineUpRow): DayType | null {
  const dayValue =
    typeof row.day === "string" ? row.day.toLowerCase().trim() : row.day;

  if (
    dayValue === 1 ||
    dayValue === "1" ||
    dayValue === "1일차" ||
    dayValue === "1일차 공연" ||
    dayValue === "day1"
  ) {
    return 1;
  }
  if (
    dayValue === 2 ||
    dayValue === "2" ||
    dayValue === "2일차" ||
    dayValue === "2일차 공연" ||
    dayValue === "day2"
  ) {
    return 2;
  }
  if (typeof row.id === "number") {
    if (row.id >= 1 && row.id <= 7) return 1;
    if (row.id >= 8) return 2;
  }
  return null;
}

function normalizeTeamName(value: string) {
  return value
    .toLowerCase()
    .replace(/젤/g, "제일")
    .replace(/[\s_-]+/g, "")
    .trim();
}

function getTeamFallbackName(id: number) {
  const day1Names = [
    "8C8",
    "뉴비",
    "즐겜굴비",
    "써밋 음악도둑",
    "26살과 26학번",
    "하로로는노는게제일좋아",
    "숙취의 미학",
  ];
  const day2Names = [
    "오미자",
    "낭만치사랑",
    "쉬었음밴드",
    "머리위 쥑쥑이",
    "컴학 늙크크와 공주들",
    "모스붕어",
    "도레미파솔라석희",
    "지연발생",
  ];

  if (id >= 1 && id <= 7) return day1Names[id - 1];
  if (id >= 8 && id <= 15) return day2Names[id - 8];
  return `Team ${id}`;
}

function getImageFallbackPath(id: number) {
  if (id >= 1 && id <= 7) return `/day1-team${id}.png`;
  if (id >= 8 && id <= 14) return `/day2-team${id - 7}.png`;
  if (id === 15) return "/day2-team8.png";
  return "/day1-team1.png";
}

function normalizeImageSource(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().replaceAll("\\", "/");
  if (!trimmed) return "";
  const withoutAssetPrefix = trimmed.replace(/^(public|dist)\//i, "");
  if (withoutAssetPrefix.startsWith("http://") || withoutAssetPrefix.startsWith("https://")) {
    return withoutAssetPrefix;
  }
  return withoutAssetPrefix.startsWith("/") ? withoutAssetPrefix : `/${withoutAssetPrefix}`;
}

function getTeamFromRow(row: SetlistRow, id: number) {
  const team = typeof row.team === "string" ? row.team.trim() : "";
  if (team) return team;
  const teamName = typeof row.team_name === "string" ? row.team_name.trim() : "";
  if (teamName) return teamName;
  return getTeamFallbackName(id);
}

function openInNewTab(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function handleTrackClick(track: TrackItem) {
  if (track.youtubeUrl) {
    const url = new URL(track.youtubeUrl);
    url.searchParams.set("autoplay", "1");
    openInNewTab(url.toString());
    return;
  }

  const win = window.open("", "_blank");
  const query = `${track.title} ${track.artist}`.trim();
  const params = new URLSearchParams({
    query,
    title: track.title,
    artist: track.artist,
  });

  fetch(`/api/youtube/top-video?${params.toString()}`)
    .then((r) => r.json())
    .then((data: { url?: string }) => {
      const dest = data.url
        ? (() => {
            const u = new URL(data.url);
            u.searchParams.set("autoplay", "1");
            return u.toString();
          })()
        : `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      if (win) {
        win.location.href = dest;
      } else {
        openInNewTab(dest);
      }
    })
    .catch(() => {
      const fallback = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      if (win) {
        win.location.href = fallback;
      } else {
        openInNewTab(fallback);
      }
    });
}

function SquareGrayArtwork() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-[8px] bg-[#d9d9d9]">
      <div className="h-[34%] w-[34%] rounded-full bg-[#bcbcbc]" />
    </div>
  );
}

function TrackCoverImage({
  src,
  alt,
  size,
}: {
  src: string;
  alt: string;
  size: number;
}) {
  const [hasLoadError, setHasLoadError] = useState(false);

  if (hasLoadError) {
    return <SquareGrayArtwork />;
  }

  if (/^https?:\/\//i.test(src)) {
    return (
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        className="h-full w-full object-cover"
        unoptimized
        onError={() => setHasLoadError(true)}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className="h-full w-full object-cover"
      onError={() => setHasLoadError(true)}
    />
  );
}

function DayPlaylistSection({
  day,
  teams,
}: {
  day: DayType;
  teams: TeamPlaylist[];
}) {
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
                        onClick={() => handleTrackClick(track)}
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

export default function EventGoodsPage() {
  const [selectedDay, setSelectedDay] = useState<DayType>(1);
  const [teamsByDay, setTeamsByDay] = useState<Record<DayType, TeamPlaylist[]>>({
    1: [],
    2: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      const lineUpTables = ["Line Up", "line_up", "LineUp", "lineup"];
      let lineUpRows: LineUpRow[] = [];

      for (const tableName of lineUpTables) {
        const { data, error } = await supabase
          .from(tableName)
          .select("*")
          .order("id", { ascending: true });

        if (error || !data || data.length === 0) continue;
        lineUpRows = data as LineUpRow[];
        break;
      }

      const setlistTables = ["Setlist", "setlist", "set_list"];
      let setlistRows: SetlistRow[] = [];

      for (const tableName of setlistTables) {
        const { data, error } = await supabase
          .from(tableName)
          .select("*")
          .order("id", { ascending: true });

        if (error || !data || data.length === 0) continue;
        setlistRows = data as SetlistRow[];
        break;
      }

      if (!isMounted) return;

      const lineUpTeamKeys = new Set(
        lineUpRows
          .map((row) =>
            getTeamFromRow(row as SetlistRow, typeof row.id === "number" ? row.id : 0),
          )
          .map((team) => normalizeTeamName(team))
          .filter(Boolean),
      );

      const tracksByTeam: Record<string, TrackItem[]> = {};

      setlistRows.forEach((row, index) => {
        const id = typeof row.id === "number" ? row.id : index + 1;
        const teamName = getTeamFromRow(row, id);
        const teamKey = normalizeTeamName(teamName);
        if (!teamKey) return;
        if (lineUpTeamKeys.size > 0 && !lineUpTeamKeys.has(teamKey)) return;

        const title = typeof row.title === "string" ? row.title.trim() : "";
        if (!title) return;

        const artist =
          typeof row.singer === "string" && row.singer.trim()
            ? row.singer.trim()
            : "SUMMIT Band";
        const albumCoverSrc = normalizeImageSource(row.album);
        const hasRealAlbumCover = Boolean(
          albumCoverSrc && albumCoverSrc !== "/default-album.png",
        );

        const youtubeUrl =
          typeof row.youtube_url === "string" && row.youtube_url.trim()
            ? row.youtube_url.trim()
            : undefined;

        const nextTrack: TrackItem = {
          id: id * 1000 + index + 1,
          title,
          artist,
          coverShape: hasRealAlbumCover ? "image" : "square",
          coverSrc: hasRealAlbumCover ? albumCoverSrc : undefined,
          youtubeUrl,
        };

        const prev = tracksByTeam[teamKey] ?? [];
        const hasSameTrack = prev.some(
          (item) => item.title === nextTrack.title && item.artist === nextTrack.artist,
        );
        if (!hasSameTrack) {
          tracksByTeam[teamKey] = [...prev, nextTrack];
        }
      });

      const nextTeamsByDay: Record<DayType, TeamPlaylist[]> = { 1: [], 2: [] };

      lineUpRows
        .filter((row) => typeof row.id === "number" && row.id >= 1)
        .forEach((row) => {
          const id = row.id as number;
          const day = getDayFromRow(row);
          if (!day) return;

          const teamName = getTeamFromRow(row as SetlistRow, id);
          const teamKey = normalizeTeamName(teamName);
          const imageSrc =
            normalizeImageSource(row.image_src) || getImageFallbackPath(id);
          const tracks = tracksByTeam[teamKey] ?? [];

          nextTeamsByDay[day].push({
            teamName,
            imageSrc,
            tracks,
          });
        });

      setTeamsByDay(nextTeamsByDay);
      setIsLoading(false);
    };

    void fetchData();
    return () => {
      isMounted = false;
    };
  }, []);

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
    <div className="min-h-screen bg-black text-white">
      <SiteHeader />

      <main className="relative min-h-screen overflow-hidden pt-16 md:pt-[84px] lg:pt-[102px]">
        <div className="pointer-events-none absolute inset-0 z-0">
          <Image
            src="/concert-poster-latest.png"
            alt="셋리스트 전체 보기 배경"
            fill
            priority
            sizes="100vw"
            className="object-cover object-bottom opacity-95"
          />
          <div className="absolute inset-0 bg-[#090b1f]/48" />
          <div className="absolute inset-x-0 bottom-0 h-[48vh] bg-gradient-to-b from-transparent via-black/45 to-black/70" />
        </div>

        <section className="relative z-10 mx-auto w-full max-w-[980px] px-5 pb-20 pt-10 md:px-8 md:pb-24 md:pt-14 lg:px-12">
          <FadeInUp delay={0.04}>
            <h1 className="text-center text-[24px] font-semibold leading-[1.24] md:text-[34px] lg:text-[40px]">
              셋리스트 전체 보기
            </h1>
            <p className="mt-3 text-center text-[13px] leading-[1.6] text-white/75 md:text-[15px]">
              1일차 · 2일차를 선택해 공연 셋리스트를 확인할 수 있습니다.
            </p>
          </FadeInUp>

          {!isLoading && hasAnyTracks ? (
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

          {isLoading ? (
            <p className="mt-12 text-center text-[14px] text-white/70">
              셋리스트를 불러오는 중입니다...
            </p>
          ) : !hasAnyTracks ? (
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
        </section>
      </main>
    </div>
  );
}
