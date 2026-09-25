import {
  ALBUM_COVER_ARTWORK_SIZE,
  ALBUM_COVER_CANDIDATE_LIMIT,
  ARTWORK_SIZE_SUFFIX_PATTERN,
} from './album-cover.constants.js';
import type { AlbumCoverCandidate } from './dto/album-cover-candidate.js';
import type { ItunesTrack } from './itunes.client.js';

/**
 * 검색어를 만든다 (PRD F010).
 *
 * NFC로 정규화하는 이유는 곡 중복 판정(§12)과 같다 — macOS에서 복사한 한글은
 * 자모가 분리된 NFD로 들어올 수 있고, 그대로 보내면 눈에 같아 보이는 문자열이
 * 다른 검색어가 된다.
 *
 * 괄호나 `feat.` 같은 토큰은 **일부러 제거하지 않는다.** 근거 없이 쿼리를 가공하면
 * 결과가 왜 달라졌는지 설명할 수 없다. 벤치마크에서 필요성이 드러나면 그때 근거를 갖고 바꾼다.
 *
 * 벤치마크 스크립트도 이 함수를 그대로 가져다 쓴다 — 스크립트가 검색어를 따로
 * 만들면 "벤치마크에서는 맞았는데 API에서는 다른 결과"가 나온다.
 */
export function buildSearchTerm(title: string, singer: string | null): string {
  const parts = [normalize(title)];
  const artist = normalize(singer ?? '');

  if (artist) {
    parts.push(artist);
  }

  return parts.filter(Boolean).join(' ');
}

function normalize(value: string): string {
  return value.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/**
 * iTunes 응답을 후보 목록으로 바꾼다.
 *
 * **순위는 iTunes가 준 순서 그대로다.** 점수도 임계값도 두지 않는다 —
 * US 스토어프런트는 한국어 곡을 영문 표기(`빨간 피터` → `Red Peter`,
 * `한로로` → `HANRORO`)로 돌려주기 때문에, 한국어 입력과의 문자열 일치도를
 * 점수로 쓰면 대부분 0점이 나와 숫자에 근거가 없다. 고르는 것은 사람이 한다.
 *
 * 중복 제거 기준은 아트워크 base URL이다. 같은 앨범의 수록곡들이 트랙만 다르고
 * 커버가 같아서, 그대로 두면 후보 5개가 전부 같은 이미지가 된다.
 *
 * 여기서 만든 `artworkUrl`을 allowlist로 걸러내지는 않는다. 걸러 버리면 허용되지
 * 않은 호스트가 나왔을 때 "후보 없음"으로 보여 원인이 가려진다 — 벤치마크가
 * 호스트 분포를 그대로 관측할 수 있어야 한다.
 */
export function toAlbumCoverCandidates(
  tracks: ItunesTrack[],
  limit: number = ALBUM_COVER_CANDIDATE_LIMIT,
): AlbumCoverCandidate[] {
  const seenArtwork = new Set<string>();
  const candidates: AlbumCoverCandidate[] = [];

  for (const track of tracks) {
    const artwork = track.artworkUrl100;

    // 크기 꼬리표가 없으면 600x600으로 바꿀 방법이 없다 — 추측해서 만들지 않고 버린다.
    if (typeof artwork !== 'string' || !ARTWORK_SIZE_SUFFIX_PATTERN.test(artwork)) {
      continue;
    }

    const base = artwork.replace(ARTWORK_SIZE_SUFFIX_PATTERN, '');
    if (seenArtwork.has(base)) {
      continue;
    }
    seenArtwork.add(base);

    candidates.push({
      trackName: track.trackName ?? '',
      artistName: track.artistName ?? '',
      collectionName: track.collectionName ?? '',
      artworkUrl: `${base}/${ALBUM_COVER_ARTWORK_SIZE}`,
    });

    if (candidates.length >= limit) {
      break;
    }
  }

  return candidates;
}
