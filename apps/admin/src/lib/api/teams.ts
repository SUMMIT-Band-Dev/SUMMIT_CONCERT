// 팀(Line Up) API. 미러링: apps/api/src/teams/teams.controller.ts, teams.service.ts
//
// 삭제 엔드포인트는 없다 — 서버가 MVP 스코프 밖으로 뺀 결정이라(teams.controller.ts 주석),
// 이 화면도 삭제 UI를 만들지 않는다. 오입력은 수정으로 대응한다.

import { apiRequest, type ApiRequestOptions } from "./client";
import type { Team } from "./types";

/** GET /teams. day → performanceOrder → id 순으로 정렬된 전체 팀을 돌려준다(서버가 정렬을 맡는다) */
export function listTeams(options: Pick<ApiRequestOptions, "signal"> = {}): Promise<Team[]> {
  return apiRequest<Team[]>("/teams", options);
}

export interface CreateTeamInput {
  teamName: string;
  day: string;
  performanceOrder: number;
}

/** POST /teams. 같은 day에 performanceOrder가 이미 쓰이고 있으면 409(서버가 뒤로 밀어 주지 않는다) */
export function createTeam(input: CreateTeamInput, options: Pick<ApiRequestOptions, "signal"> = {}): Promise<Team> {
  return apiRequest<Team>("/teams", { method: "POST", body: input, ...options });
}

export interface UpdateTeamInput {
  teamName?: string;
  day?: string;
}

/** PATCH /teams/:id. day가 실제로 바뀌면 서버가 순서를 대상 일자의 맨 뒤로 재배치한다(performanceOrder는 여기서 보낼 수 없다) */
export function updateTeam(id: string, input: UpdateTeamInput, options: Pick<ApiRequestOptions, "signal"> = {}): Promise<Team> {
  return apiRequest<Team>(`/teams/${encodeURIComponent(id)}`, { method: "PATCH", body: input, ...options });
}

export interface ReorderTeamsInput {
  day: string;
  /** 해당 day 전체 팀 id를 원하는 순서대로. 부분 목록은 서버가 400으로 거부한다 */
  teamIds: string[];
}

/** PATCH /teams/reorder. 배열 인덱스로 1..N을 서버가 부여하고, 재정렬된 해당 day 팀 전체를 돌려준다 */
export function reorderTeams(input: ReorderTeamsInput, options: Pick<ApiRequestOptions, "signal"> = {}): Promise<Team[]> {
  return apiRequest<Team[]>("/teams/reorder", { method: "PATCH", body: input, ...options });
}

/** 업로드 파일의 필드명. 서버 multer가 이 이름만 받는다(다르면 400) */
export const CARD_IMAGE_FIELD_NAME = "file";

/**
 * PUT /teams/:id/card-image. 카드뉴스 이미지 교체 (multipart/form-data).
 *
 * 서버는 업로드마다 **새 경로**에 저장하고 이전 객체는 지우지 않는다(CDN 캐시를 비울 수단이 없어서).
 * 즉 이 호출은 되돌릴 수 없는 저장소 쓰기다 — 화면에서 확인 없이 자동으로 부르지 않는다.
 *
 * 파일 하나만, 다른 필드 없이 보낸다(서버 multer `parts: 1`). Content-Type은 붙이지 않는다 —
 * FormData면 브라우저가 multipart 경계를 포함해 직접 설정한다(client.ts 참조).
 */
export function uploadTeamCardImage(
  id: string,
  file: File,
  options: Pick<ApiRequestOptions, "signal" | "timeoutMs"> = {},
): Promise<Team> {
  const body = new FormData();
  body.append(CARD_IMAGE_FIELD_NAME, file);

  return apiRequest<Team>(`/teams/${encodeURIComponent(id)}/card-image`, { method: "PUT", body, ...options });
}
