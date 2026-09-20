import { describe, expect, it } from 'vitest';
import { calculateVideoScore, selectCandidates } from './youtube-score.js';
import type { YoutubeSearchItem } from './youtube-search.client.js';

/**
 * ## 특성 테스트 (characterization test)
 *
 * 아래 `frontendScore`는 `src/app/api/youtube/top-video/route.ts`의 `calculateVideoScore`를
 * **손대지 않고 그대로 복사한 것**이다. 이식본이 원본과 같은 값을 내는지 비교해서, 두 벌로
 * 존재하는 로직이 갈라지는 순간 테스트가 깨지게 한다.
 *
 * 이 파일을 고칠 때의 규칙: **프론트가 바뀌었을 때만** 아래 복사본을 갱신한다.
 * 이식본만 고치고 복사본을 맞추면 특성 테스트가 아무것도 지키지 못한다.
 *
 * (프론트 원본은 `snippet`이 optional인 raw 응답을 받고 이식본은 정규화된 값을 받는다.
 *  그 차이는 `toSearchItems`가 흡수하므로, 여기서는 정규화된 문자열을 양쪽에 똑같이 넣는다.)
 */
function frontendScore(
  snippet: { title?: string; description?: string; channelTitle?: string },
  title: string,
  artist: string,
): number {
  const normalizeText = (value: string) => value.toLowerCase().trim();
  const includesAnyKeyword = (target: string, keywords: string[]) =>
    keywords.some((keyword) => target.includes(keyword));

  const normalizedTitle = normalizeText(snippet.title ?? '');
  const normalizedDescription = normalizeText(snippet.description ?? '');
  const normalizedChannel = normalizeText(snippet.channelTitle ?? '');
  const normalizedSongTitle = normalizeText(title);
  const normalizedArtist = normalizeText(artist);

  let score = 0;

  if (includesAnyKeyword(normalizedTitle, ['official mv', 'official music video'])) score += 120;
  if (includesAnyKeyword(normalizedTitle, ['official'])) score += 35;
  if (includesAnyKeyword(normalizedTitle, [' mv ', '뮤직비디오', 'music video'])) score += 30;
  if (includesAnyKeyword(normalizedDescription, ['official mv', 'official music video'])) score += 40;
  if (includesAnyKeyword(normalizedChannel, ['official'])) score += 20;

  if (normalizedSongTitle && normalizedTitle.includes(normalizedSongTitle)) score += 45;
  if (normalizedArtist && normalizedTitle.includes(normalizedArtist)) score += 20;
  if (normalizedArtist && normalizedDescription.includes(normalizedArtist)) score += 12;

  if (includesAnyKeyword(normalizedTitle, ['live', 'cover', 'fancam', '직캠', '라이브'])) score -= 30;

  return score;
}

const item = (over: Partial<YoutubeSearchItem> = {}): YoutubeSearchItem => ({
  videoId: 'BTo-I-gCAxk',
  title: '',
  description: '',
  channelTitle: '',
  thumbnailUrl: 'https://i.ytimg.com/vi/BTo-I-gCAxk/mqdefault.jpg',
  ...over,
});

