"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import FadeInUp from "@/components/fade-in-up";
import SiteHeader from "@/components/site-header";
import { supabase } from "@/lib/supabase";

type DayType = 1 | 2;

type SetlistCard = {
  id: number;
  day: DayType;
  title: string;
  artist: string;
  imageSrc: string;
  isPosterDummy: boolean;
};

type TrackItem = {
  id: number;
  title: string;
  artist: string;
  coverShape: "square" | "image";
  coverSrc?: string;
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
  image_src?: string;
  title?: string;
  singer?: string;
  album?: string;
};

const setlistCards: SetlistCard[] = [
  {
    id: 1,
    day: 1,
    title: "8C8",
    artist: "SUMMIT SUMMER CONCERT",
    imageSrc: "/day1-team1.png",
    isPosterDummy: false,
  },
  {
    id: 2,
    day: 1,
    title: "뉴비",
    artist: "SUMMIT SUMMER CONCERT",
    imageSrc: "/day1-team2.png",
    isPosterDummy: false,
  },
  {
    id: 3,
    day: 1,
    title: "즐겜굴비",
    artist: "SUMMIT SUMMER CONCERT",
    imageSrc: "/day1-team3.png",
    isPosterDummy: false,
  },
  {
    id: 4,
    day: 1,
    title: "써밋 음악도둑",
    artist: "SUMMIT SUMMER CONCERT",
    imageSrc: "/day1-team4.png",
    isPosterDummy: false,
  },
  {
    id: 5,
    day: 1,
    title: "26살과 26학번",
    artist: "SUMMIT SUMMER CONCERT",
    imageSrc: "/day1-team5.png",
    isPosterDummy: false,
  },
  {
    id: 6,
    day: 1,
    title: "하로로는노는게제일좋아",
    artist: "SUMMIT SUMMER CONCERT",
    imageSrc: "/day1-team6.png",
    isPosterDummy: false,
  },
  {
    id: 7,
    day: 1,
    title: "숙취의 미학",
    artist: "SUMMIT SUMMER CONCERT",
    imageSrc: "/day1-team7.png",
    isPosterDummy: false,
  },
  {
    id: 8,
    day: 2,
    title: "오미자",
    artist: "SUMMIT SUMMER CONCERT",
    imageSrc: "/day2-team1.png",
    isPosterDummy: false,
  },
  {
    id: 9,
    day: 2,
    title: "낭만치사랑",
    artist: "SUMMIT SUMMER CONCERT",
    imageSrc: "/day2-team2.png",
    isPosterDummy: false,
  },
  {
    id: 10,
    day: 2,
    title: "쉬었음밴드",
    artist: "SUMMIT SUMMER CONCERT",
    imageSrc: "/day2-team3.png",
    isPosterDummy: false,
  },
  {
    id: 11,
    day: 2,
    title: "머리위 쥑쥑이",
    artist: "SUMMIT SUMMER CONCERT",
    imageSrc: "/day2-team4.png",
    isPosterDummy: false,
  },
  {
    id: 12,
    day: 2,
    title: "컴학 늙크크와 공주들",
    artist: "SUMMIT SUMMER CONCERT",
    imageSrc: "/day2-team5.png",
    isPosterDummy: false,
  },
  {
    id: 13,
    day: 2,
    title: "모스붕어",
    artist: "SUMMIT SUMMER CONCERT",
    imageSrc: "/day2-team6.png",
    isPosterDummy: false,
  },
  {
    id: 14,
    day: 2,
    title: "도레미파솔라석희",
    artist: "SUMMIT SUMMER CONCERT",
    imageSrc: "/day2-team7.png",
    isPosterDummy: false,
  },
];

const trackListByDay: Record<DayType, TrackItem[]> = {
  1: [
    { id: 101, title: "Twilight", artist: "SUMMIT Band", coverShape: "square" },
    {
      id: 102,
      title: "Sunset Sky",
      artist: "SUMMIT Band",
      coverShape: "square",
    },
    { id: 103, title: "Dreaming", artist: "SUMMIT Band", coverShape: "square" },
    {
      id: 104,
      title: "Blue Hour",
      artist: "SUMMIT Band",
      coverShape: "square",
    },
    {
      id: 105,
      title: "After Party",
      artist: "SUMMIT Band",
      coverShape: "square",
    },
    { id: 106, title: "Encore", artist: "SUMMIT Band", coverShape: "square" },
  ],
  2: [
    {
      id: 201,
      title: "Night Drive",
      artist: "SUMMIT Band",
      coverShape: "square",
    },
    {
      id: 202,
      title: "Moonlight",
      artist: "SUMMIT Band",
      coverShape: "square",
    },
    {
      id: 203,
      title: "Afterglow",
      artist: "SUMMIT Band",
      coverShape: "square",
    },
    {
      id: 204,
      title: "Last Song",
      artist: "SUMMIT Band",
      coverShape: "square",
    },
    { id: 205, title: "Midnight", artist: "SUMMIT Band", coverShape: "square" },
    { id: 206, title: "Finale", artist: "SUMMIT Band", coverShape: "square" },
  ],
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
  )
    return 1;
  if (
    dayValue === 2 ||
    dayValue === "2" ||
    dayValue === "2일차" ||
    dayValue === "2일차 공연" ||
    dayValue === "day2"
  )
    return 2;
  if (typeof row.id === "number") {
    if (row.id >= 1 && row.id <= 7) return 1;
    if (row.id >= 8 && row.id <= 14) return 2;
  }
  return null;
}

