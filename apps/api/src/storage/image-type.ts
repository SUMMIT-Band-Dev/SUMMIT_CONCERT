/**
 * 업로드된 바이트에서 이미지 형식을 판별한다 (PRD F007).
 *
 * **파일명 확장자와 Content-Type 헤더는 판별에 쓰지 않는다.** 추측이 아니라 이 레포의
 * 실데이터가 근거다 — `public/day{1,2}-team*.png` 15개는 전부 `.png` 확장자인데
 * 실제 바이트는 JPEG(`FF D8 FF`)다. 확장자를 믿었다면 PNG로 저장됐을 것이다.
 *
 * 저장할 객체의 확장자와 Content-Type도 여기서 판별한 결과로만 정한다.
 */
export interface ImageFormat {
  /** Storage에 보낼 Content-Type */
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  /** 객체 경로에 붙일 확장자 */
  extension: 'jpg' | 'png' | 'webp';
}

const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// WebP는 RIFF 컨테이너다. 0~3바이트가 "RIFF", 4~7바이트는 길이, 8~11바이트가 "WEBP".
// 길이 필드를 건너뛰어야 해서 다른 두 형식처럼 접두사 비교만으로는 판별되지 않는다.
const RIFF_SIGNATURE = Buffer.from('RIFF', 'ascii');
const WEBP_SIGNATURE = Buffer.from('WEBP', 'ascii');
const WEBP_MIN_LENGTH = 12;

/**
 * 허용 형식이면 해당 형식을, 아니면 `null`을 돌려준다.
 *
 * SVG는 어떤 시그니처와도 맞지 않아 자연히 `null`이 된다 — 의도된 결과다.
 * SVG는 스크립트를 품을 수 있는 XML 문서라서, public 버킷에서 `*.supabase.co`
 * 오리진으로 서빙되면 저장형 XSS 경로가 된다. 카드 이미지 용도에 필요하지도 않다.
 */
export function detectImageFormat(buffer: Buffer): ImageFormat | null {
  if (buffer.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE)) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }

  if (buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return { mimeType: 'image/png', extension: 'png' };
  }

  if (
    buffer.length >= WEBP_MIN_LENGTH &&
    buffer.subarray(0, 4).equals(RIFF_SIGNATURE) &&
    buffer.subarray(8, 12).equals(WEBP_SIGNATURE)
  ) {
    return { mimeType: 'image/webp', extension: 'webp' };
  }

  return null;
}
