import { describe, expect, it } from "vitest";
import { findNavItem, isNavActive, NAV_ITEMS } from "./nav";

describe("nav", () => {
  it("메뉴는 PRD 순서(팀 → 곡 → 유튜브)다", () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual(["팀 관리", "곡 관리", "유튜브 연결 관리"]);
  });

  it("하위 경로도 그 메뉴에 속하지만 접두사만 같은 다른 경로는 아니다", () => {
    expect(isNavActive("/songs", "/songs")).toBe(true);
    expect(isNavActive("/songs/12", "/songs")).toBe(true);
    expect(isNavActive("/songsX", "/songs")).toBe(false);
    expect(isNavActive("/teams", "/songs")).toBe(false);
  });

  it("경로로 메뉴 항목을 찾는다", () => {
    expect(findNavItem("/youtube")?.label).toBe("유튜브 연결 관리");
    expect(findNavItem("/songs/5")?.label).toBe("곡 관리");
    expect(findNavItem("/nope")).toBeUndefined();
  });
});