function normalizeTeamName(value: string) {
  return (
    value
      .toLowerCase()
      // 실무 입력에서 자주 섞이는 축약(젤)과 정식표기(제일)를 동일 키로 취급
      .replace(/젤/g, "제일")
      .replace(/[\s_-]+/g, "")
      .trim()
  );
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
  ];

  if (id >= 1 && id <= 7) return day1Names[id - 1];
  if (id >= 8 && id <= 14) return day2Names[id - 8];
  return `Team ${id}`;
}

function getImageFallbackPath(id: number) {
  if (id >= 1 && id <= 7) return `/day1-team${id}.png`;
  if (id >= 8 && id <= 14) return `/day2-team${id - 7}.png`;
  return "/day1-team1.png";
}

function normalizeImageSource(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().replaceAll("\\", "/");
  if (!trimmed) return "";
  const withoutAssetPrefix = trimmed.replace(/^(public|dist)\//i, "");
  const normalized = withoutAssetPrefix;
  if (normalized.startsWith("http://") || normalized.startsWith("https://"))
    return normalized;
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function getTeamFromSetlistRow(row: SetlistRow, id: number) {
  const team = typeof row.team === "string" ? row.team.trim() : "";
  if (team) return team;
  const teamName =
    typeof row.team_name === "string" ? row.team_name.trim() : "";
  if (teamName) return teamName;
  return getTeamFallbackName(id);
}

function shouldUseDummyPoster(teamName: string) {
  void teamName;
  return false;
}

function SquareGrayArtwork() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-[8px] bg-[#d9d9d9]">
      <div className="h-[34%] w-[34%] rounded-full bg-[#bcbcbc]" />
    </div>
  );
}

function DummyPosterArtwork() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center rounded-[8px] bg-[#5a5a5a] text-center">
      <div className="h-[24%] w-[24%] rounded-full bg-[#777777]" />
      <p className="mt-4 text-[12px] font-medium text-white/80">임시 포스터</p>
    </div>
  );
}

