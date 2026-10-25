// 관리자 메뉴 정의: 팀·곡·유튜브 연결 관리 / 공연 콘텐츠(기본 정보·공연장 정보·일차별 공연·티켓·유의사항).
// 사이드바·상단 바 경로 표시가 함께 쓰는 유일한 출처다.
// 아이콘은 표현 계층의 일이라 components/layout/sidebar.tsx 가 href 로 짝지어 쓴다.

export interface NavItem {
  href: string;
  label: string;
  group?: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/teams", label: "팀 관리" },
  { href: "/songs", label: "곡 관리" },
  { href: "/youtube", label: "유튜브 연결 관리" },
  { href: "/concert", label: "공연 기본 정보", group: "공연 콘텐츠" },
  { href: "/venue", label: "공연장 정보", group: "공연 콘텐츠" },
  { href: "/performance-days", label: "일차별 공연", group: "공연 콘텐츠" },
  { href: "/ticket", label: "티켓 안내", group: "공연 콘텐츠" },
  { href: "/notice", label: "관람 유의사항", group: "공연 콘텐츠" },
];

export const BRAND_NAME = "SUMMIT 관리자";

/** 경로가 메뉴 항목(또는 그 하위 경로)에 속하는지 */
export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** 현재 경로에 해당하는 메뉴 항목. 없으면 undefined */
export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => isNavActive(pathname, item.href));
}
