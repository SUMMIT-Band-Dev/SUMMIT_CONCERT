// 곡(Setlist) · 앨범 커버 API.
// 미러링: apps/api/src/songs/{team-songs,songs}.controller.ts, apps/api/src/album-cover/album-cover.controller.ts
//
// 삭제 엔드포인트는 없다 — 서버가 MVP 스코프 밖으로 뺀 결정이라(team-songs.controller.ts 주석),
// 이 화면도 삭제 UI를 만들지 않는다(팀과 같은 방침).

import { apiRequest, type ApiRequestOptions } from "./client";
import type { AlbumCoverCandidate, Song } from "./types";

/**
 * GET /teams/:teamId/songs. 정렬은 `id` 오름차순으로 **서버가 고정**한다.
 *
 * `Setlist`에 순서 컬럼이 없고 공개 프론트도 같은 순서로 읽기 때문이다 —
 * 관리자 화면이 다른 순서로 보여 주면 "관리자에서 본 순서"와 "방문자가 보는 순서"가 갈린다.
 * 그래서 이 화면에는 곡 재정렬 기능이 없다.
 *
 * 없는 팀은 빈 배열이 아니라 404다(잘못된 id와 "아직 곡 없음"을 구분할 수 있게).
 */
export function listTeamSongs(teamId: string, options: Pick<ApiRequestOptions, "signal"> = {}): Promise<Song[]> {
  return apiRequest<Song[]>(`/teams/${encodeURIComponent(teamId)}/songs`, options);
}

export interface CreateSongInput {
  title: string;
  singer: string;
}

/**
 * POST /teams/:teamId/songs. 소속 팀은 **경로로만** 정해진다(본문에 teamId가 없다 = 곡의 팀 이동 불가).
 * 같은 팀에 제목+가수가 같은 곡이 있으면 409.
 */
export function createSong(
  teamId: string,
  input: CreateSongInput,
  options: Pick<ApiRequestOptions, "signal"> = {},
): Promise<Song> {
  return apiRequest<Song>(`/teams/${encodeURIComponent(teamId)}/songs`, { method: "POST", body: input, ...options });
}

export interface UpdateSongInput {
  title?: string;
  singer?: string;
}

/**
 * PATCH /songs/:id. 제목·가수만 바꾼다.
 *
 * ⚠️ 제목이나 가수가 **실제로** 바뀌면 서버가 `youtubeReviewStatus`를 `pending`으로 되돌린다
 * (유튜브 URL 자체는 유지). 곡을 다른 곡으로 바꿔 놓고 이전 곡의 영상이 승인 상태로 남는 것을
 * 막기 위한 서버 동작이라, 화면이 이 부작용을 관리자에게 알려 줘야 한다.
 */
export function updateSong(
  id: string,
  input: UpdateSongInput,
  options: Pick<ApiRequestOptions, "signal"> = {},
): Promise<Song> {
  return apiRequest<Song>(`/songs/${encodeURIComponent(id)}`, { method: "PATCH", body: input, ...options });
}

/**
 * GET /songs/:id/album-cover/candidates. 앨범 커버 후보 최대 5개 (PRD F010).
 *
 * **DB에 쓰지 않는 읽기 전용 호출**이지만 iTunes로 나가는 외부 호출이라
 * 프로세스 전체에서 분당 15회 예산을 공유한다(초과 시 429 + Retry-After).
 * 그래서 화면은 이 함수를 자동으로 부르지 않고 관리자가 버튼을 눌렀을 때만 부른다.
 *
 * 0건은 오류가 아니라 정상 응답(빈 배열 + 200)이다 — "애플 카탈로그에 없음"과
 * "검색 자체가 실패"를 화면이 구분해서 안내해야 한다.
 */
export function fetchAlbumCoverCandidates(
  songId: string,
  options: Pick<ApiRequestOptions, "signal"> = {},
): Promise<AlbumCoverCandidate[]> {
  return apiRequest<AlbumCoverCandidate[]>(`/songs/${encodeURIComponent(songId)}/album-cover/candidates`, options);
}

/**
 * PUT /songs/:id/album-cover. 고른 후보(또는 직접 입력한 주소)를 반영한다.
 *
 * 서버가 호스트 allowlist(`is1-ssl.mzstatic.com`)·경로 형태(`…/600x600bb.jpg`)·길이를 검사하고
 * 실패하면 400을 준다. 화면은 같은 규칙으로 먼저 걸러 "왜 거부됐는지"를 알려 준다.
 */
export function updateAlbumCover(
  songId: string,
  url: string,
  options: Pick<ApiRequestOptions, "signal"> = {},
): Promise<Song> {
  return apiRequest<Song>(`/songs/${encodeURIComponent(songId)}/album-cover`, { method: "PUT", body: { url }, ...options });
}
