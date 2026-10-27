export const PUBLIC_PAGE_PATHS = {
  concert: "/",
  venue: "/location",
  performanceDays: "/time-table",
  ticket: "/ticket-info",
  notice: "/notice",
} as const;

export function buildPublicPageUrl(path: string, origin: string | undefined): string | null {
  if (!origin?.trim() || !path.startsWith("/") || path.startsWith("//")) return null;
  try {
    const url = new URL(origin.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return `${origin.trim().replace(/\/+$/, "")}${path}`;
  } catch {
    return null;
  }
}
