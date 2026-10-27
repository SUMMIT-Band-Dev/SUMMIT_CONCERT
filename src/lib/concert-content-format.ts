export function formatHomeDateRange(start: string, end: string): string {
  return start === end ? start : `${start} ~ ${end}`;
}

export function formatTicketDateRange(start: string, end: string, showTime: string): string {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const startLabel = datePattern.test(start) ? start.replaceAll("-", ".") : start;
  let dateLabel = startLabel;
  if (start !== end) {
    let endLabel = end;
    if (datePattern.test(end)) {
      endLabel = end.replaceAll("-", ".");
      if (datePattern.test(start) && start.slice(0, 4) === end.slice(0, 4)) endLabel = endLabel.slice(5);
    }
    dateLabel += ` ~ ${endLabel}`;
  }
  return showTime.trim() ? `${dateLabel} / ${showTime.trim()}` : dateLabel;
}

export function formatBookingLineup(lineupOverride: string | null, autoLineup: readonly string[]): string {
  return lineupOverride?.trim() ? lineupOverride : autoLineup.join(", ");
}

export function formatTimetableTabLabel(dayKey: string, dayLabel: string): string {
  const match = /^day(\d+)$/.exec(dayKey);
  return match ? `${Number(match[1])}일차 공연` : dayLabel;
}
