import {
  fetchLineUpRows,
  fetchSetlistRows,
  type LineUpRow,
  type SetlistRow,
} from "@/lib/fetch-line-up-and-setlist";
import { shrinkAlbumCoverUrl } from "@/lib/mzstatic";
import FadeInUp from "@/components/common/fade-in-up";
import SetlistView from "@/components/sections/setlist-view";
import type { DayType, SetlistCard, TrackItem } from "@/types/setlist";

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

async function buildSetlistData(): Promise<{
  cardsData: SetlistCard[];
  trackItemsByTeamId: Record<number, TrackItem[]>;
}> {
  const [lineUpRows, setlistRows] = await Promise.all([
    fetchLineUpRows(),
    fetchSetlistRows(),
  ]);

  // 1) 카드/팀명/포스터는 Line Up(team_name) 기준
  let cardsData: SetlistCard[] = setlistCards;

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
      cardsData = parsedCards;
    }
  }

  // 2) 곡 목록은 Setlist(title/singer/teamId) 기준, Line Up.id 로 매칭
  const tracksByTeamId: Record<number, TrackItem[]> = {};

  if (setlistRows.length > 0) {
    const lineUpIds = new Set(
      lineUpRows
        .map((row) => (typeof row.id === "number" ? row.id : null))
        .filter((id): id is number => id !== null),
    );

    setlistRows.forEach((row, index) => {
      const id = typeof row.id === "number" ? row.id : index + 1;
      const teamId = typeof row.teamId === "number" ? row.teamId : null;
      if (teamId === null) return;

      // Setlist.teamId 와 Line Up.id 가 일치하는 팀만 반영
      if (lineUpIds.size > 0 && !lineUpIds.has(teamId)) return;

      const title = typeof row.title === "string" ? row.title.trim() : "";
      if (!title) return;

      const artist =
        typeof row.singer === "string" && row.singer.trim()
          ? row.singer.trim()
          : "SUMMIT Band";
      const rawAlbumCoverSrc = normalizeImageSource(row.album);
      const albumCoverSrc = rawAlbumCoverSrc.startsWith("http")
        ? shrinkAlbumCoverUrl(rawAlbumCoverSrc)
        : rawAlbumCoverSrc;
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

      const prev = tracksByTeamId[teamId] ?? [];
      const hasSameTrack = prev.some(
        (item) =>
          item.title === nextTrack.title && item.artist === nextTrack.artist,
      );
      if (!hasSameTrack) {
        tracksByTeamId[teamId] = [...prev, nextTrack];
      }
    });
  }

  return { cardsData, trackItemsByTeamId: tracksByTeamId };
}

export default async function SetlistPage() {
  const { cardsData, trackItemsByTeamId } = await buildSetlistData();

  return (
    <main className="relative min-h-screen overflow-hidden pt-16 md:pt-21 lg:pt-25.5">
      <section className="relative z-10 mx-auto w-full max-w-360 px-5 pb-20 pt-10 md:px-8 md:pb-24 md:pt-16 lg:px-18 lg:pt-24">
        <FadeInUp delay={0.04}>
          <h1 className="text-[28px] font-semibold leading-[33.4px] md:text-[32px] md:leading-9.5 lg:text-[36px] lg:leading-[42.96px]">
            Setlist
          </h1>
        </FadeInUp>

        <SetlistView cardsData={cardsData} trackItemsByTeamId={trackItemsByTeamId} />
      </section>
    </main>
  );
}
