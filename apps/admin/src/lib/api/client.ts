// 관리자 API 호출의 유일한 통로. 화면 코드는 fetch를 직접 부르지 않고 이 함수를 쓴다.
//
// - Authorization 헤더로 토큰을 보낸다(쿠키 미사용: credentials "omit", API의 CORS도 credentials:false)
// - 오류는 ApiError로 정규화한다(errors.ts). 토큰·요청 헤더는 오류 객체에 담지 않고 어디에도 로그로 남기지 않는다
// - 재시도하지 않는다. POST/PUT/PATCH는 재시도하면 중복 등록이 될 수 있고, 조회 재시도는 서버 상태 관리(TanStack Query)가 정한다
// - 401(인증 요청 중)이면 등록된 onUnauthorized를 부른다. 로그인 요청(auth:false)의 401은 "자격증명이 틀림"이라 부르지 않는다

import { getApiBaseUrl } from "./config";
import { ApiError, buildApiError, buildClientError } from "./errors";

export interface ApiClientHooks {
  /** 저장된 토큰. 없으면 null */
  getToken: () => string | null;
  /** 인증이 필요한 요청이 401을 받았을 때(만료·무효). 화면은 이때 재로그인 흐름을 띄운다 */
  onUnauthorized: () => void;
}

let hooks: ApiClientHooks = { getToken: () => null, onUnauthorized: () => {} };

export function configureApiClient(next: Partial<ApiClientHooks>): void {
  hooks = { ...hooks, ...next };
}

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT";
  /** 객체는 JSON으로, FormData는 그대로(multipart 경계는 브라우저가 붙인다) 보낸다 */
  body?: unknown;
  /** false면 토큰을 붙이지 않고 401을 "재로그인 필요"로 취급하지 않는다(로그인 요청) */
  auth?: boolean;
  /** 기본 15초. 유튜브 배치는 최악 25~50초라 호출하는 쪽이 늘려야 한다 */
  timeoutMs?: number;
  /** 화면이 언마운트되거나 사용자가 취소할 때 */
  signal?: AbortSignal;
  /** 테스트용 주입 */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export const DEFAULT_TIMEOUT_MS = 15_000;

function assertSafePath(path: string): void {
  // 절대 URL이나 `//host`가 들어오면 기준 주소 대신 다른 곳으로 토큰이 나갈 수 있다
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://") || path.includes("\\")) {
    throw new TypeError("API 경로는 '/'로 시작하는 상대 경로여야 합니다.");
  }
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  assertSafePath(path);

  const { method = "GET", body, auth = true, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = options;
  const fetchImpl = options.fetchImpl ?? fetch;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (auth) {
    const token = hooks.getToken();
    // 토큰이 없으면 네트워크를 타지 않는다. 화면의 보호 라우트가 로그인으로 보낸다
    if (!token) throw buildClientError("unauthorized");
    headers.Authorization = `Bearer ${token}`;
  }

  let requestBody: BodyInit | undefined;
  if (body instanceof FormData) {
    requestBody = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    requestBody = JSON.stringify(body);
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onExternalAbort, { once: true });
  }

  try {
    let response: Response;
    let bodyText = "";
    try {
      response = await fetchImpl(`${options.baseUrl ?? getApiBaseUrl()}${path}`, {
        method,
        headers,
        body: requestBody,
        signal: controller.signal,
        cache: "no-store",
        credentials: "omit",
        mode: "cors",
        referrerPolicy: "no-referrer",
      });
      // 본문 읽기도 같은 타임아웃·취소 아래에 둔다(느린 응답 본문에서 멈추지 않게)
      bodyText = await response.text().catch((error: unknown) => {
        if (controller.signal.aborted) throw error;
        return "";
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw buildClientError(timedOut ? "timeout" : "aborted");
      }
      throw error instanceof ApiError ? error : buildClientError("network");
    }

    if (!response.ok) {
      const apiError = buildApiError({
        status: response.status,
        bodyText,
        retryAfterHeader: response.headers.get("Retry-After"),
      });
      if (apiError.kind === "unauthorized" && auth) {
        try {
          hooks.onUnauthorized();
        } catch {
          // 재로그인 흐름의 오류가 원래 오류를 가리지 않게 한다
        }
      }
      throw apiError;
    }

    if (response.status === 204 || bodyText.trim() === "") {
      return undefined as T;
    }
    try {
      return JSON.parse(bodyText) as T;
    } catch {
      throw buildClientError("unknown", "서버 응답을 해석할 수 없습니다. 잠시 후 다시 시도해 주세요.");
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onExternalAbort);
  }
}
