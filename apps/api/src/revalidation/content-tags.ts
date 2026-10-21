// 공개 사이트 src/lib/content-tags.ts(T5에서 생성)와 같은 값을 유지한다.
export const CONTENT_TAGS = [
  'concert',
  'venue',
  'performance-days',
  'ticket',
  'info-sections',
  'lineup',
] as const;
export type ContentTag = (typeof CONTENT_TAGS)[number];
