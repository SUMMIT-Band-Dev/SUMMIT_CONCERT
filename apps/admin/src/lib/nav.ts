// 관리자 메뉴 정의(PRD 메뉴 구조: 팀 관리 / 곡 관리 / 유튜브 연결 관리). 사이드바·상단 바 경로 표시가 함께 쓰는 유일한 출처다.
// 아이콘은 표현 계층의 일이라 components/layout/sidebar.tsx 가 href 로 짝지어 쓴다.

export interface NavItem {
  href: string;
  label: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/teams", label: "팀 관리" },
  { href: "/songs", label: "곡 관리" },
  { href: "/youtube", label: "유튜브 연결 관리" },
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