/** 실제 셋리스트에서 뽑은 조합 + 가중치 분기를 하나씩 건드리는 조합 */
const CORPUS: Array<{ name: string; item: YoutubeSearchItem; title: string; artist: string }> = [
  {
    name: '공식 MV + 제목·가수 일치 (최고점 경로)',
    item: item({
      title: '쏜애플 (Thornapple) - 빨간 피터 Official MV',
      description: 'Official Music Video',
      channelTitle: 'Thornapple Official',
    }),
    title: '빨간 피터',
    artist: '쏜애플',
  },
  {
    name: '라이브 영상 (감점 경로)',
    item: item({
      title: '이승윤 - 비싼 숙취 (Live)',
      description: 'live at 소극장',
      channelTitle: '이승윤',
    }),
    title: '비싼 숙취',
    artist: '이승윤',
  },
  {
    name: '직캠 (한글 감점 키워드)',
    item: item({ title: '한로로 0+0 직캠', description: '', channelTitle: '팬캠' }),
    title: '0+0',
    artist: '한로로',
  },
  {
    name: '뮤직비디오 한글 키워드',
    item: item({ title: '윤하 - 혜성 뮤직비디오', description: '', channelTitle: 'YouTube' }),
    title: '혜성',
    artist: '윤하',
  },
  {
    name: '가운데 공백이 있는 MV (" mv " 분기)',
    item: item({ title: 'DETOX mv full', description: '', channelTitle: 'SURL' }),
    title: 'DETOX',
    artist: '설(SURL)',
  },
  {
    name: '제목 끝의 MV는 " mv "에 걸리지 않는다',
    item: item({ title: 'DETOX mv', description: '', channelTitle: '' }),
    title: 'DETOX',
    artist: '설(SURL)',
  },
  {
    name: '설명에만 아티스트 (+12 분기)',
    item: item({ title: 'Viva La Vida', description: 'by coldplay', channelTitle: '' }),
    title: 'Viva La Vida',
    artist: 'Coldplay',
  },
  {
    name: '채널명에만 official (+20 분기)',
    item: item({ title: '사랑의 미학', description: '', channelTitle: 'Redoor Official' }),
    title: '사랑의 미학',
    artist: '리도어 (Redoor)',
  },
  {
    name: '괄호가 섞인 제목 (id 4 Vancouver2)',
    item: item({
      title: 'BIG Naughty (서동현) - Vancouver2 (BAND Ver.) Official MV',
      description: '',
      channelTitle: '',
    }),
    title: 'Vancouver2 (BAND Ver.)',
    artist: 'BIG Naughty (서동현)',
  },
  {
    name: '일본어 아티스트 (id 21 Pretender)',
    item: item({
      title: 'Official髭男dism - Pretender[Official Video]',
      description: '',
      channelTitle: 'Official髭男dism',
    }),
    title: 'Pretender',
    artist: 'Official髭男dism',
  },
  {
    name: '한 글자 제목 (id 24 재) — 부분일치가 과하게 붙는 사례',
    item: item({ title: '한로로 - 재', description: '', channelTitle: '' }),
    title: '재',
    artist: '한로로',
  },
  {
    name: '전부 빈 문자열 (0점)',
    item: item({ title: '', description: '', channelTitle: '' }),
    title: '',
    artist: '',
  },
  {
    name: '대소문자 혼용 (정규화 확인)',
    item: item({ title: 'OFFICIAL MV — Butterfly', description: 'OFFICIAL MUSIC VIDEO', channelTitle: 'LOVEHOLICS OFFICIAL' }),
    title: 'butterfly',
    artist: '러브홀릭스',
  },
  {
    name: 'cover 가 다른 단어에 포함된 경우 (discover)',
    item: item({ title: 'Discover: Back in Time', description: '', channelTitle: '' }),
    title: 'Back in Time',
    artist: '너드커넥션',
  },
];

describe('calculateVideoScore — 프론트 폴백과의 특성 테스트', () => {
  it.each(CORPUS)('$name', ({ item: candidate, title, artist }) => {
    expect(calculateVideoScore(candidate, title, artist)).toBe(
      frontendScore(candidate, title, artist),
    );
  });

  it('가중치 합계가 문서화된 값과 일치한다 (숫자를 바꾸면 여기서 걸린다)', () => {
    // 모든 가산 분기를 동시에 만족하고 감점 분기는 피하는 입력.
    const best = item({
      title: 'official mv music video 뮤직비디오 혜성 윤하',
      description: 'official mv 윤하',
      channelTitle: 'official',
    });

    // 120 + 35 + 30 + 40 + 20 + 45 + 20 + 12 = 322
    expect(calculateVideoScore(best, '혜성', '윤하')).toBe(322);
  });

  it('감점은 −30이다', () => {
    const base = item({ title: 'abc' });
    const live = item({ title: 'abc live' });

    expect(calculateVideoScore(live, 'zzz', 'zzz') - calculateVideoScore(base, 'zzz', 'zzz')).toBe(-30);
  });
});

