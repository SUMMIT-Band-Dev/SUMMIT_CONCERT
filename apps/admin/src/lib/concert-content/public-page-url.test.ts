import { describe, expect, it } from "vitest";
import { buildPublicPageUrl, PUBLIC_PAGE_PATHS } from "./public-page-url";
describe("공개 페이지 주소", () => {
  it("끝 슬래시를 정리하고 공개 경로를 붙인다", () => {
    expect(buildPublicPageUrl("/notice", "https://summit-concert.live/")).toBe("https://summit-concert.live/notice");
    expect(buildPublicPageUrl("/", "https://summit-concert.live")).toBe("https://summit-concert.live/");
    expect(buildPublicPageUrl("/notice", "http://localhost:3000/")).toBe("http://localhost:3000/notice");
    expect(PUBLIC_PAGE_PATHS).toEqual({
      concert: "/",
      venue: "/location",
      performanceDays: "/time-table",
      ticket: "/ticket-info",
      notice: "/notice",
    });
    expect(buildPublicPageUrl(PUBLIC_PAGE_PATHS.venue, "https://summit-concert.live")).toBe("https://summit-concert.live/location");
  });
  it.each([undefined, "", " ", "javascript:alert(1)", "주소 아님"])("유효한 오리진이 없으면 링크를 숨긴다", (origin) => {
    expect(buildPublicPageUrl("/notice", origin)).toBeNull();
  });
  it("슬래시 없는 경로나 외부 호스트 경로를 거부한다", () => {
    expect(buildPublicPageUrl("notice", "https://summit-concert.live")).toBeNull();
    expect(buildPublicPageUrl("//example.com", "https://summit-concert.live")).toBeNull();
  });
});
