import { describe, expect, it } from "vitest";
import { NAVER_MAP_ORIGINS } from "@/lib/csp";
import { buildNaverMapScriptUrl, NAVER_MAP_SCRIPT_BASE_URL } from "./naver-map-script";

describe("네이버 지도 스크립트 주소", () => {
  it("Client ID를 trim하고 인코딩한다", () => {
    expect(buildNaverMapScriptUrl(" abc 1 ")).toBe("https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=abc%201");
    const url = new URL(buildNaverMapScriptUrl("a&b=1")!);
    expect(url.searchParams.get("ncpKeyId")).toBe("a&b=1");
    expect([...url.searchParams.keys()]).toEqual(["ncpKeyId"]);
  });
  it.each(["", "  ", undefined])("키가 비면 스크립트 주소를 만들지 않는다", (value) => {
    expect(buildNaverMapScriptUrl(value)).toBeNull();
  });
  it("고정 스크립트 주소는 CSP가 허용하는 오리진과 같다", () => {
    expect(new URL(NAVER_MAP_SCRIPT_BASE_URL).origin).toBe(NAVER_MAP_ORIGINS.script[0]);
    expect(NAVER_MAP_ORIGINS.script).toContain(new URL(buildNaverMapScriptUrl("abc")!).origin);
  });
});
