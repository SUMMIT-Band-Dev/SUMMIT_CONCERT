import type { LineUpRow, SetlistRow } from "@/lib/fetch-line-up-and-setlist";
import { normalizeImageSource } from "@/lib/image-source";
import { shrinkAlbumCoverUrl } from "@/lib/mzstatic";
import type {
  DayType,
  SetlistCard,
  TeamPlaylist,
  TrackItem,
} from "@/types/setlist";

// 서버(apps/api)의 DAY_PATTERN(`/^day[1-9]\d*$/`)과 같은 형식만 인정한다.
const DAY_PATTERN = /^day([1-9]\d*)$/;

// Line Up.day 값에서 일차를 읽는다. `dayN` 형식이 아니면 null.
// id 범위로 일차를 추정하지 않는다 — 알 수 없는 팀은 일차 기반 화면에서 제외된다.
export function parseDay(value: unknown): DayType | null {
  if (typeof value !== "string") return null;
  const match = DAY_PATTERN.exec(value.trim().toLowerCase());
  if (!match) return null;
  const day = Number(match[1]);
  return Number.isSafeInteger(day) ? day : null;
}

// 일차 탭에 쓸 값: 중복 제거 후 숫자 오름차순
export function getSortedDays(days: Iterable<DayType>): DayType[] {
  return [...new Set(days)].sort((a, b) => a - b);
}

export function getDayLabel(day: DayType) {
  return `${day}일차 공연`;
}

function getLineUpId(row: LineUpRow): number | null {
  return typeof row.id === "number" && row.id >= 1 ? row.id : null;
}

function getTeamName(row: LineUpRow): string {
  return typeof row.team_name === "string" ? row.team_name.trim() : "";
}

// /setlist 팀 카드. 일차·팀명·포스터 이미지가 모두 있는 팀만 노출한다(미완성 팀 비노출).
export function buildLineUpCards(lineUpRows: LineUpRow[]): SetlistCard[] {
  const cards: SetlistCard[] = [];

  for (const row of lineUpRows) {
    const id = getLineUpId(row);
    const day = parseDay(row.day);
    const title = getTeamName(row);
    const imageSrc = normalizeImageSource(row.image_src);
    if (id === null || day === null || !title || !imageSrc) continue;

    cards.push({
      id,
      day,
      title,
      artist: "SUMMIT SUMMER CONCERT",
      imageSrc,
      isPosterDummy: false,
    });
  }

  return cards;
}

// Setlist.teamId(FK → Line Up.id)로 곡을 팀별로 묶는다.
export function buildTracksByTeamId(
  setlistRows: SetlistRow[],
  lineUpRows: LineUpRow[],
): Record<number, TrackItem[]> {
  const lineUpIds = new Set(
    lineUpRows
      .map((row) => (typeof row.id === "number" ? row.id : null))
      .filter((id): id is number => id !== null),
  );

  const tracksByTeamId: Record<number, TrackItem[]> = {};

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

  return tracksByTeamId;
}

// /event-goods 일차별 팀 목록. 일차와 팀명이 있는 팀만 담고, 곡이 없는 팀은 화면에서 숨긴다.
export function buildTeamsByDay(
  lineUpRows: LineUpRow[],
  tracksByTeamId: Record<number, TrackItem[]>,
): Record<DayType, TeamPlaylist[]> {
  const teamsByDay: Record<DayType, TeamPlaylist[]> = {};

  for (const row of lineUpRows) {
    const id = getLineUpId(row);
    const day = parseDay(row.day);
    const teamName = getTeamName(row);
    if (id === null || day === null || !teamName) continue;

    (teamsByDay[day] ??= []).push({
      teamName,
      tracks: tracksByTeamId[id] ?? [],
    });
  }

  return teamsByDay;
}
