/**
 * 카드뉴스 이미지 업로드 상한 (PRD F007).
 *
 * 기존 실데이터 15개의 최댓값이 95.8KB(819×1024 JPEG)이므로 약 11배의 여유다.
 * 더 느슨하게 잡지 않는 이유는 공개 프론트 3곳이 전부 `next/image`의 `unoptimized`로
 * **원본을 그대로 내려보내기** 때문이다 — 이 상한이 곧 방문자가 받는 바이트 수가 된다.
 *
 * 플랫폼 기본값에 기대지 않고 앱에서 명시한다. express의 json/urlencoded 기본 100KB는
 * `multipart/form-data`에 적용되지 않고, multer의 기본 `fileSize`는 `Infinity`라
 * 지정하지 않으면 상한이 사실상 없다.
 */
export const CARD_IMAGE_MAX_BYTES = 1024 * 1024;

/** 업로드 필드명. 이 이름이 아니면 multer가 `LIMIT_UNEXPECTED_FILE`로 거부한다. */
export const CARD_IMAGE_FIELD_NAME = 'file';

/**
 * 업로드 객체의 캐시 수명(초). 1년.
 *
 * 경로가 업로드마다 새로 생기므로(덮어쓰기 금지) 무한에 가깝게 잡아도 안전하다.
 * 반대로 같은 경로를 덮어쓰는 설계였다면 이 값이 그대로 사고가 된다 —
 * 이 프로젝트는 Storage의 `purgeCache`가 비활성이라 CDN 캐시를 수동으로 비울 수단이 없다.
 *
 * 값의 형태를 `public, …, immutable`이 아니라 `max-age=N`으로 두는 이유는
 * storage-js가 실제로 보내는 형태가 `cache-control: max-age=${N}`이기 때문이다.
 * 다른 디렉티브가 보존되는지는 확인하지 못해서 검증된 형태만 쓴다.
 * (지정하지 않으면 Storage 기본값은 3600초다 — storage-js `DEFAULT_FILE_OPTIONS`)
 */
export const CARD_IMAGE_CACHE_CONTROL_SECONDS = 31_536_000;

/**
 * Storage 요청 타임아웃.
 *
 * 1MB 업로드에 10초면 충분히 넉넉하다. 무한 대기를 두지 않는 이유는 저장소가 응답하지
 * 않을 때 요청 핸들러가 영원히 살아 있게 되기 때문이다.
 */
export const STORAGE_TIMEOUT_MS = 10_000;

/** 버킷 이름 기본값. `SUPABASE_STORAGE_BUCKET`으로 덮어쓸 수 있다. */
export const DEFAULT_STORAGE_BUCKET = 'team-cards';

export const CARD_IMAGE_REQUIRED_MESSAGE = '이미지 파일을 첨부해 주세요.';
export const CARD_IMAGE_UNSUPPORTED_MESSAGE =
  'JPEG, PNG, WebP 이미지만 업로드할 수 있습니다.';
export const CARD_IMAGE_TOO_LARGE_MESSAGE = '이미지 크기는 1MB를 넘을 수 없습니다.';
export const CARD_IMAGE_FIELD_MESSAGE = `파일은 '${CARD_IMAGE_FIELD_NAME}' 필드로 보내 주세요.`;
export const CARD_IMAGE_SINGLE_FILE_MESSAGE =
  '파일은 하나만, 다른 항목 없이 보내 주세요.';
export const CARD_IMAGE_INVALID_UPLOAD_MESSAGE =
  '업로드 형식이 올바르지 않습니다.';

export const STORAGE_TIMEOUT_MESSAGE =
  '이미지 저장소 응답이 지연돼 업로드를 완료하지 못했습니다.';
export const STORAGE_FAILED_MESSAGE = '이미지 저장소에 업로드하지 못했습니다.';
