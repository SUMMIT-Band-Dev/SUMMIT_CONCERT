export const CONTENT_BASE_ROW_NOT_FOUND =
  '공연 콘텐츠 기본 행이 없습니다. 마이그레이션 적용 여부를 확인해 주세요.';
export const PERFORMANCE_DAY_NOT_FOUND = '해당 공연 일차를 찾을 수 없습니다.';
export const HTTPS_URL_MESSAGE =
  'https로 시작하는 올바른 주소를 입력해 주세요.';
export const TITLE_MAX_LENGTH = 100;
export const SUBTITLE_MAX_LENGTH = 200;
export const SHOW_TIME_MAX_LENGTH = 50;
export const VENUE_NAME_MAX_LENGTH = 100;
export const ADDRESS_MAX_LENGTH = 200;
export const DAY_LABEL_MAX_LENGTH = 50;
export const DATE_LABEL_MAX_LENGTH = 100;
export const LINEUP_OVERRIDE_MAX_LENGTH = 1000;
export const TICKET_DESCRIPTION_MAX_LENGTH = 2000;
export const URL_MAX_LENGTH = 2048;
export const INFO_SECTIONS_MAX = 20;
export const INFO_ITEMS_MAX = 50;
export const INFO_TITLE_MAX_LENGTH = 100;
export const INFO_CONTENT_MAX_LENGTH = 500;
export const INFO_CATEGORIES = ['ticket', 'notice'] as const;
export type InfoCategory = (typeof INFO_CATEGORIES)[number];

// 버킷 상한과 같다. 공개 사이트는 next/image로 최적화해 내려보낸다(T5).
export const CONCERT_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const CONCERT_IMAGE_TOO_LARGE_MESSAGE =
  '이미지 크기는 2MB를 넘을 수 없습니다.';
export const CONCERT_IMAGE_SLOTS = ['poster', 'title', 'subtitle'] as const;
export const TICKET_IMAGE_SIDES = ['front', 'back'] as const;