function isExternalImageSource(src: string) {
  return /^https?:\/\//i.test(src);
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

  // 외부 이미지(음원 사이트 URL)는 Next image optimizer를 거치지 않고 직접 렌더링해 깨짐을 방지한다.
  if (isExternalImageSource(src)) {
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

function getTopYouTubeVideoUrl(track: TrackItem) {
  const query = `${track.title} ${track.artist}`.trim();
  const params = new URLSearchParams({
    query,
    title: track.title,
    artist: track.artist,
    redirect: "1",
  });
  return `/api/youtube/top-video?${params.toString()}`;
}

export default function SetlistPage() {
  const [selectedDay, setSelectedDay] = useState<DayType>(1);
  const [selectedCard, setSelectedCard] = useState<SetlistCard | null>(null);
  const [cardsData, setCardsData] = useState<SetlistCard[]>(setlistCards);
  const [trackItemsByTeamKey, setTrackItemsByTeamKey] = useState<
    Record<string, TrackItem[]>
  >({});

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      // 1) 카드/팀명/포스터는 Line Up(team_name) 기준
      const lineUpTables = ["Line Up", "line_up", "LineUp", "lineup"];
      let lineUpRows: LineUpRow[] = [];
      for (const tableName of lineUpTables) {
        const { data, error } = await supabase
          .from(tableName)
          .select("*")
          .order("id", { ascending: true });

        if (error || !data || data.length === 0) {
          continue;
        }
        lineUpRows = data as LineUpRow[];
        break;
      }

      if (!isMounted) return;

      if (lineUpRows.length > 0) {
        const parsedCards = lineUpRows
          .filter((row) => typeof row.id === "number" && row.id >= 1)
          .map((row) => {
            const id = row.id as number;
            const day = getDayFromRow(row);
            if (!day) return null;
            const teamName = getTeamFromSetlistRow(row as SetlistRow, id);
            const useDummyPoster = shouldUseDummyPoster(teamName);

            const imageSrc =
              normalizeImageSource(row.image_src) ||
              (useDummyPoster ? "" : getImageFallbackPath(id));

            return {
              id,
              day,
              title: teamName,
              artist: "SUMMIT SUMMER CONCERT",
              imageSrc,
              isPosterDummy: useDummyPoster,
            } satisfies SetlistCard;
          })
          .filter((card): card is SetlistCard => card !== null);

        if (parsedCards.length > 0) {
          setCardsData(parsedCards);
        }
      }

      // 2) 곡 목록은 Setlist(title/singer/team) 기준
      const setlistTables = ["Setlist", "setlist", "set_list"];
      let setlistRows: SetlistRow[] = [];
      for (const tableName of setlistTables) {
        const { data, error } = await supabase
          .from(tableName)
          .select("*")
          .order("id", { ascending: true });

        if (error || !data || data.length === 0) {
          continue;
        }
        setlistRows = data as SetlistRow[];
        break;
      }

      if (!isMounted) return;

      if (setlistRows.length > 0) {
        const lineUpTeamKeys = new Set(
          lineUpRows
            .map((row) =>
              getTeamFromSetlistRow(
                row as SetlistRow,
                typeof row.id === "number" ? row.id : 0,
              ),
            )
            .map((team) => normalizeTeamName(team))
            .filter(Boolean),
        );

        const tracksByTeam: Record<string, TrackItem[]> = {};

        setlistRows.forEach((row, index) => {
          const id = typeof row.id === "number" ? row.id : index + 1;
          const teamName = getTeamFromSetlistRow(row, id);
          const teamKey = normalizeTeamName(teamName);
          if (!teamKey) return;

          // 요청사항: Setlist.team 과 Line Up.team_name 이 일치하는 팀만 반영
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
          const nextTrack: TrackItem = {
            id: id * 1000 + index + 1,
            title,
            artist,
            coverShape: hasRealAlbumCover ? "image" : "square",
            coverSrc: hasRealAlbumCover ? albumCoverSrc : undefined,
          };

          const prev = tracksByTeam[teamKey] ?? [];
          const hasSameTrack = prev.some(
            (item) =>
              item.title === nextTrack.title &&
              item.artist === nextTrack.artist,
          );
          if (!hasSameTrack) {
            tracksByTeam[teamKey] = [...prev, nextTrack];
          }
        });

        setTrackItemsByTeamKey(tracksByTeam);
      }
    };

    void fetchData();
    return () => {
      isMounted = false;
    };
  }, []);

  const cards = useMemo(
    () => cardsData.filter((card) => card.day === selectedDay),
    [cardsData, selectedDay],
  );
  const selectedTeamKey = selectedCard
    ? normalizeTeamName(selectedCard.title)
    : "";
  const matchedTrackItems = selectedTeamKey
    ? trackItemsByTeamKey[selectedTeamKey]
    : undefined;
  const trackItems = matchedTrackItems?.length
    ? matchedTrackItems
    : trackListByDay[selectedDay];
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader />

      <main className="relative min-h-screen overflow-hidden pt-16 md:pt-[84px] lg:pt-[102px]">
        <div className="pointer-events-none absolute inset-0 z-0">
          <Image
            src="/concert-poster-latest.png"
            alt="셋리스트 배경"
            fill
            priority
            sizes="100vw"
            className="object-cover object-bottom opacity-95"
          />
          <div className="absolute inset-0 bg-[#090b1f]/42" />
          <div className="absolute inset-x-0 bottom-0 h-[48vh] bg-gradient-to-b from-transparent via-black/45 to-black/70" />
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
              <button
                key={card.id}
                type="button"
                onClick={() => setSelectedCard(card)}
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
            ))}
          </motion.div>

          <FadeInUp delay={0.24} once={false}>
            <div className="mt-10 hidden gap-x-8 gap-y-10 md:grid md:grid-cols-2 lg:grid-cols-4">
              {cards.map((card, index) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setSelectedCard(card)}
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
                      <a
                        key={track.id}
                        href={getTopYouTubeVideoUrl(track)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-[10px] border border-white/10 bg-white/[0.04] px-3 py-2.5 transition-all hover:border-white/30 hover:bg-white/[0.1]"
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
                      </a>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCard(null)}
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
                        <a
                          key={track.id}
                          href={getTopYouTubeVideoUrl(track)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 rounded-[10px] border border-white/10 bg-white/[0.04] px-3 py-2.5 transition-all hover:border-white/30 hover:bg-white/[0.1]"
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
                        </a>
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
                </div>
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
