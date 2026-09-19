/**
 * 앨범 커버 후보 (PRD F010). `GET /songs/:id/album-cover/candidates`의 응답 계약.
 *
 * iTunes 응답을 그대로 흘려보내지 않고 네 필드로 줄인다 — 나머지(가격, 미리듣기 URL,
 * 장르 등)는 관리자가 커버를 고르는 데 쓰이지 않고, 외부 응답 모양이 그대로 우리
 * API 계약이 되면 애플이 필드를 바꿀 때 클라이언트가 같이 깨진다.
 */
export interface AlbumCoverCandidate {
  trackName: string;
  artistName: string;
  collectionName: string;
  /**
   * 이미 `600x600bb.jpg`로 정규화된 주소.
   * 이 값을 그대로 `PUT /songs/:id/album-cover`의 `url`로 보내면 된다.
   */
  artworkUrl: string;
}
