import { describe, expect, it } from "vitest";
import type { PerformanceDay } from "@/lib/api/types";
import {
  performanceDaySchema,
  toPerformanceDayFormValues,
  toPerformanceDayPayload,
  type PerformanceDayFormValues,
} from "./performance-day-schema";

const valid: PerformanceDayFormValues = {
  dayLabel: "Day 1",
  dateLabel: "6.25 (목) 18:00",
  bookingUrl: "",
  lineupMode: "auto",
  lineupText: "",
};
const day: PerformanceDay = {
  dayKey: "day1",
  dayLabel: valid.dayLabel,
  dateLabel: valid.dateLabel,
  bookingUrl: null,
  lineupOverride: null,
  autoLineup: ["팀 B", "팀 A"],
  timetableImageUrl: null,
  updatedAt: "2026-10-25",
};

describe("일차별 공연 폼", () => {
  it("자동 모드에서는 출연진 길이를 검사하지 않는다", () => {
    expect(performanceDaySchema.safeParse(valid).success).toBe(true);
    expect(performanceDaySchema.safeParse({ ...valid, lineupText: "가".repeat(1001) }).success).toBe(true);
  });
  it.each([
    ["lineupText", " ", "출연진 문구를 입력하거나 '자동으로 되돌리기'를 눌러 주세요."],
    ["lineupText", "가".repeat(1001), "출연진 문구는 1000자 이내로 입력해 주세요."],
    ["dayLabel", "", "일차 라벨은 1~50자로 입력해 주세요."],
    ["dayLabel", "가".repeat(51), "일차 라벨은 1~50자로 입력해 주세요."],
    ["dateLabel", "", "날짜 라벨은 1~100자로 입력해 주세요."],
    ["dateLabel", "가".repeat(101), "날짜 라벨은 1~100자로 입력해 주세요."],
  ])("직접 수정의 %s 검증", (field, value, message) => {
    const result = performanceDaySchema.safeParse({ ...valid, lineupMode: "manual", lineupText: "출연진", [field]: value });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe(message);
  });
  it("NULL은 자동 팀 순서를 쓰고 직접 수정 값은 유지한다", () => {
    expect(toPerformanceDayFormValues(day)).toEqual({ ...valid, lineupText: "팀 B, 팀 A" });
    expect(toPerformanceDayFormValues({ ...day, lineupOverride: "직접 쓴 출연진" })).toMatchObject({
      lineupMode: "manual",
      lineupText: "직접 쓴 출연진",
    });
  });
  it("자동 모드는 NULL, 직접 수정은 trim한 문구만 보낸다", () => {
    expect(toPerformanceDayPayload(valid)).toEqual({
      dayLabel: valid.dayLabel,
      dateLabel: valid.dateLabel,
      bookingUrl: "",
      lineupOverride: null,
    });
    expect(toPerformanceDayPayload({ ...valid, lineupMode: "manual", lineupText: " 출연진 " }).lineupOverride).toBe("출연진");
  });
});
