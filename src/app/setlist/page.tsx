"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import FadeInUp from "@/components/fade-in-up";
import SetlistDetailModal from "@/components/setlist-detail-modal";
import SetlistLineupSections from "@/components/setlist-lineup-sections";
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
  youtubeUrl?: string;
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
  youtube_url?: string;
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

function handleTrackClick(track: TrackItem) {
  if (track.youtubeUrl) {
    const url = new URL(track.youtubeUrl);
    url.searchParams.set("autoplay", "1");
    window.open(url.toString(), "_blank", "noopener,noreferrer");
    return;
  }

  // 팝업 차단 방지: 클릭 이벤트 내에서 즉시 새 창 열기
  const win = window.open("about:blank", "_blank", "noopener,noreferrer");

  const query = `${track.title} ${track.artist}`.trim();
  const params = new URLSearchParams({
    query,
    title: track.title,
    artist: track.artist,
  });

  fetch(`/api/youtube/top-video?${params.toString()}`)
    .then((r) => r.json())
    .then((data: { url?: string }) => {
      const target = win ?? window;
      if (data.url) {
        const url = new URL(data.url);
        url.searchParams.set("autoplay", "1");
        target.location.href = url.toString();
      } else {
        target.location.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      }
    })
    .catch(() => {
      const target = win ?? window;
      target.location.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    });
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
  const handleSelectCard = useCallback((card: SetlistCard) => {
    setSelectedCard(card);
  }, []);
  const handleCloseCard = useCallback(() => {
    setSelectedCard(null);
  }, []);
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

          <SetlistLineupSections
            cards={cards}
            selectedDay={selectedDay}
            onSelectCard={handleSelectCard}
          />
        </section>
      </main>

      <SetlistDetailModal
        selectedCard={selectedCard}
        trackItems={trackItems}
        onClose={handleCloseCard}
        onTrackClick={handleTrackClick}
        TrackCoverImage={TrackCoverImage}
        DummyPosterArtwork={DummyPosterArtwork}
        SquareGrayArtwork={SquareGrayArtwork}
      />
    </div>
  );
}
