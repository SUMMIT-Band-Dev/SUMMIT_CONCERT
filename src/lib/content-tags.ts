// apps/api/src/revalidation/content-tags.ts와 같은 값과 순서를 유지한다.
export const CONTENT_TAGS = ["concert", "venue", "performance-days", "ticket", "info-sections", "lineup"] as const;
export type ContentTag = (typeof CONTENT_TAGS)[number];

export function parseRevalidateTags(body: unknown): ContentTag[] | null {
  if (typeof body !== "object" || body === null || Array.isArray(body) || !("tags" in body)) return null;
  const { tags } = body;
  if (!Array.isArray(tags) || tags.length < 1 || tags.length > CONTENT_TAGS.length) return null;

  const result: ContentTag[] = [];
  for (const tag of tags) {
    const matched = CONTENT_TAGS.find((allowed) => allowed === tag);
    if (!matched) return null;
    if (!result.includes(matched)) result.push(matched);
  }
  return result;
}
