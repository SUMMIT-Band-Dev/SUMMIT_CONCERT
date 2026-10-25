import { describe, expect, it } from "vitest";
import { ALBUM_COVER_IMAGE_ORIGIN, NAVER_MAP_ORIGINS, buildContentSecurityPolicy, toOrigin } from "./csp";

function directive(csp: string, name: string): string[] {
  const found = csp.split("; ").find((d) => d.startsWith(`${name} `) || d === name);
  return found ? found.split(" ").slice(1) : [];
}

describe("toOrigin", () => {
  it("경로·끝 슬래시를 떼고 오리진만 돌려준다", () => {
    expect(toOrigin("https://api.example.com/")).toBe("https://api.example.com");
    expect(toOrigin("http://localhost:3001/some/path?x=1")).toBe("http://localhost:3001");
  });

  it("http(s)가 아니거나 형식이 틀리면 undefined", () => {
    expect(toOrigin(undefined)).toBeUndefined();
    expect(toOrigin("")).toBeUndefined();
    expect(toOrigin("not a url")).toBeUndefined();
    expect(toOrigin("javascript:alert(1)")).toBeUndefined();
    expect(toOrigin("ftp://example.com")).toBeUndefined();
  });
});

describe("buildContentSecurityPolicy", () => {
  const prod = { apiBaseUrl: "https://api.example.com", publicSiteOrigin: "https://site.example.com", isDev: false };

  it("운영: connect-src는 self와 API 오리진뿐이다", () => {
    expect(directive(buildContentSecurityPolicy(prod), "connect-src")).toEqual([
      "'self'",
      "https://api.example.com",
      ...NAVER_MAP_ORIGINS.connect,
    ]);
  });

  it("운영: 개발용 허용(unsafe-eval, ws)이 없고 upgrade-insecure-requests가 있다", () => {
    const csp = buildContentSecurityPolicy(prod);
    expect(directive(csp, "script-src")).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain("ws://");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("개발: unsafe-eval과 HMR 웹소켓을 허용하고 upgrade-insecure-requests는 뺀다", () => {
    const csp = buildContentSecurityPolicy({ apiBaseUrl: "http://localhost:3001", isDev: true });
    expect(directive(csp, "script-src")).toContain("'unsafe-eval'");
    expect(directive(csp, "connect-src")).toEqual(["'self'", "http://localhost:3001", "ws://localhost:*", ...NAVER_MAP_ORIGINS.connect]);
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("공개 사이트 오리진은 img-src에만 들어간다", () => {
    const csp = buildContentSecurityPolicy(prod);
    expect(directive(csp, "img-src")).toContain("https://site.example.com");
    expect(directive(csp, "connect-src")).not.toContain("https://site.example.com");
  });

  it("Supabase Storage 오리진도 img-src에만 들어간다 (업로드한 팀 카드 표시용)", () => {
    const csp = buildContentSecurityPolicy({ ...prod, supabaseStorageOrigin: "https://ref.supabase.co" });
    expect(directive(csp, "img-src")).toContain("https://ref.supabase.co");
    expect(directive(csp, "connect-src")).not.toContain("https://ref.supabase.co");
  });

  it("Storage 오리진은 와일드카드가 아니라 주어진 오리진 하나만 연다", () => {
    // *.supabase.co는 누구나 프로젝트를 만들 수 있어 img-src 유출 통로가 된다(csp.ts 주석 참조)
    const csp = buildContentSecurityPolicy({ ...prod, supabaseStorageOrigin: "https://ref.supabase.co" });
    expect(csp).not.toContain("*.supabase.co");
  });

  it("앨범 커버 호스트는 설정과 무관하게 img-src에 항상 있다 (서버 allowlist와 묶인 고정값)", () => {
    const csp = buildContentSecurityPolicy({ apiBaseUrl: "garbage", isDev: false });
    expect(directive(csp, "img-src")).toContain(ALBUM_COVER_IMAGE_ORIGIN);
    expect(directive(csp, "connect-src")).not.toContain(ALBUM_COVER_IMAGE_ORIGIN);
  });

  it("사용하지 않는 유튜브 썸네일 오리진을 허용하지 않는다", () => {
    expect(directive(buildContentSecurityPolicy(prod), "img-src")).not.toContain("https://i.ytimg.com");
  });

  it("값이 없거나 잘못되면 그 오리진을 넣지 않는다", () => {
    const csp = buildContentSecurityPolicy({
      apiBaseUrl: "garbage",
      publicSiteOrigin: undefined,
      supabaseStorageOrigin: "javascript:alert(1)",
      isDev: false,
    });
    expect(directive(csp, "connect-src")).toEqual(["'self'", ...NAVER_MAP_ORIGINS.connect]);
    expect(directive(csp, "img-src")).toEqual(["'self'", "data:", "blob:", ALBUM_COVER_IMAGE_ORIGIN, ...NAVER_MAP_ORIGINS.img]);
  });

  it("프레임·플러그인·base·form을 막는다", () => {
    const csp = buildContentSecurityPolicy(prod);
    expect(directive(csp, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(csp, "object-src")).toEqual(["'none'"]);
    expect(directive(csp, "base-uri")).toEqual(["'self'"]);
    expect(directive(csp, "form-action")).toEqual(["'self'"]);
  });

  it("네이버 지도 오리진은 명세의 고정값이다", () => {
    expect(NAVER_MAP_ORIGINS).toEqual({
      script: ["https://oapi.map.naver.com", "https://nrbe.pstatic.net"],
      img: ["https://nrbe.pstatic.net", "https://ssl.pstatic.net"],
      connect: ["https://kr-col-ext.nelo.navercorp.com"],
    });
  });

  it.each([prod, { apiBaseUrl: "garbage", isDev: false }, { isDev: true }])(
    "설정과 관계없이 필요한 지시어에만 지도 오리진을 허용한다",
    (options) => {
      const csp = buildContentSecurityPolicy(options);
      expect(directive(csp, "script-src")).toEqual([
        "'self'",
        "'unsafe-inline'",
        ...(options.isDev ? ["'unsafe-eval'"] : []),
        ...NAVER_MAP_ORIGINS.script,
      ]);
      for (const origin of NAVER_MAP_ORIGINS.img) expect(directive(csp, "img-src")).toContain(origin);
      for (const origin of NAVER_MAP_ORIGINS.connect) {
        expect(directive(csp, "connect-src")).toContain(origin);
        expect(directive(csp, "script-src")).not.toContain(origin);
        expect(directive(csp, "img-src")).not.toContain(origin);
      }
      for (const origin of [...NAVER_MAP_ORIGINS.script, ...NAVER_MAP_ORIGINS.img])
        expect(directive(csp, "connect-src")).not.toContain(origin);
      expect(directive(csp, "img-src")).not.toContain(NAVER_MAP_ORIGINS.script[0]);
      expect(directive(csp, "script-src")).not.toContain(NAVER_MAP_ORIGINS.img[1]);
      expect(csp).not.toMatch(/\*\.(?:pstatic\.net|naver\.com|navercorp\.com)/);
      expect(directive(csp, "default-src")).toEqual(["'self'"]);
      expect(directive(csp, "style-src")).toEqual(["'self'", "'unsafe-inline'"]);
      expect(directive(csp, "font-src")).toEqual(["'self'", "data:"]);
      expect(directive(csp, "frame-ancestors")).toEqual(["'none'"]);
      expect(directive(csp, "object-src")).toEqual(["'none'"]);
    },
  );
});
