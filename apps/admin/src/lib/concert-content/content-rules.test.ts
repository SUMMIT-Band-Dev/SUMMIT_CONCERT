import { describe, expect, it } from "vitest";
import { optionalHttpsUrl } from "./content-rules";

describe("선택 HTTPS 주소", () => {
  it.each(["", "   ", "https://forms.gle/abc", " https://forms.gle/abc "])("허용: %s", (value) => {
    expect(optionalHttpsUrl.safeParse(value).success).toBe(true);
  });
  it.each([
    "http://example.com",
    "javascript:alert(1)",
    "https://user:pw@example.com",
    "https://example.com/" + "a".repeat(2029),
    "주소 아님",
  ])("거부: %s", (value) => {
    const result = optionalHttpsUrl.safeParse(value);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("https로 시작하는 올바른 주소를 입력해 주세요.");
  });
  it("2048자까지 허용하고 결과를 trim한다", () => {
    const value = "https://example.com/" + "a".repeat(2028);
    expect(optionalHttpsUrl.parse(` ${value} `)).toBe(value);
  });
});
