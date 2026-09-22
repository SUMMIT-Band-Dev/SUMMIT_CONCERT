import { describe, expect, it } from "vitest";
import {
  CARD_IMAGE_MAX_BYTES,
  CARD_IMAGE_MESSAGES,
  checkCardImageFile,
  detectImageFormat,
  resolveCardImageUrl,
} from "./card-image";

// 서버(apps/api/src/storage/image-type.ts)와 같은 판정을 하는지 고정한다.
// 여기가 서버보다 느슨하면 "화면은 통과, 서버는 400"이 되고, 더 빡빡하면 올릴 수 있는 파일을 막는다.

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, // "RIFF"
  0x24, 0x00, 0x00, 0x00, // 길이(임의)
  0x57, 0x45, 0x42, 0x50, // "WEBP"
]);

/**
 * 바이트로 File을 만든다. `padTo`를 주면 그 크기까지 0으로 채운다(크기 상한 검사용).
 *
 * 백킹 버퍼를 `new ArrayBuffer`로 직접 잡는 이유는 타입 때문이다 — `Uint8Array<ArrayBufferLike>`는
 * `SharedArrayBuffer`일 수도 있다고 보여 `BlobPart`에 그대로 들어가지 않는다
 * (API의 supabase-storage.client.ts도 같은 이유로 한 번 복사한다).
 */
function fileOf(bytes: Uint8Array, name = "test.png", padTo?: number): File {
  const size = padTo ?? bytes.length;
  const body = new Uint8Array(new ArrayBuffer(size));
  body.set(bytes.subarray(0, Math.min(bytes.length, size)));
  return new File([body], name);
}

function textFileOf(text: string, name: string): File {
  return fileOf(new Uint8Array(new TextEncoder().encode(text)), name);
}

describe("detectImageFormat", () => {
  it("JPEG·PNG·WebP 시그니처를 판별한다", () => {
    expect(detectImageFormat(JPEG)).toBe("jpeg");
    expect(detectImageFormat(PNG)).toBe("png");
    expect(detectImageFormat(WEBP)).toBe("webp");
  });

  it("SVG·텍스트·빈 바이트는 null이다 (SVG는 저장형 XSS 경로라 서버도 거부한다)", () => {
    const encode = (text: string) => new Uint8Array(new TextEncoder().encode(text));
    expect(detectImageFormat(encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(detectImageFormat(encode("hello"))).toBeNull();
    expect(detectImageFormat(new Uint8Array())).toBeNull();
  });

  it("RIFF로 시작해도 8~11바이트가 WEBP가 아니면 null이다 (WAV 등)", () => {
    const wav = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]);
    expect(detectImageFormat(wav)).toBeNull();
  });

  it("RIFF 뒤가 잘려 12바이트가 안 되면 null이다", () => {
    expect(detectImageFormat(WEBP.subarray(0, 11))).toBeNull();
  });
});

describe("checkCardImageFile", () => {
  it("허용 형식이면 형식을 돌려주고 오류가 없다", async () => {
    await expect(checkCardImageFile(fileOf(PNG))).resolves.toEqual({ format: "png", error: null });
  });

  it("빈 파일은 첨부 안내로 막는다", async () => {
    await expect(checkCardImageFile(new File([], "empty.png"))).resolves.toEqual({
      format: null,
      error: CARD_IMAGE_MESSAGES.required,
    });
  });

  it("1MB를 넘으면 형식을 보기 전에 크기로 막는다 (서버도 multer가 먼저 막는다)", async () => {
    const tooLarge = fileOf(PNG, "big.png", CARD_IMAGE_MAX_BYTES + 1);
    await expect(checkCardImageFile(tooLarge)).resolves.toEqual({
      format: null,
      error: CARD_IMAGE_MESSAGES.tooLarge,
    });
  });

  it("정확히 1MB는 통과한다 (상한은 초과부터 거부)", async () => {
    const exact = fileOf(PNG, "exact.png", CARD_IMAGE_MAX_BYTES);
    await expect(checkCardImageFile(exact)).resolves.toMatchObject({ format: "png", error: null });
  });

  it("확장자가 .png여도 바이트가 이미지가 아니면 거부한다 (확장자를 믿지 않는다)", async () => {
    await expect(checkCardImageFile(textFileOf("not an image", "fake.png"))).resolves.toEqual({
      format: null,
      error: CARD_IMAGE_MESSAGES.unsupported,
    });
  });

  it("확장자가 .png인데 실제로 JPEG면 JPEG로 판별한다 (이 레포 실데이터의 사례)", async () => {
    await expect(checkCardImageFile(fileOf(JPEG, "day1-team1.png"))).resolves.toMatchObject({ format: "jpeg" });
  });
});

describe("resolveCardImageUrl", () => {
  const origin = "https://summit-concert.live";

  it("절대 URL은 그대로 쓴다 (업로드한 Storage 이미지)", () => {
    const url = "https://ref.supabase.co/storage/v1/object/public/team-cards/1/uuid.png";
    expect(resolveCardImageUrl(url, origin)).toBe(url);
  });

  it("상대경로는 공개 사이트 오리진을 앞에 붙인다 (기존 15팀의 image_src)", () => {
    expect(resolveCardImageUrl("/day1-team1.png", origin)).toBe(`${origin}/day1-team1.png`);
    expect(resolveCardImageUrl("/day1-team1.png", `${origin}/`)).toBe(`${origin}/day1-team1.png`);
  });

  it("상대경로인데 오리진이 없으면 null이다 (미리보기를 만들 수 없다)", () => {
    expect(resolveCardImageUrl("/day1-team1.png", undefined)).toBeNull();
    expect(resolveCardImageUrl("/day1-team1.png", "  ")).toBeNull();
  });

  it("값이 없거나 해석할 수 없는 형태면 null이다", () => {
    expect(resolveCardImageUrl(null, origin)).toBeNull();
    expect(resolveCardImageUrl("day1-team1.png", origin)).toBeNull();
    expect(resolveCardImageUrl("javascript:alert(1)", origin)).toBeNull();
  });
});
