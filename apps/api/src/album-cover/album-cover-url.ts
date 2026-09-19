import { BadRequestException } from '@nestjs/common';
import {
  ALBUM_COVER_ALLOWED_HOSTS,
  ALBUM_COVER_PATH_PATTERN,
  ALBUM_COVER_URL_INVALID_MESSAGE,
  ALBUM_COVER_URL_MAX_LENGTH,
} from './album-cover.constants.js';

/**
 * 앨범 커버 URL 검증 (PRD F010).
 *
 * 이 값은 **공개 프론트가 그대로 렌더링하는 주소**다. 후보 목록에서 받은 값을
 * 되돌려 보내는 것이 정상 흐름이지만, 그 값이 실제로 후보에 있었는지는 확인하지
 * 않는다 — 확인하려면 외부 API를 한 번 더 부르거나 후보 상태를 서버에 저장해야 한다.
 * 대신 호스트 allowlist + 경로 형태 + 길이로 막는 것이 방어선이다.
 *
 * 거부 사유를 문자열로 돌려주는 함수와 예외를 던지는 함수를 나눠 둔 이유는,
 * 벤치마크 스크립트가 **같은 규칙**으로 후보들을 판정해야 하기 때문이다.
 * 검증 로직이 두 벌이 되면 "벤치마크는 통과했는데 API는 거부"가 생긴다.
 */
export function checkAlbumCoverUrl(value: string): string | null {
  if (value.length > ALBUM_COVER_URL_MAX_LENGTH) {
    return `길이 초과 (${value.length} > ${ALBUM_COVER_URL_MAX_LENGTH})`;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return 'URL 형식이 아님';
  }

  if (url.protocol !== 'https:') {
    return `https가 아님 (${url.protocol})`;
  }

  // `https://someone@is1-ssl.mzstatic.com/...`처럼 호스트 앞에 뭔가 끼워 넣거나
  // 포트를 바꾼 주소를 허용하지 않는다. hostname 비교만으로는 걸러지지 않는다.
  if (url.username !== '' || url.password !== '' || url.port !== '') {
    return '사용자 정보나 포트가 포함됨';
  }

  if (!ALBUM_COVER_ALLOWED_HOSTS.includes(url.hostname)) {
    return `허용되지 않은 호스트 (${url.hostname})`;
  }

  if (!ALBUM_COVER_PATH_PATTERN.test(url.pathname)) {
    return `허용되지 않은 경로 형태 (${url.pathname})`;
  }

  if (url.search !== '' || url.hash !== '') {
    return '쿼리스트링이나 프래그먼트가 포함됨';
  }

  return null;
}

/** 검증 실패 시 400. 사유는 로그에만 남기고 클라이언트에는 공통 메시지를 준다. */
export function assertAlbumCoverUrl(value: string): void {
  if (checkAlbumCoverUrl(value) !== null) {
    throw new BadRequestException(ALBUM_COVER_URL_INVALID_MESSAGE);
  }
}
