// 유튜브 URL 관리 (F025). 미러링: apps/api/src/youtube/youtube-url.controller.ts
import { apiRequest, type ApiRequestOptions } from "./client";
import type { Song } from "./types";

/** PUT /songs/:id/youtube-url. 유효한 유튜브 주소를 정규화해 저장한다. */
export function updateYoutubeUrl(songId: string, url: string, options: Pick<ApiRequestOptions, "signal"> = {}): Promise<Song> {
  return apiRequest<Song>(`/songs/${encodeURIComponent(songId)}/youtube-url`, { method: "PUT", body: { url }, ...options });
}

/** DELETE /songs/:id/youtube-url. 빈 값 저장 시 연결을 해제한다. */
export function removeYoutubeUrl(songId: string, options: Pick<ApiRequestOptions, "signal"> = {}): Promise<Song> {
  return apiRequest<Song>(`/songs/${encodeURIComponent(songId)}/youtube-url`, { method: "DELETE", ...options });
}
