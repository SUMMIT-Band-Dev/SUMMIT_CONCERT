import { Injectable } from '@nestjs/common';
import { isTimeoutError } from '../common/abort.js';
import {
  ITUNES_COUNTRY,
  ITUNES_SEARCH_ENDPOINT,
  ITUNES_SEARCH_LIMIT,
  ITUNES_TIMEOUT_MS,
} from './album-cover.constants.js';

export const ITUNES_CLIENT = 'ITUNES_CLIENT';

/**
 * iTunes Search API 응답 중 실제로 쓰는 필드만.
 *
 * 전부 optional인 이유는 외부 응답이기 때문이다 — 필드가 빠져도 예외가 아니라
 * "그 후보를 건너뛴다"로 처리한다.
 */
export interface ItunesTrack {
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
}

export interface ItunesClient {
  search(term: string): Promise<ItunesTrack[]>;
}

/** 5초 안에 응답이 오지 않음 → 504로 매핑된다. */
export class ItunesTimeoutError extends Error {}

/** 업스트림이 거절했거나 응답을 해석할 수 없음 → 502로 매핑된다. */
export class ItunesUpstreamError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class HttpItunesClient implements ItunesClient {
  async search(term: string): Promise<ItunesTrack[]> {
    const url = new URL(ITUNES_SEARCH_ENDPOINT);
    url.searchParams.set('term', term);
    url.searchParams.set('media', 'music');
    url.searchParams.set('entity', 'song');
    url.searchParams.set('limit', String(ITUNES_SEARCH_LIMIT));
    url.searchParams.set('country', ITUNES_COUNTRY);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(ITUNES_TIMEOUT_MS),
      });
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new ItunesTimeoutError(
          `iTunes 검색이 ${ITUNES_TIMEOUT_MS}ms 안에 끝나지 않았습니다.`,
        );
      }
      throw new ItunesUpstreamError('iTunes 검색 요청에 실패했습니다.');
    }

    if (!response.ok) {
      // 429(상한 초과)와 5xx를 따로 구분하지 않는다 — 호출자 입장에서 할 수 있는 일이
      // "나중에 다시"로 같고, 둘 다 502로 나간다.
      throw new ItunesUpstreamError(
        `iTunes 검색이 실패했습니다 (HTTP ${response.status}).`,
        response.status,
      );
    }

    let body: unknown;
    try {
      // 응답의 Content-Type은 `text/javascript; charset=utf-8`이지만 내용은 JSON이고
      // `response.json()`이 정상 동작하는 것을 실제 호출로 확인했다.
      body = await response.json();
    } catch {
      throw new ItunesUpstreamError('iTunes 응답을 해석하지 못했습니다.');
    }

    const results = (body as { results?: unknown })?.results;
    return Array.isArray(results) ? (results as ItunesTrack[]) : [];
  }
}
