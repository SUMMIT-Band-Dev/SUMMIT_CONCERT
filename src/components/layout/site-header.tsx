import { getPerformanceDays, getVenue } from "@/lib/concert-content";
import { formatTimetableTabLabel } from "@/lib/concert-content-format";
import SiteHeaderNav from "@/components/layout/site-header-nav";

export default async function SiteHeader() {
  const [days, venue] = await Promise.all([getPerformanceDays(), getVenue()]);
  const bookingItems = days.map((day) => ({
    label: formatTimetableTabLabel(day.dayKey, day.dayLabel),
    href: day.bookingUrl,
  }));
  return <SiteHeaderNav bookingItems={bookingItems} stageInfoUrl={venue.websiteUrl} />;
}
