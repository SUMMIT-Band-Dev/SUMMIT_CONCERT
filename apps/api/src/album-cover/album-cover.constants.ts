/** iTunes Search API. 인증이 없는 공개 엔드포인트다. */
export const ITUNES_SEARCH_ENDPOINT = 'https://itunes.apple.com/search';

/**
 * 검색 스토어프런트.
 *
 * **`KR`은 쓸 수 없다.** 실제로 호출해 본 결과 한국어 쿼리는 물론 영어 대조군
 * (`Dynamite BTS`)까지 전부 `resultCount: 0`이었다. `US`와 `JP`는 정상 응답한다.
 * 원인은 확인하지 못했고(한국 iTunes Store에 음원 카탈로그가 없기 때문으로 추정),
 * 관측된 사실만 근거로 US를 쓴다.
 *
 * 기존 `Setlist.album` 63건의 아트워크 URL이 US 응답과 바이트 단위로 일치하는 것도
 * 확인했다 — 지금까지 채워진 데이터도 사실상 이 스토어프런트에서 온 것이다.
 */
export const ITUNES_COUNTRY = 'US';

/**
 * iTunes에 요청하는 결과 수.
 *
 * 후보로 내보내는 건 5개인데 10개를 요청하는 이유는, 같은 앨범의 다른 수록곡이
 * **아트워크 URL이 같아서** 중복 제거에 뭉개지기 때문이다. 5개만 요청하면
 * dedupe 후 2~3개만 남는 경우가 생긴다.
 */
export const ITUNES_SEARCH_LIMIT = 10;

/** 관리자에게 보여줄 후보 수 (dedupe 후 기준). */
export const ALBUM_COVER_CANDIDATE_LIMIT = 5;

/** iTunes 응답 대기 상한. 실측 응답 시간은 225~528ms였다. */
export const ITUNES_TIMEOUT_MS = 5_000;

/**
 * 우리가 iTunes로 내보내는 호출의 분당 상한.
 *
 * 애플이 안내하는 20회/분보다 낮게 잡는다. 상한을 넘겼을 때 iTunes가 실제로 무엇을
 * 돌려주는지는 **확인하지 않았다**(확인하려면 의도적으로 한도를 넘겨야 한다).
 * 그래서 업스트림의 거절에 기대지 않고 우리 쪽에서 먼저 막는 것이 1차 방어다.
 *
 * ⚠️ 인메모리 카운터라 **프로세스 단위**다. 인스턴스가 둘 이상이면 합산이 상한을
 * 넘을 수 있다. 현재는 단일 상주 인스턴스 전제.
 * ⚠️ 방문자 요청을 막는 인바운드 throttler(7단계)와는 목적이 다르다.
 */
export const OUTBOUND_MAX_PER_MINUTE = 15;
export const OUTBOUND_WINDOW_MS = 60_000;

/**
 * 저장할 아트워크 크기.
 *
 * 프론트와의 계약이다 — `src/lib/mzstatic.ts`의 `shrinkAlbumCoverUrl`이
 * `/\/\d+x\d+bb\.jpg$/i`를 치환해 112px로 줄이므로, 이 꼬리표 형태여야 축소가 동작한다.
 * 기존 63행도 전부 `600x600bb.jpg`다.
 */
export const ALBUM_COVER_ARTWORK_SIZE = '600x600bb.jpg';

/** iTunes 응답의 `artworkUrl100` 등에서 크기 꼬리표만 떼어내는 패턴. */
export const ARTWORK_SIZE_SUFFIX_PATTERN = /\/\d+x\d+bb\.jpg$/i;

/**
 * 저장을 허용하는 호스트.
 *
 * `next.config.ts`의 `images.remotePatterns`가 `is1-ssl.mzstatic.com` **하나만**
 * 허용하고 있어 두 곳을 같은 값으로 묶는다. 다른 호스트를 저장하면 공개 프론트가
 * `unoptimized`를 떼는 순간 이미지가 깨진다.
 *
 * 기존 `album` 63건이 전부 이 호스트인 것은 확인했지만, 애플이 `is2~is5-ssl`을
 * 쓰는 경우가 있는지는 **확인하지 못했다.** 벤치마크에서 관측된 호스트 분포를 보고
 * 필요하면 이 목록과 `next.config.ts`를 함께 넓힌다.
 */
export const ALBUM_COVER_ALLOWED_HOSTS: readonly string[] = ['is1-ssl.mzstatic.com'];

/**
 * 허용 경로 형태.
 *
 * 기존 `album` 63건 전부가 이 패턴을 통과하고 오거부가 0건임을 실측으로 확인했다
 * (문자 클래스 밖 문자도 0개 — 퍼센트 인코딩이 등장하지 않는다).
 */
export const ALBUM_COVER_PATH_PATTERN =
  /^\/image\/thumb\/[A-Za-z0-9/._-]+\/600x600bb\.jpg$/;

/**
 * URL 길이 상한. 기존 63건의 최댓값은 160자다.
 *
 * 앨범명이 파일명에 그대로 들어가는 구조라 더 긴 값이 가능해서 여유를 뒀다.
 * 벤치마크에서 후보 URL의 실제 최댓값을 재고 필요하면 조정한다.
 */
export const ALBUM_COVER_URL_MAX_LENGTH = 255;

export const ALBUM_COVER_URL_REQUIRED_MESSAGE = '앨범 커버 URL을 입력해 주세요.';
export const ALBUM_COVER_URL_TOO_LONG_MESSAGE = `앨범 커버 URL은 ${ALBUM_COVER_URL_MAX_LENGTH}자를 넘을 수 없습니다.`;
export const ALBUM_COVER_URL_INVALID_MESSAGE =
  '허용되지 않은 앨범 커버 URL입니다. 후보 목록에서 받은 주소를 그대로 보내 주세요.';

export const ALBUM_COVER_TIMEOUT_MESSAGE =
  '앨범 커버 검색이 지연돼 결과를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.';
export const ALBUM_COVER_UPSTREAM_MESSAGE =
  '앨범 커버 검색 서비스에서 결과를 가져오지 못했습니다.';
export const ALBUM_COVER_RATE_LIMIT_MESSAGE =
  '앨범 커버 검색 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
