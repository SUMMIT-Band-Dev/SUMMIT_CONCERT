import { describe, expect, it } from "vitest";
import { findNavItem, isNavActive, NAV_ITEMS } from "./nav";

describe("nav", () => {
  it("기존 메뉴 뒤에 공연 콘텐츠 메뉴를 명세 순서대로 둔다", () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      "팀 관리",
      "곡 관리",
      "유튜브 연결 관리",
      "공연 기본 정보",
      "일차별 공연",
      "티켓 안내",
      "관람 유의사항",
    ]);
    expect(NAV_ITEMS.slice(0, 3).every((item) => item.group === undefined)).toBe(true);
    expect(NAV_ITEMS.slice(3).map(({ href, group }) => ({ href, group }))).toEqual([
      { href: "/concert", group: "공연 콘텐츠" },
      { href: "/performance-days", group: "공연 콘텐츠" },
      { href: "/ticket", group: "공연 콘텐츠" },
      { href: "/notice", group: "공연 콘텐츠" },
    ]);
  });

  it("하위 경로도 그 메뉴에 속하지만 접두사만 같은 다른 경로는 아니다", () => {
    expect(isNavActive("/songs", "/songs")).toBe(true);
    expect(isNavActive("/songs/12", "/songs")).toBe(true);
    expect(isNavActive("/songsX", "/songs")).toBe(false);
    expect(isNavActive("/teams", "/songs")).toBe(false);
  });

  it("경로로 메뉴 항목을 찾는다", () => {
    expect(findNavItem("/youtube")?.label).toBe("유튜브 연결 관리");
    expect(findNavItem("/performance-days")?.label).toBe("일차별 공연");
    expect(findNavItem("/songs/5")?.label).toBe("곡 관리");
    expect(findNavItem("/nope")).toBeUndefined();
  });
});
