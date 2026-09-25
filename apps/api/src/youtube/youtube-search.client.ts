import { Injectable } from '@nestjs/common';
import { isTimeoutError } from '../common/abort.js';
import {
  YOUTUBE_API_KEY_HEADER,
  YOUTUBE_SEARCH_ENDPOINT,
  YOUTUBE_SEARCH_MAX_RESULTS,
  YOUTUBE_SEARCH_TIMEOUT_MS,
} from './youtube-search.constants.js';

export const YOUTUBE_SEARCH_CLIENT = 'YOUTUBE_SEARCH_CLIENT';

/** 우리가 실제로 쓰는 필드만. 외부 응답이라 빠진 필드는 "그 후보를 건너뛴다"로 처리한다. */
export interface YoutubeSearchItem {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  thumbnailUrl: string;
}

export interface YoutubeSearchClient {
  search(query: string): Promise<YoutubeSearchItem[]>;
}

/** 5초 안에 응답이 오지 않음. **이 곡에 대한 판정**이므로 `completedAt`을 채운다. */
export class YoutubeTimeoutError extends Error {}

/** 업스트림이 거절했거나 응답을 해석할 수 없음. 역시 이 곡에 대한 판정이다. */
export class YoutubeUpstreamError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

/**
 * 일일 쿼터 초과 (403 `quotaExceeded`).
 * **이 곡을 평가조차 못 한 것**이므로 `completedAt`을 NULL로 두고 연속 실패수에서 뺀다.
 */
export class YoutubeQuotaExceededError extends Error {}

/**
 * API 키 문제 (403 `forbidden`, 400 등). 서버 설정 문제이지 곡 문제가 아니다.
 * 역시 `completedAt`을 NULL로 둔다.
 */
export class YoutubeApiKeyError extends Error {}

/**
 * `search.list` 클라이언트 (PRD F011).
 *
 * 프론트 폴백과 **같은 파라미터**를 보낸다(`part=snippet`, `type=video`, `maxResults=10`,
 * `regionCode=KR`, `relevanceLanguage=ko`). 다른 값을 보내면 특성 테스트가 고정한
 * 스코어링 기준과 입력이 달라져 "이식했다"는 말이 성립하지 않는다.
 *
 * 키는 **헤더로만** 보낸다 — URL에 키가 없으므로 요청 URL이 로그나 예외에 섞여도
 * 키가 새지 않는다. 예외 메시지에는 URL도 응답 본문도 싣지 않는다.
 *
 * 주입 가능하게 만든 이유는 단위 테스트 때문이다. `AlbumCoverModule`의 `ITUNES_CLIENT`와
 * 같은 구조로, 모듈이 `useClass`로 실제 구현을 꽂고 테스트는 대역을 넘긴다.
 */
@Injectable()
export class HttpYoutubeSearchClient implements YoutubeSearchClient {
  constructor(private readonly apiKey: string) {}

