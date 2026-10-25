// 서버 apps/api/src/concert-content/concert-content.constants.ts와 같은 크기 제한·문구다.
import { CARD_IMAGE_MESSAGES, CARD_IMAGE_SIGNATURE_BYTES, detectImageFormat, type CardImageCheckResult } from "@/lib/teams/card-image";
export const CONCERT_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const CONCERT_IMAGE_TOO_LARGE_MESSAGE = "이미지 크기는 2MB를 넘을 수 없습니다.";

export async function checkConcertImageFile(file: File): Promise<CardImageCheckResult> {
  if (!file.size) return { format: null, error: CARD_IMAGE_MESSAGES.required };
  if (file.size > CONCERT_IMAGE_MAX_BYTES) return { format: null, error: CONCERT_IMAGE_TOO_LARGE_MESSAGE };
  let head: Uint8Array;
  try {
    head = new Uint8Array(await file.slice(0, CARD_IMAGE_SIGNATURE_BYTES).arrayBuffer());
  } catch {
    return { format: null, error: CARD_IMAGE_MESSAGES.unreadable };
  }
  const format = detectImageFormat(head);
  return format ? { format, error: null } : { format: null, error: CARD_IMAGE_MESSAGES.unsupported };
}