describe('selectCandidates — 원본 순서 상위 N개 (점수는 참고값)', () => {
  /** 프론트 폴백의 선택 로직을 그대로 옮긴 비교군 — 점수 1위를 고른다 */
  function frontendBest(items: YoutubeSearchItem[], query: string, title: string, artist: string) {
    return items
      .map((candidate) => ({
        candidate,
        score: frontendScore(candidate, title || query, artist || query),
      }))
      .sort((a, b) => b.score - a.score)[0]?.candidate;
  }

  const items: YoutubeSearchItem[] = [
    item({ videoId: 'aaaaaaaaaaa', title: '빨간 피터 (cover)' }),
    item({ videoId: 'bbbbbbbbbbb', title: '쏜애플 빨간 피터 Official MV', description: 'official mv' }),
    item({ videoId: 'ccccccccccc', title: '빨간 피터' }),
  ];
  const opts = { query: '빨간 피터 쏜애플', title: '빨간 피터', artist: '쏜애플', limit: 3 };

  it('점수가 아니라 YouTube가 준 원본 순서 그대로 고른다', () => {
    const selected = selectCandidates(items, opts);

    // 점수로는 2번째(Official MV)가 압도적인 1위지만 순서는 원본 그대로다.
    expect(selected.map((candidate) => candidate.videoId)).toEqual([
      'aaaaaaaaaaa',
      'bbbbbbbbbbb',
      'ccccccccccc',
    ]);
  });

  it('프론트 폴백의 점수 1위와 우리 1위가 다를 수 있다 — 7단계 검토 근거로 고정한다', () => {
    // 게이트 2 캘리브레이션에서 실제로 관측된 상황이다(승인된 5곡에서 폴백의 1위가 정답과 5/5 달랐다).
    // 이 테스트가 깨지면 두 로직의 관계가 바뀐 것이니 REFACTOR_NOTES §15 "남겨둔 결정"을 다시 본다.
    const ours = selectCandidates(items, opts)[0];
    const fallbackPick = frontendBest(items, opts.query, opts.title, opts.artist);

    expect(ours.videoId).toBe('aaaaaaaaaaa');
    expect(fallbackPick?.videoId).toBe('bbbbbbbbbbb');
    expect(ours.videoId).not.toBe(fallbackPick?.videoId);
  });

  it('점수는 계산해서 붙이되 순서에는 영향이 없다 (참고값)', () => {
    const selected = selectCandidates(items, opts);

    expect(selected.map((candidate) => candidate.score)).toEqual(
      items.map((candidate) => frontendScore(candidate, opts.title, opts.artist)),
    );
    // 점수가 내림차순이 아니어도 그대로다.
    expect(selected[1].score).toBeGreaterThan(selected[0].score);
  });

  it('rank는 1부터 연속이고 limit에서 잘린다 (DB의 CHECK rank >= 1과 맞다)', () => {
    const selected = selectCandidates(items, { ...opts, limit: 2 });

    expect(selected.map((candidate) => candidate.rank)).toEqual([1, 2]);
  });

  it('limit보다 후보가 적으면 있는 만큼만 돌려준다', () => {
    expect(selectCandidates(items.slice(0, 1), opts)).toHaveLength(1);
  });

  it('원본 배열을 바꾸지 않는다', () => {
    const copy = items.map((candidate) => ({ ...candidate }));

    selectCandidates(items, opts);

    expect(items).toEqual(copy);
  });

  it('가수가 비면 참고 점수를 프론트처럼 검색어 전체를 아티스트 자리에 넣어 계산한다', () => {
    // 프론트의 `artist || query` 동작. 나중에 두 로직을 비교할 수 있게 같은 입력으로 계산한다.
    const withQueryAsArtist = item({ title: '혜성 윤하' });

    const selected = selectCandidates([withQueryAsArtist], {
      query: '혜성 윤하',
      title: '혜성',
      artist: '',
      limit: 1,
    });

    expect(selected[0].score).toBe(frontendScore(withQueryAsArtist, '혜성', '혜성 윤하'));
  });

  it('빈 후보 목록은 빈 배열이다 (예외가 아니다)', () => {
    expect(selectCandidates([], { query: 'q', title: 't', artist: 'a', limit: 3 })).toEqual([]);
  });
});