  async search(query: string): Promise<YoutubeSearchItem[]> {
    const url = new URL(YOUTUBE_SEARCH_ENDPOINT);
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('type', 'video');
    url.searchParams.set('maxResults', String(YOUTUBE_SEARCH_MAX_RESULTS));
    url.searchParams.set('q', query);
    url.searchParams.set('regionCode', 'KR');
    url.searchParams.set('relevanceLanguage', 'ko');

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { [YOUTUBE_API_KEY_HEADER]: this.apiKey },
        signal: AbortSignal.timeout(YOUTUBE_SEARCH_TIMEOUT_MS),
      });
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new YoutubeTimeoutError(
          `유튜브 검색이 ${YOUTUBE_SEARCH_TIMEOUT_MS}ms 안에 끝나지 않았습니다.`,
        );
      }
      // 원본 오류를 cause로도 붙이지 않는다. fetch 예외의 message에 요청 URL이 들어가는
      // 구현이 있어(확인하지 않았다 — 추측), 그대로 흘리면 로그에 URL이 남는다.
      throw new YoutubeUpstreamError('유튜브 검색 요청에 실패했습니다.');
    }

    if (!response.ok) {
      throw await this.toError(response);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new YoutubeUpstreamError('유튜브 응답을 해석하지 못했습니다.');
    }

    return toSearchItems(body);
  }

  /**
   * 실패 응답을 분류한다.
   *
   * 403은 두 가지가 섞여 있어 **본문의 reason으로 갈라야** 한다 — 쿼터 초과는 "내일 다시",
   * 키 오류는 "서버 설정을 고쳐라"로 대응이 완전히 다르다. 본문을 읽지 못하면 보수적으로
   * 키 오류로 본다: 쿼터 초과로 오분류하면 배치가 조용히 하루를 쉬는데, 반대 방향의
   * 오분류는 즉시 눈에 띈다.
   *
   * 본문은 reason을 뽑는 데만 쓰고 **메시지에 싣지 않는다.**
   */
  private async toError(response: Response): Promise<Error> {
    const reason = await readErrorReason(response);

    if (response.status === 403) {
      return reason === 'quotaExceeded' || reason === 'dailyLimitExceeded'
        ? new YoutubeQuotaExceededError('유튜브 일일 검색 쿼터를 초과했습니다.')
        : new YoutubeApiKeyError(`유튜브 API가 요청을 거부했습니다 (reason=${reason ?? 'unknown'}).`);
    }

    if (response.status === 400 || response.status === 401) {
      return new YoutubeApiKeyError(
        `유튜브 API 인증에 실패했습니다 (HTTP ${response.status}, reason=${reason ?? 'unknown'}).`,
      );
    }

    if (response.status === 429) {
      return new YoutubeQuotaExceededError('유튜브 API가 요청 빈도를 제한했습니다.');
    }

    return new YoutubeUpstreamError(
      `유튜브 검색이 실패했습니다 (HTTP ${response.status}).`,
      response.status,
    );
  }
}

/**
 * 오류 응답에서 `error.errors[0].reason`만 뽑는다.
 *
 * reason은 구글이 정의한 닫힌 집합의 식별자라 우리 입력이 반사될 여지가 없다.
 * 본문의 `message`는 요청 정보를 담을 수 있어 쓰지 않는다.
 */
async function readErrorReason(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as {
      error?: { errors?: Array<{ reason?: unknown }> };
    };
    const reason = body?.error?.errors?.[0]?.reason;

    return typeof reason === 'string' && /^[A-Za-z]{1,64}$/.test(reason) ? reason : null;
  } catch {
    return null;
  }
}

/**
 * `search.list` 응답을 우리 모양으로 바꾼다.
 *
 * 여기서는 **버리는 기준이 "형태"뿐**이다 — videoId가 문자열이 아니거나 snippet이 없으면
 * 후보가 될 수 없다. 영상 ID 형식·예약어·썸네일 호스트·길이 검사는 **저장 직전**(서비스)에서
 * 한다. 클라이언트가 걸러 버리면 캘리브레이션이 실제 응답 분포를 관측하지 못해,
 * "왜 후보가 0건인지"가 가려진다 (§13 앨범 커버 mapper와 같은 판단).
 */
function toSearchItems(body: unknown): YoutubeSearchItem[] {
  const items = (body as { items?: unknown })?.items;
  if (!Array.isArray(items)) {
    return [];
  }

  const result: YoutubeSearchItem[] = [];
  for (const raw of items) {
    const videoId = (raw as { id?: { videoId?: unknown } })?.id?.videoId;
    if (typeof videoId !== 'string' || videoId === '') {
      continue;
    }

    const snippet = (raw as { snippet?: Record<string, unknown> })?.snippet ?? {};
    result.push({
      videoId,
      title: asString(snippet.title),
      description: asString(snippet.description),
      channelTitle: asString(snippet.channelTitle),
      thumbnailUrl: readThumbnailUrl(snippet.thumbnails),
    });
  }

  return result;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** 중간 크기를 우선하고 없으면 순서대로 내려간다. 목록 화면에 쓰기 좋은 크기다. */
function readThumbnailUrl(thumbnails: unknown): string {
  const sizes = ['medium', 'high', 'default'] as const;
  for (const size of sizes) {
    const url = (thumbnails as Record<string, { url?: unknown }> | undefined)?.[size]?.url;
    if (typeof url === 'string' && url !== '') {
      return url;
    }
  }

  return '';
}
