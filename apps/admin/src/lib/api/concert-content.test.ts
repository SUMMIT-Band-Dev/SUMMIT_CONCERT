import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./client";
import {
  CONCERT_IMAGE_SLOTS,
  TICKET_IMAGE_SIDES,
  INFO_CATEGORIES,
  getConcert,
  updateConcert,
  listPerformanceDays,
  updatePerformanceDay,
  getTicket,
  updateTicket,
  listInfoSections,
  updateInfoSections,
  uploadConcertImage,
  uploadTimetableImage,
  uploadTicketImage,
} from "./concert-content";

vi.mock("./client", () => ({ apiRequest: vi.fn() }));
beforeEach(() => {
  vi.mocked(apiRequest).mockReset();
});

describe("공연 콘텐츠 API", () => {
  it("조회 4종은 signal을 전달하고 응답을 그대로 반환한다", async () => {
    const signal = new AbortController().signal;
    const calls = [
      { run: () => getConcert({ signal }), path: "/concert" },
      { run: () => listPerformanceDays({ signal }), path: "/performance-days" },
      { run: () => getTicket({ signal }), path: "/ticket" },
      { run: () => listInfoSections("notice", { signal }), path: "/info-sections?category=notice" },
    ];
    for (const { run, path } of calls) {
      const response = { value: path };
      vi.mocked(apiRequest).mockResolvedValueOnce(response);
      expect(await run()).toBe(response);
      expect(apiRequest).toHaveBeenLastCalledWith(path, { signal });
    }
  });
  it("공연·일차·티켓·안내 저장은 PUT 본문을 전달한다", async () => {
    const signal = new AbortController().signal;
    const concert = { titleKo: "공연", titleEn: "SUMMIT", subtitle: "", startDate: "2026-06-25", endDate: "2026-06-26", showTime: "18:00" };
    const day = { dayLabel: "Day 1", dateLabel: "6.25", bookingUrl: "", lineupOverride: null };
    const ticket = { description: "안내" };
    const sections = { sections: [{ title: "요금", items: [{ content: "입장 안내" }] }] };
    const calls = [
      { run: () => updateConcert(concert, { signal }), path: "/concert", body: concert },
      { run: () => updatePerformanceDay("day 1", day, { signal }), path: "/performance-days/day%201", body: day },
      { run: () => updateTicket(ticket, { signal }), path: "/ticket", body: ticket },
      { run: () => updateInfoSections("ticket", sections, { signal }), path: "/info-sections?category=ticket", body: sections },
    ];
    for (const { run, path, body } of calls) {
      const response = { data: body, revalidated: false };
      vi.mocked(apiRequest).mockResolvedValueOnce(response);
      expect(await run()).toBe(response);
      expect(apiRequest).toHaveBeenLastCalledWith(path, { method: "PUT", body, signal });
    }
  });
  it("기존 서버의 허용 슬롯·분류와 일치한다", () => {
    expect(CONCERT_IMAGE_SLOTS).toEqual(["poster", "title", "subtitle"]);
    expect(TICKET_IMAGE_SIDES).toEqual(["front", "back"]);
    expect(INFO_CATEGORIES).toEqual(["ticket", "notice"]);
  });
  it("업로드 3종은 file 필드 하나와 30초 타임아웃을 사용한다", async () => {
    const file = new File(["image"], "image.png", { type: "image/png" });
    const calls = [
      { run: () => uploadConcertImage("poster", file), path: "/concert/images/poster" },
      { run: () => uploadTimetableImage("day 1", file), path: "/performance-days/day%201/timetable-image" },
      { run: () => uploadTicketImage("back", file), path: "/ticket/images/back" },
    ];
    for (const { run, path } of calls) {
      const response = { data: {}, revalidated: true };
      vi.mocked(apiRequest).mockResolvedValueOnce(response);
      expect(await run()).toBe(response);
      expect(apiRequest).toHaveBeenLastCalledWith(path, { method: "PUT", body: expect.any(FormData), timeoutMs: 30000 });
      const body = vi.mocked(apiRequest).mock.lastCall?.[1]?.body as FormData;
      expect([...body.keys()]).toEqual(["file"]);
      expect(body.get("file")).toBe(file);
    }
  });
  it("업로드의 signal과 명시적 타임아웃을 보존한다", async () => {
    const signal = new AbortController().signal;
    const file = new File(["image"], "image.png");
    await uploadConcertImage("title", file, { signal, timeoutMs: 5000 });
    expect(apiRequest).toHaveBeenLastCalledWith("/concert/images/title", expect.objectContaining({ signal, timeoutMs: 5000 }));
    await uploadTimetableImage("day2", file, { signal, timeoutMs: 6000 });
    expect(apiRequest).toHaveBeenLastCalledWith(
      "/performance-days/day2/timetable-image",
      expect.objectContaining({ signal, timeoutMs: 6000 }),
    );
    await uploadTicketImage("front", file, { signal, timeoutMs: 7000 });
    expect(apiRequest).toHaveBeenLastCalledWith("/ticket/images/front", expect.objectContaining({ signal, timeoutMs: 7000 }));
  });
  it("전송 실패를 호출자에게 전달한다", async () => {
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error("저장 실패"));
    await expect(updateTicket({ description: "" })).rejects.toThrow("저장 실패");
  });
});
