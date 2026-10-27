import "server-only";

import { cache } from "react";
import { createContentClient } from "@/lib/supabase-content";
import type {
  ConcertContent,
  VenueContent,
  PerformanceDayContent,
  TicketContent,
  InfoCategory,
  InfoSectionContent,
} from "@/types/concert-content";

// 재검증 중 실패하면 직전 정상 페이지를 유지하고, 첫 빌드에서는 실패가 드러나게 한다.
// 빈 값으로 대체해 잘못된 화면을 캐시하지 않는다.
export class ConcertContentError extends Error {
  constructor(queryName: string) {
    super(`공연 콘텐츠를 불러오지 못했습니다: ${queryName}`);
    this.name = "ConcertContentError";
  }
}

function isRow(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRow(value: unknown, queryName: string): Record<string, unknown> {
  if (!isRow(value)) throw new ConcertContentError(queryName);
  return value;
}

function readRows(value: unknown, queryName: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new ConcertContentError(queryName);
  return value.map((row: unknown) => readRow(row, queryName));
}

function readString(value: unknown, queryName: string): string {
  if (typeof value !== "string") throw new ConcertContentError(queryName);
  return value;
}

function readOptionalString(value: unknown, queryName: string): string | null {
  if (value === null) return null;
  const text = readString(value, queryName);
  return text.trim() ? text : null;
}

function readDate(value: unknown, queryName: string): string {
  const date = readString(value, queryName);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ConcertContentError(queryName);
  return date;
}

function readNumber(value: unknown, queryName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new ConcertContentError(queryName);
  return value;
}

function readCoordinate(value: unknown, queryName: string): number {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) throw new ConcertContentError(queryName);
  const coordinate = Number(value);
  if (!Number.isFinite(coordinate)) throw new ConcertContentError(queryName);
  return coordinate;
}

function readId(value: unknown, queryName: string): bigint {
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  throw new ConcertContentError(queryName);
}

export const getConcert = cache(async (): Promise<ConcertContent> => {
  const queryName = "getConcert";
  const client = createContentClient(["concert"]);
  const { data, error } = await client
    .from("Concert")
    .select("titleKo, titleEn, subtitle, startDate, endDate, showTime, posterImageUrl, titleImageUrl, subtitleImageUrl")
    .eq("id", 1)
    .single();
  if (error) throw new ConcertContentError(queryName);
  const row = readRow(data, queryName);
  return {
    titleKo: readString(row.titleKo, queryName),
    titleEn: readString(row.titleEn, queryName),
    subtitle: readOptionalString(row.subtitle, queryName),
    startDate: readDate(row.startDate, queryName),
    endDate: readDate(row.endDate, queryName),
    showTime: readString(row.showTime, queryName),
    posterImageUrl: readOptionalString(row.posterImageUrl, queryName),
    titleImageUrl: readOptionalString(row.titleImageUrl, queryName),
    subtitleImageUrl: readOptionalString(row.subtitleImageUrl, queryName),
  };
});

export const getVenue = cache(async (): Promise<VenueContent> => {
  const queryName = "getVenue";
  const client = createContentClient(["concert", "venue"]);
  const { data, error } = await client
    .from("Concert")
    .select("venue:Venue(name, address, addressDetail, latitude, longitude, naverMapUrl, websiteUrl)")
    .eq("id", 1)
    .single();
  if (error) throw new ConcertContentError(queryName);
  const row = readRow(readRow(data, queryName).venue, queryName);
  return {
    name: readString(row.name, queryName),
    address: readString(row.address, queryName),
    addressDetail: readOptionalString(row.addressDetail, queryName),
    latitude: readCoordinate(row.latitude, queryName),
    longitude: readCoordinate(row.longitude, queryName),
    naverMapUrl: readOptionalString(row.naverMapUrl, queryName),
    websiteUrl: readOptionalString(row.websiteUrl, queryName),
  };
});

