import { describe, expect, it } from "vitest";
import { ticketSchema } from "./ticket-schema";
describe("티켓 설명", () => {
  it("빈 값과 2000자를 허용하고 trim한다", () => {
    expect(ticketSchema.parse({ description: " " })).toEqual({ description: "" });
    expect(ticketSchema.safeParse({ description: "가".repeat(2000) }).success).toBe(true);
  });
  it("2001자는 서버 문구로 거부한다", () => {
    const result = ticketSchema.safeParse({ description: "가".repeat(2001) });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("티켓 설명은 2000자 이내로 입력해 주세요.");
  });
});
