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
  getVenue,
  updateVenue,
  geocodeAddress,
} from "./concert-content";

vi.mock("./client", () => ({ apiRequest: vi.fn() }));
beforeEach(() => {
  vi.mocked(apiRequest).mockReset();
});

describe("공연 콘텐츠 API", () => {
  it("공연장 조회는 signal과 응답을 그대로 전달한다", async () => {
    const signal = new AbortController().signal;
    const response = { id: "1", latitude: 37.552555, longitude: 126.91899 };
    vi.mocked(apiRequest).mockResolvedValueOnce(response);
    expect(await getVenue({ signal })).toBe(response);
    expect(apiRequest).toHaveBeenCalledExactlyOnceWith("/venue", { signal });
  });
  it("공연장 저장은 PUT 본문과 signal을 전달한다", async () => {
    const signal = new AbortController().signal;
    const input = {
      name: "공연장",
      address: "주소",
      addressDetail: "",
      latitude: 37.552555,
      longitude: 126.91899,
      naverMapUrl: "",
      websiteUrl: "",
    };
    const response = { data: input, revalidated: false };
    vi.mocked(apiRequest).mockResolvedValueOnce(response);
    expect(await updateVenue(input, { signal })).toBe(response);
    expect(apiRequest).toHaveBeenCalledExactlyOnceWith("/venue", { method: "PUT", body: input, signal });
  });
  it("주소 검색은 POST로 주소만 보내고 좌표 응답을 반환한다", async () => {
    const signal = new AbortController().signal;
    const response = { latitude: 37.552555, longitude: 126.91899, roadAddress: "도로명 주소" };
    vi.mocked(apiRequest).mockResolvedValueOnce(response);
    expect(await geocodeAddress("서울특별시 마포구 양화로 100-10", { signal })).toBe(response);
    expect(apiRequest).toHaveBeenCalledExactlyOnceWith("/venue/geocode", {
      method: "POST",
      body: { address: "서울특별시 마포구 양화로 100-10" },
      signal,
    });
  });
  it("공연장 검색·저장 오류를 숨기지 않는다", async () => {
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error("주소를 다시 확인하거나 지도에서 직접 위치를 지정해 주세요."));
    await expect(geocodeAddress("없는주소테스트12345")).rejects.toThrow("주소를 다시 확인하거나 지도에서 직접 위치를 지정해 주세요.");
  });
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
