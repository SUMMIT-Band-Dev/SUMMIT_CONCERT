import type {
  ConcertModel,
  VenueModel,
  PerformanceDayModel,
  TicketModel,
  InfoSectionModel,
  InfoItemModel,
} from '../../generated/prisma/models.js';

export interface ConcertResponse {
  titleKo: string;
  titleEn: string;
  subtitle: string | null;
  startDate: string;
  endDate: string;
  showTime: string;
  posterImageUrl: string | null;
  titleImageUrl: string | null;
  subtitleImageUrl: string | null;
  venue: { id: string; name: string; address: string };
  updatedAt: string;
}
export interface VenueResponse {
  id: string;
  name: string;
  address: string;
  addressDetail: string | null;
  latitude: number;
  longitude: number;
  naverMapUrl: string | null;
  websiteUrl: string | null;
  updatedAt: string;
}
export interface PerformanceDayResponse {
  dayKey: string;
  dayLabel: string;
  dateLabel: string;
  bookingUrl: string | null;
  lineupOverride: string | null;
  timetableImageUrl: string | null;
  autoLineup: string[];
  updatedAt: string;
}
export interface TicketResponse {
  frontImageUrl: string | null;
  backImageUrl: string | null;
  description: string | null;
  updatedAt: string;
}
export interface InfoSectionResponse {
  id: string;
  title: string;
  items: { id: string; content: string }[];
}

export function toConcertResponse(
  row: ConcertModel & { venue: VenueModel },
): ConcertResponse {
  return {
    titleKo: row.titleKo,
    titleEn: row.titleEn,
    subtitle: row.subtitle,
    startDate: row.startDate.toISOString().slice(0, 10),
    endDate: row.endDate.toISOString().slice(0, 10),
    showTime: row.showTime,
    posterImageUrl: row.posterImageUrl,
    titleImageUrl: row.titleImageUrl,
    subtitleImageUrl: row.subtitleImageUrl,
    venue: {
      id: row.venue.id.toString(),
      name: row.venue.name,
      address: row.venue.address,
    },
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toVenueResponse(row: VenueModel): VenueResponse {
  return {
    id: row.id.toString(),
    name: row.name,
    address: row.address,
    addressDetail: row.addressDetail,
    latitude: row.latitude.toNumber(),
    longitude: row.longitude.toNumber(),
    naverMapUrl: row.naverMapUrl,
    websiteUrl: row.websiteUrl,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPerformanceDayResponse(
  row: PerformanceDayModel,
  autoLineup: string[],
): PerformanceDayResponse {
  return {
    dayKey: row.dayKey,
    dayLabel: row.dayLabel,
    dateLabel: row.dateLabel,
    bookingUrl: row.bookingUrl,
    lineupOverride: row.lineupOverride,
    timetableImageUrl: row.timetableImageUrl,
    autoLineup,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toTicketResponse(row: TicketModel): TicketResponse {
  return {
    frontImageUrl: row.frontImageUrl,
    backImageUrl: row.backImageUrl,
    description: row.description,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toInfoSectionResponse(
  row: InfoSectionModel & { items: InfoItemModel[] },
): InfoSectionResponse {
  return {
    id: row.id.toString(),
    title: row.title,
    items: row.items.map((item) => ({
      id: item.id.toString(),
      content: item.content,
    })),
  };
}
