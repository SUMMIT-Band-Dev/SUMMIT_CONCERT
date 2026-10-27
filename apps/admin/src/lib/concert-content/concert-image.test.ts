import { describe, expect, it } from "vitest";
import { CARD_IMAGE_MESSAGES } from "@/lib/teams/card-image";
import { checkConcertImageFile, CONCERT_IMAGE_MAX_BYTES, CONCERT_IMAGE_TOO_LARGE_MESSAGE } from "./concert-image";

describe("공연 이미지 검사", () => {
  it("빈 파일과 2MB 초과를 먼저 거부한다", async () => {
    expect((await checkConcertImageFile(new File([], "empty.png"))).error).toBe(CARD_IMAGE_MESSAGES.required);
    expect((await checkConcertImageFile(new File([new Uint8Array(CONCERT_IMAGE_MAX_BYTES + 1)], "large.png"))).error).toBe(
      CONCERT_IMAGE_TOO_LARGE_MESSAGE,
    );
  });
  it.each([1.5 * 1024 * 1024, CONCERT_IMAGE_MAX_BYTES])("%i 바이트 PNG 시그니처는 허용한다", async (size) => {
    const bytes = new Uint8Array(size);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(await checkConcertImageFile(new File([bytes], "image.png"))).toEqual({ format: "png", error: null });
  });
  it("확장자 대신 실제 바이트를 검사한다", async () => {
    expect((await checkConcertImageFile(new File(["text"], "fake.png", { type: "image/png" }))).error).toBe(
      CARD_IMAGE_MESSAGES.unsupported,
    );
  });
  it("읽기 실패를 화면 문구로 바꾼다", async () => {
    const file = { size: 12, slice: () => ({ arrayBuffer: () => Promise.reject(new Error("읽기 실패")) }) } as unknown as File;
    expect((await checkConcertImageFile(file)).error).toBe(CARD_IMAGE_MESSAGES.unreadable);
  });
});
