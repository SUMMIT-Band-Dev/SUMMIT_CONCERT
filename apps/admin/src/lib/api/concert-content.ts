// 미러링: apps/api/src/concert-content/*.controller.ts
import { apiRequest, type ApiRequestOptions } from "./client";
import { CARD_IMAGE_FIELD_NAME } from "./teams";
import type { Concert, PerformanceDay, Ticket, InfoSection, SaveResult, Venue, GeocodeResult } from "./types";

export const CONCERT_IMAGE_SLOTS = ["poster", "title", "subtitle"] as const;
export const TICKET_IMAGE_SIDES = ["front", "back"] as const;
export const INFO_CATEGORIES = ["ticket", "notice"] as const;
export type ConcertImageSlot = (typeof CONCERT_IMAGE_SLOTS)[number];
export type TicketImageSide = (typeof TICKET_IMAGE_SIDES)[number];
export type InfoCategory = (typeof INFO_CATEGORIES)[number];

// 파일 전송과 서버 저장소 왕복을 고려해 팀 이미지 필드와 같은 30초를 쓴다.
export const CONCERT_IMAGE_UPLOAD_TIMEOUT_MS = 30_000;
type RequestOptions = Pick<ApiRequestOptions, "signal">;
type UploadOptions = Pick<ApiRequestOptions, "signal" | "timeoutMs">;
export type UpdateConcertInput = Pick<Concert, "titleKo" | "titleEn" | "subtitle" | "startDate" | "endDate" | "showTime">;
export type UpdatePerformanceDayInput = Pick<PerformanceDay, "dayLabel" | "dateLabel" | "bookingUrl" | "lineupOverride">;
export type UpdateTicketInput = Pick<Ticket, "description">;
export type UpdateVenueInput = Pick<Venue, "name" | "address" | "addressDetail" | "latitude" | "longitude" | "naverMapUrl" | "websiteUrl">;
export interface UpdateInfoSectionsInput {
  sections: { title: string; items: { content: string }[] }[];
}

export function getConcert(options: RequestOptions = {}): Promise<Concert> {
  return apiRequest("/concert", options);
}

export function getVenue(options: RequestOptions = {}): Promise<Venue> {
  return apiRequest("/venue", options);
}
export function updateVenue(input: UpdateVenueInput, options: RequestOptions = {}): Promise<SaveResult<Venue>> {
  return apiRequest("/venue", { method: "PUT", body: input, ...options });
}
export function geocodeAddress(address: string, options: RequestOptions = {}): Promise<GeocodeResult> {
  return apiRequest("/venue/geocode", { method: "POST", body: { address }, ...options });
}
export function updateConcert(input: UpdateConcertInput, options: RequestOptions = {}): Promise<SaveResult<Concert>> {
  return apiRequest("/concert", { method: "PUT", body: input, ...options });
}
export function listPerformanceDays(options: RequestOptions = {}): Promise<PerformanceDay[]> {
  return apiRequest("/performance-days", options);
}
export function updatePerformanceDay(
  dayKey: string,
  input: UpdatePerformanceDayInput,
  options: RequestOptions = {},
): Promise<SaveResult<PerformanceDay>> {
  return apiRequest(`/performance-days/${encodeURIComponent(dayKey)}`, { method: "PUT", body: input, ...options });
}
export function getTicket(options: RequestOptions = {}): Promise<Ticket> {
  return apiRequest("/ticket", options);
}
export function updateTicket(input: UpdateTicketInput, options: RequestOptions = {}): Promise<SaveResult<Ticket>> {
  return apiRequest("/ticket", { method: "PUT", body: input, ...options });
}
export function listInfoSections(category: InfoCategory, options: RequestOptions = {}): Promise<InfoSection[]> {
  return apiRequest(`/info-sections?category=${encodeURIComponent(category)}`, options);
}
export function updateInfoSections(
  category: InfoCategory,
  input: UpdateInfoSectionsInput,
  options: RequestOptions = {},
): Promise<SaveResult<InfoSection[]>> {
  return apiRequest(`/info-sections?category=${encodeURIComponent(category)}`, { method: "PUT", body: input, ...options });
}
export function uploadConcertImage(slot: ConcertImageSlot, file: File, options: UploadOptions = {}): Promise<SaveResult<Concert>> {
  const body = new FormData();
  body.append(CARD_IMAGE_FIELD_NAME, file);
  return apiRequest(`/concert/images/${encodeURIComponent(slot)}`, {
    method: "PUT",
    body,
    timeoutMs: CONCERT_IMAGE_UPLOAD_TIMEOUT_MS,
    ...options,
  });
}
export function uploadTimetableImage(dayKey: string, file: File, options: UploadOptions = {}): Promise<SaveResult<PerformanceDay>> {
  const body = new FormData();
  body.append(CARD_IMAGE_FIELD_NAME, file);
  return apiRequest(`/performance-days/${encodeURIComponent(dayKey)}/timetable-image`, {
    method: "PUT",
    body,
    timeoutMs: CONCERT_IMAGE_UPLOAD_TIMEOUT_MS,
    ...options,
  });
}
export function uploadTicketImage(side: TicketImageSide, file: File, options: UploadOptions = {}): Promise<SaveResult<Ticket>> {
  const body = new FormData();
  body.append(CARD_IMAGE_FIELD_NAME, file);
  return apiRequest(`/ticket/images/${encodeURIComponent(side)}`, {
    method: "PUT",
    body,
    timeoutMs: CONCERT_IMAGE_UPLOAD_TIMEOUT_MS,
    ...options,
  });
}
