import { describe, expect, it } from "vitest";
import { formatSessionRemaining, isSessionExpiringSoon, SESSION_WARNING_MS } from "./session-remaining";

const min = (n: number) => n * 60_000;

describe("formatSessionRemaining", () => {
  it.each([
    [min(120), "2시간"],
    [min(102), "1시간 42분"],
    [min(61), "1시간 1분"],
    [min(60), "1시간"],
    [min(59) + 59_000, "59분"],
    [min(42), "42분"],
    [min(1), "1분"],
    [59_999, "1분 미만"],
    [1, "1분 미만"],
    [0, "만료됨"],
    [-5000, "만료됨"],
  ])("%i ms → %s", (ms, text) => {
    expect(formatSessionRemaining(ms)).toBe(text);
  });
});

describe("isSessionExpiringSoon", () => {
  it("10분 이하로 남으면 경고", () => {
    expect(isSessionExpiringSoon(SESSION_WARNING_MS)).toBe(true);
    expect(isSessionExpiringSoon(SESSION_WARNING_MS + 1)).toBe(false);
    expect(isSessionExpiringSoon(0)).toBe(true);
  });
});
