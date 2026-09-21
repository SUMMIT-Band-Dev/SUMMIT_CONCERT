import { describe, expect, it } from "vitest";
import { ApiConfigError, parseApiBaseUrl } from "./config";

describe("parseApiBaseUrl", () => {
  it("오리진을 돌려주고 끝 슬래시를 정리한다", () => {
    expect(parseApiBaseUrl("http://localhost:3001")).toBe("http://localhost:3001");
    expect(parseApiBaseUrl("http://localhost:3001/")).toBe("http://localhost:3001");
    expect(parseApiBaseUrl("  https://api.example.com  ")).toBe("https://api.example.com");
    expect(parseApiBaseUrl("http://127.0.0.1:3012")).toBe("http://127.0.0.1:3012");
  });

  it("비어 있으면 설정 안내 오류", () => {
    expect(() => parseApiBaseUrl(undefined)).toThrow(ApiConfigError);
    expect(() => parseApiBaseUrl("   ")).toThrow(/설정되지 않았습니다/);
  });

  it("http는 루프백에서만 허용한다", () => {
    expect(() => parseApiBaseUrl("http://api.example.com")).toThrow(/로컬/);
    expect(() => parseApiBaseUrl("http://192.168.0.10:3001")).toThrow(/로컬/);
  });

  it("경로·쿼리·해시·자격증명·다른 스킴은 거부한다", () => {
    expect(() => parseApiBaseUrl("https://api.example.com/v1")).toThrow(ApiConfigError);
    expect(() => parseApiBaseUrl("https://api.example.com/?x=1")).toThrow(ApiConfigError);
    expect(() => parseApiBaseUrl("https://api.example.com/#a")).toThrow(ApiConfigError);
    expect(() => parseApiBaseUrl("https://user:pw@api.example.com")).toThrow(ApiConfigError);
    expect(() => parseApiBaseUrl("ftp://api.example.com")).toThrow(ApiConfigError);
    expect(() => parseApiBaseUrl("javascript:alert(1)")).toThrow(ApiConfigError);
    expect(() => parseApiBaseUrl("not a url")).toThrow(ApiConfigError);
  });

  it("오류 메시지에 입력 값을 싣지 않는다(잘못 붙여 넣은 비밀이 로그에 남지 않게)", () => {
    const secretLike = "https://user:SUPERSECRETVALUE@api.example.com";
    try {
      parseApiBaseUrl(secretLike);
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain("SUPERSECRETVALUE");
      expect((error as Error).message).not.toContain("api.example.com");
    }
  });
});
