export type ConcertContent = {
  titleKo: string;
  titleEn: string;
  subtitle: string | null;
  startDate: string;
  endDate: string;
  showTime: string;
  posterImageUrl: string | null;
  titleImageUrl: string | null;
  subtitleImageUrl: string | null;
};

export type VenueContent = {
  name: string;
  address: string;
  addressDetail: string | null;
  latitude: number;
  longitude: number;
  naverMapUrl: string | null;
  websiteUrl: string | null;
};

export type PerformanceDayContent = {
  dayKey: string;
  dayLabel: string;
  dateLabel: string;
  bookingUrl: string | null;
  lineupOverride: string | null;
  timetableImageUrl: string | null;
};

export type TicketContent = {
  frontImageUrl: string | null;
  backImageUrl: string | null;
  description: string | null;
};

export const INFO_CATEGORIES = ["ticket", "notice"] as const;
export type InfoCategory = (typeof INFO_CATEGORIES)[number];

export type InfoSectionContent = {
  title: string;
  items: string[];
};
