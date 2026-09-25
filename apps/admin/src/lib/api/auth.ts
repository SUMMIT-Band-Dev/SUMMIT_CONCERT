import { apiRequest, type ApiRequestOptions } from "./client";
import type { AdminProfile, LoginCredentials, LoginResult } from "./types";

/** POST /auth/login. 토큰 없이 호출하고, 401은 "자격증명이 틀림"이다(재로그인 흐름을 띄우지 않는다) */
export function login(credentials: LoginCredentials, options: Pick<ApiRequestOptions, "signal"> = {}): Promise<LoginResult> {
  return apiRequest<LoginResult>("/auth/login", { method: "POST", body: credentials, auth: false, ...options });
}

/** GET /auth/me. 저장된 토큰이 아직 유효한지 확인하고 계정 이름을 얻는다 */
export function getMe(options: Pick<ApiRequestOptions, "signal"> = {}): Promise<AdminProfile> {
  return apiRequest<AdminProfile>("/auth/me", options);
}
