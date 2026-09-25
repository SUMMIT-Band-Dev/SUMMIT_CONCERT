// 카드뉴스 이미지 업로드의 클라이언트 측 규칙.
//
// 서버(apps/api/src/storage/storage.constants.ts, image-type.ts)와 **같은 규칙, 같은 문구**다.
// 여기서 먼저 막는 이유는 1MB 파일을 올렸다가 413을 받는 왕복을 없애기 위해서다.
// 서버 규칙이 바뀌면 이 파일도 함께 바꾼다 — 어긋나면 "화면은 통과시켰는데 서버가 거부"가 된다.
//
// ⚠️ 이 검사는 편의이지 보안 경계가 아니다. 실제 판별은 서버가 매직바이트로 다시 한다.

export const CARD_IMAGE_MAX_BYTES = 1024 * 1024;

/** input[type=file]의 accept. 편의용 필터일 뿐이고 실제 판별은 매직바이트가 한다 */
export const CARD_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

export const CARD_IMAGE_MESSAGES = {
  required: "이미지 파일을 첨부해 주세요.",
  unsupported: "JPEG, PNG, WebP 이미지만 업로드할 수 있습니다.",
  tooLarge: "이미지 크기는 1MB를 넘을 수 없습니다.",
  unreadable: "파일을 읽지 못했습니다. 다른 파일로 다시 시도해 주세요.",
} as const;

export type CardImageFormat = "jpeg" | "png" | "webp";

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50]; // "WEBP"
/** WebP 판별에 12바이트가 필요하다(0~3 RIFF, 4~7 길이, 8~11 WEBP) */
export const CARD_IMAGE_SIGNATURE_BYTES = 12;

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((value, index) => bytes[offset + index] === value);
}

/**
 * 앞부분 바이트로 이미지 형식을 판별한다. 서버 `detectImageFormat`과 같은 판정이다.
 *
 * **파일명 확장자와 File.type을 쓰지 않는다** — 이 레포의 실데이터(`day{1,2}-team*.png` 15개)가
 * 확장자는 .png인데 실제 바이트는 JPEG였다. 브라우저의 File.type도 확장자에서 추측한 값이다.
 * SVG는 어떤 시그니처와도 맞지 않아 자연히 null이 된다(서버와 동일 — 저장형 XSS 방지).
 */
export function detectImageFormat(bytes: Uint8Array): CardImageFormat | null {
  if (startsWith(bytes, JPEG_SIGNATURE)) return "jpeg";
  if (startsWith(bytes, PNG_SIGNATURE)) return "png";
  if (
    bytes.length >= CARD_IMAGE_SIGNATURE_BYTES &&
    startsWith(bytes, RIFF_SIGNATURE) &&
    startsWith(bytes, WEBP_SIGNATURE, 8)
  ) {
    return "webp";
  }
  return null;
}

export interface CardImageCheckResult {
  /** 통과하면 판별된 형식, 아니면 null */
  format: CardImageFormat | null;
  /** 통과하면 null, 아니면 화면에 그대로 보여 줄 한국어 메시지 */
  error: string | null;
}

/**
 * 고른 파일이 업로드 가능한지 검사한다. 크기 → 형식 순서는 서버와 같다
 * (서버도 multer가 크기를 먼저 막고 그다음 매직바이트를 본다).
 */
export async function checkCardImageFile(file: File): Promise<CardImageCheckResult> {
  if (file.size === 0) {
    return { format: null, error: CARD_IMAGE_MESSAGES.required };
  }
  if (file.size > CARD_IMAGE_MAX_BYTES) {
    return { format: null, error: CARD_IMAGE_MESSAGES.tooLarge };
  }

  let head: Uint8Array;
  try {
    head = new Uint8Array(await file.slice(0, CARD_IMAGE_SIGNATURE_BYTES).arrayBuffer());
  } catch {
    return { format: null, error: CARD_IMAGE_MESSAGES.unreadable };
  }

  const format = detectImageFormat(head);
  return format ? { format, error: null } : { format: null, error: CARD_IMAGE_MESSAGES.unsupported };
}

/**
 * `cardImageUrl`을 관리자 화면에서 열 수 있는 절대 URL로 바꾼다.
 *
 * 값이 두 종류라서 필요하다 — 업로드한 이미지는 Supabase Storage의 절대 URL이고,
 * 1학기에 넣은 기존 15팀은 `"/day1-team1.png"` 같은 **공개 사이트 기준 상대경로**다.
 * 후자는 공개 사이트 오리진을 앞에 붙여야 열리고, 그 값이 없으면 미리보기를 만들 수 없다(null).
 */
export function resolveCardImageUrl(
  cardImageUrl: string | null,
  publicSiteOrigin: string | undefined,
): string | null {
  if (!cardImageUrl) return null;

  if (/^https?:\/\//i.test(cardImageUrl)) return cardImageUrl;
  if (!cardImageUrl.startsWith("/")) return null;

  const origin = publicSiteOrigin?.trim().replace(/\/+$/, "");
  return origin ? `${origin}${cardImageUrl}` : null;
}

/** 빌드 시점에 번들에 박히므로 반드시 **문자 그대로의 표현**으로 읽는다(api/config.ts와 같은 이유) */
const PUBLIC_SITE_ORIGIN = process.env.NEXT_PUBLIC_PUBLIC_SITE_ORIGIN;

/** 화면에서 쓰는 형태. 순수 함수(`resolveCardImageUrl`)는 테스트가 오리진을 직접 넣을 수 있게 남겨 둔다 */
export function toDisplayUrl(cardImageUrl: string | null): string | null {
  return resolveCardImageUrl(cardImageUrl, PUBLIC_SITE_ORIGIN);
}
