import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, toOrigin } from "./csp";

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
    expect(directive(buildContentSecurityPolicy(prod), "connect-src")).toEqual(["'self'", "https://api.example.com"]);
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
    expect(directive(csp, "connect-src")).toEqual(["'self'", "http://localhost:3001", "ws://localhost:*"]);
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("공개 사이트 오리진은 img-src에만 들어간다", () => {
    const csp = buildContentSecurityPolicy(prod);
    expect(directive(csp, "img-src")).toContain("https://site.example.com");
    expect(directive(csp, "connect-src")).not.toContain("https://site.example.com");
  });

  it("값이 없거나 잘못되면 그 오리진을 넣지 않는다", () => {
    const csp = buildContentSecurityPolicy({ apiBaseUrl: "garbage", publicSiteOrigin: undefined, isDev: false });
    expect(directive(csp, "connect-src")).toEqual(["'self'"]);
    expect(directive(csp, "img-src")).toEqual(["'self'", "data:", "blob:"]);
  });

  it("프레임·플러그인·base·form을 막는다", () => {
    const csp = buildContentSecurityPolicy(prod);
    expect(directive(csp, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(csp, "object-src")).toEqual(["'none'"]);
    expect(directive(csp, "base-uri")).toEqual(["'self'"]);
    expect(directive(csp, "form-action")).toEqual(["'self'"]);
  });
});