export const getPerformanceDays = cache(async (): Promise<PerformanceDayContent[]> => {
  const queryName = "getPerformanceDays";
  const client = createContentClient(["performance-days"]);
  const { data, error } = await client
    .from("PerformanceDay")
    .select("dayKey, dayLabel, dateLabel, bookingUrl, lineupOverride, timetableImageUrl");
  if (error) throw new ConcertContentError(queryName);
  return readRows(data, queryName)
    .map((row) => ({
      dayKey: readString(row.dayKey, queryName),
      dayLabel: readString(row.dayLabel, queryName),
      dateLabel: readString(row.dateLabel, queryName),
      bookingUrl: readOptionalString(row.bookingUrl, queryName),
      lineupOverride: readOptionalString(row.lineupOverride, queryName),
      timetableImageUrl: readOptionalString(row.timetableImageUrl, queryName),
    }))
    .sort((a, b) => {
      const aMatch = /^day(\d+)$/.exec(a.dayKey);
      const bMatch = /^day(\d+)$/.exec(b.dayKey);
      if (aMatch && bMatch) {
        const aDay = BigInt(aMatch[1]);
        const bDay = BigInt(bMatch[1]);
        return aDay < bDay ? -1 : aDay > bDay ? 1 : 0;
      }
      if (aMatch) return -1;
      if (bMatch) return 1;
      return a.dayKey < b.dayKey ? -1 : a.dayKey > b.dayKey ? 1 : 0;
    });
});

export const getTicket = cache(async (): Promise<TicketContent> => {
  const queryName = "getTicket";
  const client = createContentClient(["ticket"]);
  const { data, error } = await client.from("Ticket").select("frontImageUrl, backImageUrl, description").eq("id", 1).single();
  if (error) throw new ConcertContentError(queryName);
  const row = readRow(data, queryName);
  return {
    frontImageUrl: readOptionalString(row.frontImageUrl, queryName),
    backImageUrl: readOptionalString(row.backImageUrl, queryName),
    description: readOptionalString(row.description, queryName),
  };
});

export const getInfoSections = cache(async (category: InfoCategory): Promise<InfoSectionContent[]> => {
  const queryName = "getInfoSections";
  const client = createContentClient(["info-sections"]);
  const { data, error } = await client
    .from("InfoSection")
    .select("title, sortOrder, items:InfoItem(content, sortOrder)")
    .eq("category", category);
  if (error) throw new ConcertContentError(queryName);
  return readRows(data, queryName)
    .map((row) => ({
      title: readString(row.title, queryName),
      sortOrder: readNumber(row.sortOrder, queryName),
      items: readRows(row.items, queryName)
        .map((item) => ({ content: readString(item.content, queryName), sortOrder: readNumber(item.sortOrder, queryName) }))
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => item.content),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ title, items }) => ({ title, items }));
});

export const getLineupByDay = cache(async (): Promise<Record<string, string[]>> => {
  const queryName = "getLineupByDay";
  const client = createContentClient(["lineup"]);
  const { data, error } = await client.from("Line Up").select("team_name, day, performanceOrder, id");
  if (error) throw new ConcertContentError(queryName);
  const teams = readRows(data, queryName)
    .map((row) => ({
      teamName: readString(row.team_name, queryName).trim(),
      day: readOptionalString(row.day, queryName),
      performanceOrder: row.performanceOrder === null ? null : readNumber(row.performanceOrder, queryName),
      id: readId(row.id, queryName),
    }))
    .sort((a, b) => {
      if (a.performanceOrder === null && b.performanceOrder !== null) return 1;
      if (a.performanceOrder !== null && b.performanceOrder === null) return -1;
      const order = (a.performanceOrder ?? 0) - (b.performanceOrder ?? 0);
      return order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });
  const result: Record<string, string[]> = {};
  for (const team of teams) {
    if (!team.day || !/^day\d+$/.test(team.day) || !team.teamName) continue;
    (result[team.day] ??= []).push(team.teamName);
  }
  return result;
});
