import {
  fetchLineUpRows,
  fetchSetlistRows,
  type LineUpRow,
  type SetlistRow,
} from "@/lib/fetch-line-up-and-setlist";
import { shrinkAlbumCoverUrl } from "@/lib/mzstatic";
import EventGoodsView from "@/components/sections/event-goods-view";
import FadeInUp from "@/components/common/fade-in-up";
import type { DayType, TrackItem } from "@/types/setlist";
import type { TeamPlaylist } from "./types";

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

async function buildTeamsByDay(): Promise<Record<DayType, TeamPlaylist[]>> {
  const [lineUpRows, setlistRows] = await Promise.all([
    fetchLineUpRows(),
    fetchSetlistRows(),
  ]);

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

  return nextTeamsByDay;
}

export default async function EventGoodsPage() {
  const teamsByDay = await buildTeamsByDay();

  return (
    <main className="relative min-h-screen overflow-hidden pt-16 md:pt-[84px] lg:pt-[102px]">
      <section className="relative z-10 mx-auto w-full max-w-[980px] px-5 pb-20 pt-10 md:px-8 md:pb-24 md:pt-14 lg:px-12">
        <FadeInUp delay={0.04}>
          <h1 className="text-center text-[24px] font-semibold leading-[1.24] md:text-[34px] lg:text-[40px]">
            셋리스트 전체 보기
          </h1>
          <p className="mt-3 text-center text-[13px] leading-[1.6] text-white/75 md:text-[15px]">
            1일차 · 2일차를 선택해 공연 셋리스트를 확인할 수 있습니다.
          </p>
        </FadeInUp>

        <EventGoodsView teamsByDay={teamsByDay} />
      </section>
    </main>
  );
}
