import { describe, expect, it } from "vitest";
import { concertSchema } from "./concert-schema";

const valid = {
  titleKo: "공연",
  titleEn: "SUMMIT",
  subtitle: "",
  startDate: "2026-06-25",
  endDate: "2026-06-26",
  showTime: "18:00 ~ 21:00",
};

describe("공연 정보 폼", () => {
  it("문자열을 trim하고 같은 시작·종료일을 허용한다", () => {
    expect(concertSchema.parse({ ...valid, titleKo: " 공연 ", endDate: valid.startDate }).titleKo).toBe("공연");
  });
  it.each(["2026-02-30", "2026-02-29", "2026-13-01", "2026-6-01", ""])("실제 날짜가 아니면 거부: %s", (startDate) => {
    const result = concertSchema.safeParse({ ...valid, startDate });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: ["startDate"], message: "날짜는 YYYY-MM-DD 형식의 실제 날짜로 입력해 주세요." }),
      );
  });
  it("윤년의 실제 날짜를 허용한다", () => {
    expect(concertSchema.safeParse({ ...valid, startDate: "2028-02-29", endDate: "2028-02-29" }).success).toBe(true);
  });
  it("역전된 기간의 오류는 종료일에 표시한다", () => {
    const result = concertSchema.safeParse({ ...valid, endDate: "2026-06-24" });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: ["endDate"], message: "종료일은 시작일보다 빠를 수 없습니다." }),
      );
  });
  it.each([
    ["titleKo", " ", "국문 제목은 1~100자로 입력해 주세요."],
    ["titleKo", "가".repeat(101), "국문 제목은 1~100자로 입력해 주세요."],
    ["titleEn", "", "영문 제목은 1~100자로 입력해 주세요."],
    ["titleEn", "a".repeat(101), "영문 제목은 1~100자로 입력해 주세요."],
    ["subtitle", "가".repeat(201), "부제는 200자 이내로 입력해 주세요."],
    ["showTime", "", "공연 시간은 1~50자로 입력해 주세요."],
    ["showTime", "가".repeat(51), "공연 시간은 1~50자로 입력해 주세요."],
  ])("%s 길이 제한과 문구", (field, value, message) => {
    const result = concertSchema.safeParse({ ...valid, [field]: value });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe(message);
  });
  it("각 필드 최대 길이는 허용한다", () => {
    expect(
      concertSchema.safeParse({
        ...valid,
        titleKo: "가".repeat(100),
        titleEn: "a".repeat(100),
        subtitle: "가".repeat(200),
        showTime: "가".repeat(50),
      }).success,
    ).toBe(true);
  });
});
