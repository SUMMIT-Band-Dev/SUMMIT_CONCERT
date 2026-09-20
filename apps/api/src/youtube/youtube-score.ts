import type { YoutubeSearchItem } from './youtube-search.client.js';

/**
 * 프론트 실시간 폴백(`src/app/api/youtube/top-video/route.ts`)의 스코어링을 **그대로 옮긴 것**이다.
 *
 * ## 왜 이식인가
 *
 * 공용 패키지로 빼는 안은 기각했다 — Vercel의 root directory가 `"."`라 워크스페이스
 * 패키지를 만들면 프론트 빌드 설정을 건드려야 하고, §9가 `apps/web` 이동을 보류한 것과
 * 같은 이유로 프로덕션 배포 위험이 생긴다. 프론트 라우트를 HTTP로 호출하는 안도 기각했다 —
 * 백엔드가 프론트 배포에 종속되고, 배치가 Vercel 함수 타임아웃에 묶이며, 키를 별도 Cloud
 * 프로젝트로 분리한 설계와 충돌한다.
 *
 * ## 드리프트 위험은 실재한다
 *
 * 같은 로직이 두 벌 존재한다. 완화책은 세 가지다: (a) `youtube-score.spec.ts`의 **특성
 * 테스트**가 프론트 구현의 동작을 값으로 고정한다 (b) 이 주석이 두 벌의 존재를 명시한다
 * (c) URL이 채워질수록 폴백 호출이 줄어드므로, 7단계 이후 폴백 라우트 제거를 검토한다.
 *
 * ## 가중치를 손대지 않았다
 *
 * 숫자·순서·키워드를 하나도 바꾸지 않았다. 바꾸면 "이식"이 아니라 "새 로직"이 되고,
 * 특성 테스트가 고정할 기준이 사라진다. 개선은 캘리브레이션으로 실제 순위를 본 뒤에 한다.
 */
export function calculateVideoScore(
  item: Pick<YoutubeSearchItem, 'title' | 'description' | 'channelTitle'>,
  title: string,
  artist: string,
): number {
  const normalizedTitle = normalizeText(item.title);
  const normalizedDescription = normalizeText(item.description);
  const normalizedChannel = normalizeText(item.channelTitle);
  const normalizedSongTitle = normalizeText(title);
  const normalizedArtist = normalizeText(artist);

  let score = 0;

  // 공식 MV 성격의 영상에 높은 가중치
  if (includesAnyKeyword(normalizedTitle, ['official mv', 'official music video'])) score += 120;
  if (includesAnyKeyword(normalizedTitle, ['official'])) score += 35;
  if (includesAnyKeyword(normalizedTitle, [' mv ', '뮤직비디오', 'music video'])) score += 30;
  if (includesAnyKeyword(normalizedDescription, ['official mv', 'official music video'])) score += 40;
  if (includesAnyKeyword(normalizedChannel, ['official'])) score += 20;

  // 검색 대상 곡/아티스트와의 일치도
  if (normalizedSongTitle && normalizedTitle.includes(normalizedSongTitle)) score += 45;
  if (normalizedArtist && normalizedTitle.includes(normalizedArtist)) score += 20;
  if (normalizedArtist && normalizedDescription.includes(normalizedArtist)) score += 12;

  // 라이브/커버/직캠은 공식 MV 우선 요구에 맞춰 감점
  if (includesAnyKeyword(normalizedTitle, ['live', 'cover', 'fancam', '직캠', '라이브'])) score -= 30;

  return score;
}

function normalizeText(value: string): string {
  return value.toLowerCase().trim();
}

function includesAnyKeyword(target: string, keywords: string[]): boolean {
  return keywords.some((keyword) => target.includes(keyword));
}

/** 점수가 매겨진 후보. `rank`는 1부터 시작한다(DB의 CHECK `rank >= 1`과 맞춘다). */
export interface RankedCandidate extends YoutubeSearchItem {
  rank: number;
  score: number;
}

/**
 * 후보에 점수를 매겨 상위 N개를 고른다.
 *
 * **프론트의 최상위 선택과 1위가 일치해야 한다.** 프론트는
 * `items.map(score).sort((a,b) => b.score - a.score)[0]`으로 하나만 고르는데,
 * V8의 `Array.prototype.sort`가 안정 정렬이라 동점이면 원래 순서(= 유튜브 관련도 순)가
 * 유지된다. 여기서도 같은 비교자를 쓰고 원본 순서를 보존해 그 동작을 그대로 따른다.
 *
 * `title || query`, `artist || query` 폴백도 프론트와 같다. 가수가 비어 있으면 프론트는
 * 검색어 전체를 아티스트 자리에 넣는데, 그 특이 동작까지 포함해야 "이식"이다.
 */
export function rankCandidates(
  items: YoutubeSearchItem[],
  options: { query: string; title: string; artist: string; limit: number },
): RankedCandidate[] {
  const { query, title, artist, limit } = options;
  const scoreTitle = title || query;
  const scoreArtist = artist || query;

  return items
    .map((item, index) => ({
      item,
      index,
      score: calculateVideoScore(item, scoreTitle, scoreArtist),
    }))
    // 동점일 때 원래 순서를 유지한다. sort의 안정성에 기대지 않고 index로 명시하는 이유는,
    // 정렬 안정성이 보장되지 않는 런타임에서도 프론트와 같은 결과가 나오게 하기 위해서다.
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((scored, position) => ({
      ...scored.item,
      rank: position + 1,
      score: scored.score,
    }));
}
