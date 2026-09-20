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
 * 특성 테스트가 고정할 기준이 사라진다.
 *
 * ## ⚠️ 저장 후보를 고르는 순서에는 쓰지 않는다 (게이트 2 캘리브레이션 결정)
 *
 * 승인된 5곡으로 실측한 결과, 정답 영상이 **YouTube 원본 순서로는 5곡 모두 상위 4위 안**(상위 3위 안
 * 4/5)인데 이 점수로 다시 정렬하면 상위 3에 드는 곡이 1/5, 1위가 정답인 곡은 0/5였다.
 * 그래서 후보는 **원본 순서 그대로** 고르고(`selectCandidates`), 점수는 **참고값으로만 저장**한다.
 * 표본이 5곡이라 일반화하지는 않는다.
 *
 * 이 함수와 특성 테스트를 지우지 않고 남기는 이유는 **프론트 실시간 폴백이 같은 점수로 1위를
 * 고르기 때문**이다. 이 5곡 기준으로 폴백이 여는 영상은 사람이 승인한 영상과 5/5 달랐다.
 * 7단계에서 폴백을 검토할 때 이 로직의 동작을 값으로 고정해 둔 근거가 필요하다.
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

/**
 * 저장할 후보. `rank`는 **YouTube가 준 순서**(1부터, DB의 CHECK `rank >= 1`과 맞춘다)이고
 * `score`는 **참고값**이다 — 정렬에 쓰이지 않는다.
 */
export interface SelectedCandidate extends YoutubeSearchItem {
  rank: number;
  score: number;
}

/**
 * 후보를 **YouTube가 준 원본 순서 그대로** 상위 N개 고른다.
 *
 * 점수는 계산해서 붙이지만 순서에 영향을 주지 않는다(위 "저장 후보를 고르는 순서에는 쓰지 않는다").
 * 원본 순서에는 동점이 없으므로 점수가 타이브레이커로 개입할 일도 없다 — 참고값이다.
 *
 * `title || query`, `artist || query` 폴백은 프론트와 같다(참고 점수도 폴백과 같은 입력으로
 * 계산해야 나중에 두 로직을 비교할 수 있다).
 */
export function selectCandidates(
  items: YoutubeSearchItem[],
  options: { query: string; title: string; artist: string; limit: number },
): SelectedCandidate[] {
  const { query, title, artist, limit } = options;
  const scoreTitle = title || query;
  const scoreArtist = artist || query;

  return items.slice(0, limit).map((item, position) => ({
    ...item,
    rank: position + 1,
    score: calculateVideoScore(item, scoreTitle, scoreArtist),
  }));
}
