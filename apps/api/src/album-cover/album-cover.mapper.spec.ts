import { describe, expect, it } from 'vitest';
import { buildSearchTerm, toAlbumCoverCandidates } from './album-cover.mapper.js';
import { checkAlbumCoverUrl } from './album-cover-url.js';
import type { ItunesTrack } from './itunes.client.js';

/**
 * 실제 iTunes 응답(`country=US`, `term=0+0 한로로`)에서 쓰는 필드만 추린 fixture.
 *
 * 이 응답의 아트워크 base가 DB에 저장된 id 1번 곡의 `album` 값과 바이트 단위로
 * 일치하는 것을 확인했다 — 기존 데이터도 같은 스토어프런트에서 왔다는 뜻이다.
 */
const HANRORO_ARTWORK_BASE =
  'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/c8/a4/c6/c8a4c64f-89b3-9ef2-473f-4ad423a03c5b/887928030421.jpg';

const realTrack: ItunesTrack = {
  trackName: '0+0',
  artistName: 'HANRORO',
  collectionName: 'JAMONG SALGU CLUB',
  artworkUrl100: `${HANRORO_ARTWORK_BASE}/100x100bb.jpg`,
};

describe('buildSearchTerm', () => {
  it('제목과 가수를 공백으로 잇는다', () => {
    expect(buildSearchTerm('0+0', '한로로')).toBe('0+0 한로로');
  });

  it('가수가 없으면 제목만 쓴다', () => {
    expect(buildSearchTerm('0+0', null)).toBe('0+0');
    expect(buildSearchTerm('0+0', '   ')).toBe('0+0');
  });

  it('앞뒤 공백과 연속 공백을 정리한다', () => {
    expect(buildSearchTerm('  빨간   피터 ', ' 쏜애플 ')).toBe('빨간 피터 쏜애플');
  });

  it('NFD로 들어온 한글을 NFC로 맞춘다', () => {
    // macOS에서 복사한 문자열은 자모가 분리돼 있어 눈에 같아 보여도 다른 검색어가 된다
    const decomposed = '한로로'.normalize('NFD');

    expect(decomposed).not.toBe('한로로');
    expect(buildSearchTerm('0+0', decomposed)).toBe('0+0 한로로');
  });

  it('괄호나 feat.을 제거하지 않는다', () => {
    // 근거 없이 쿼리를 가공하지 않는다는 결정을 고정한다
    expect(buildSearchTerm('Song (feat. Someone)', '가수')).toBe(
      'Song (feat. Someone) 가수',
    );
  });
});

describe('toAlbumCoverCandidates', () => {
  it('artworkUrl100을 600x600으로 정규화한다', () => {
    const [candidate] = toAlbumCoverCandidates([realTrack]);

    expect(candidate.artworkUrl).toBe(`${HANRORO_ARTWORK_BASE}/600x600bb.jpg`);
    expect(candidate).toMatchObject({
      trackName: '0+0',
      artistName: 'HANRORO',
      collectionName: 'JAMONG SALGU CLUB',
    });
  });

  it('정규화 결과가 저장 검증을 그대로 통과한다', () => {
    // 후보로 준 값을 되돌려 보냈는데 400이 나면 안 된다
    const [candidate] = toAlbumCoverCandidates([realTrack]);

    expect(checkAlbumCoverUrl(candidate.artworkUrl)).toBeNull();
  });

  it('프론트의 shrinkAlbumCoverUrl이 치환할 수 있는 형태다', () => {
    // src/lib/mzstatic.ts가 /\/\d+x\d+bb\.jpg$/i 를 112px로 치환한다.
    // 꼬리표 형태가 다르면 축소가 동작하지 않아 600px 원본이 그대로 내려간다.
    const [candidate] = toAlbumCoverCandidates([realTrack]);

    expect(candidate.artworkUrl.replace(/\/\d+x\d+bb\.jpg$/i, '/112x112bb.jpg')).toBe(
      `${HANRORO_ARTWORK_BASE}/112x112bb.jpg`,
    );
  });

  it('아트워크가 같은 트랙은 하나로 묶는다', () => {
    // 같은 앨범의 수록곡들은 커버가 같아서, 그대로 두면 후보가 전부 같은 이미지가 된다
    const sameAlbum: ItunesTrack[] = [
      realTrack,
      { ...realTrack, trackName: '다른 수록곡' },
      { ...realTrack, trackName: '또 다른 수록곡' },
    ];

    const candidates = toAlbumCoverCandidates(sameAlbum);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].trackName).toBe('0+0');
  });

  it('iTunes가 준 순서를 그대로 유지한다', () => {
    const tracks: ItunesTrack[] = ['A', 'B', 'C'].map((name) => ({
      ...realTrack,
      trackName: name,
      artworkUrl100: `https://is1-ssl.mzstatic.com/image/thumb/${name}/x.jpg/100x100bb.jpg`,
    }));

    expect(toAlbumCoverCandidates(tracks).map((c) => c.trackName)).toEqual([
      'A',
      'B',
      'C',
    ]);
  });

  it('중복 제거 후 최대 5개까지만 돌려준다', () => {
    const tracks: ItunesTrack[] = Array.from({ length: 10 }, (_, index) => ({
      ...realTrack,
      trackName: `곡 ${index}`,
      artworkUrl100: `https://is1-ssl.mzstatic.com/image/thumb/A${index}/x.jpg/100x100bb.jpg`,
    }));

    expect(toAlbumCoverCandidates(tracks)).toHaveLength(5);
  });

  it('아트워크가 없거나 형태가 다른 트랙은 건너뛴다', () => {
    const tracks: ItunesTrack[] = [
      { trackName: '아트워크 없음' },
      { trackName: '꼬리표 없음', artworkUrl100: 'https://is1-ssl.mzstatic.com/a.jpg' },
      realTrack,
    ];

    const candidates = toAlbumCoverCandidates(tracks);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].trackName).toBe('0+0');
  });

  it('빈 응답은 빈 배열이다', () => {
    expect(toAlbumCoverCandidates([])).toEqual([]);
  });

  it('필드가 비어도 빈 문자열로 채워 응답 모양을 유지한다', () => {
    const [candidate] = toAlbumCoverCandidates([
      { artworkUrl100: `${HANRORO_ARTWORK_BASE}/100x100bb.jpg` },
    ]);

    expect(candidate).toEqual({
      trackName: '',
      artistName: '',
      collectionName: '',
      artworkUrl: `${HANRORO_ARTWORK_BASE}/600x600bb.jpg`,
    });
  });

  it('허용되지 않은 호스트라도 후보에서 걸러내지 않는다', () => {
    // 걸러 버리면 "후보 없음"으로 보여 벤치마크가 호스트 분포를 관측할 수 없다
    const other: ItunesTrack = {
      ...realTrack,
      artworkUrl100: 'https://is5-ssl.mzstatic.com/image/thumb/A/x.jpg/100x100bb.jpg',
    };

    const candidates = toAlbumCoverCandidates([other]);

    expect(candidates).toHaveLength(1);
    expect(checkAlbumCoverUrl(candidates[0].artworkUrl)).not.toBeNull();
  });
});
