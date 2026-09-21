// API 오류를 화면이 다룰 수 있는 형태로 정규화한다.
//
// 서버의 공통 오류 형식은 `{ message, error, statusCode }`이고 message는 문자열 또는 문자열 배열이다(apps/api의 AllExceptionsFilter).
// **서버가 준 한국어 메시지는 가공하지 않고 그대로 보여 준다.** 다만 프레임워크 기본 영문 메시지("Not Found",
// "request entity too large" 등)와 프록시가 만든 오류(502/504)는 사람이 읽을 수 없으므로 종류별 한국어 문구로 대체한다.
// 구분은 "한글이 한 글자라도 있으면 서버가 의도한 문구"라는 규칙으로 한다.
//
// 메시지에는 요청 값이 섞일 수 있다. 이 모듈은 문자열만 돌려주고, **렌더링은 반드시 텍스트로만** 해야 한다
// (dangerouslySetInnerHTML 금지). 토큰·요청 헤더는 ApiError에 담지 않는다.

export type ApiErrorKind =
  | "network"
  | "timeout"
  | "aborted"
  | "validation"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "payload_too_large"
  | "unsupported_media_type"
  | "rate_limited"
  | "server"
  | "unknown";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** HTTP 상태. 응답을 받지 못한 오류(network/timeout/aborted)는 null */
  readonly status: number | null;
  /** 화면에 보여 줄 메시지들(한국어). 검증 오류는 여러 개일 수 있다 */
  readonly messages: string[];
  /** 429의 Retry-After(초). 없으면 null */
  readonly retryAfterSec: number | null;

  constructor(init: { kind: ApiErrorKind; status: number | null; messages: string[]; retryAfterSec?: number | null }) {
    super(init.messages.join(" "));
    this.name = "ApiError";
    this.kind = init.kind;
    this.status = init.status;
    this.messages = init.messages;
    this.retryAfterSec = init.retryAfterSec ?? null;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

/** 409는 "그 사이 다른 곳에서 바뀜"을 뜻한다. 서버 메시지 뒤에 붙여 목록 새로고침을 안내한다 */
export const CONFLICT_REFRESH_HINT = "목록을 새로고침한 뒤 다시 시도해 주세요.";

const FALLBACK_MESSAGES: Record<ApiErrorKind, string> = {
  network: "서버에 연결할 수 없습니다. 네트워크 상태를 확인하고 다시 시도해 주세요.",
  timeout: "서버 응답이 너무 오래 걸립니다. 잠시 후 다시 시도해 주세요.",
  aborted: "요청이 취소되었습니다.",
  validation: "입력한 내용을 확인해 주세요.",
  unauthorized: "로그인이 필요합니다. 다시 로그인해 주세요.",
  forbidden: "이 작업을 할 권한이 없습니다.",
  not_found: "요청한 항목을 찾을 수 없습니다.",
  conflict: "다른 곳에서 먼저 변경되었습니다.",
  payload_too_large: "파일이 너무 큽니다. 더 작은 파일을 올려 주세요.",
  unsupported_media_type: "지원하지 않는 파일 형식입니다.",
  rate_limited: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  server: "서버에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  unknown: "알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
};

export function fallbackMessage(kind: ApiErrorKind): string {
  return FALLBACK_MESSAGES[kind];
}

export function kindFromStatus(status: number): ApiErrorKind {
  switch (status) {
    case 400:
      return "validation";
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 413:
      return "payload_too_large";
    case 415:
      return "unsupported_media_type";
    case 429:
      return "rate_limited";
    default:
      return status >= 500 ? "server" : "unknown";
  }
}

const HANGUL = /[가-힣]/;
const MAX_MESSAGES = 10;
const MAX_MESSAGE_LENGTH = 300;

/** 응답 본문(JSON)에서 서버가 의도한 한국어 메시지만 뽑는다. 없으면 빈 배열 */
export function extractServerMessages(bodyText: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return [];
  }
  if (typeof parsed !== "object" || parsed === null) return [];

  const raw = (parsed as { message?: unknown }).message;
  const candidates = typeof raw === "string" ? [raw] : Array.isArray(raw) ? raw : [];

  return candidates
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && HANGUL.test(item))
    .slice(0, MAX_MESSAGES)
    .map((item) => (item.length > MAX_MESSAGE_LENGTH ? `${item.slice(0, MAX_MESSAGE_LENGTH)}…` : item));
}

const MAX_RETRY_AFTER_SEC = 24 * 60 * 60;

/** `Retry-After`(초 정수 또는 HTTP 날짜)를 초 단위로. 해석할 수 없으면 null */
export function parseRetryAfter(header: string | null | undefined, nowMs: number = Date.now()): number | null {
  const value = header?.trim();
  if (!value) return null;

  if (/^\d+$/.test(value)) {
    return Math.min(Number(value), MAX_RETRY_AFTER_SEC);
  }
  // HTTP 날짜는 요일·월 이름이 있는 형식이다. Date.parse는 "-5" 같은 값도 연도로 읽어 버리므로 먼저 걸러낸다
  if (!/[A-Za-z]{3}/.test(value)) return null;
  const at = Date.parse(value);
  if (Number.isNaN(at)) return null;
  return Math.min(Math.max(0, Math.ceil((at - nowMs) / 1000)), MAX_RETRY_AFTER_SEC);
}

/** "N초 뒤" / "N분 뒤". 남은 시간을 사람이 읽는 문장으로 */
export function formatRetryAfter(seconds: number): string {
  if (seconds <= 0) return "잠시 뒤";
  if (seconds < 60) return `${seconds}초 뒤`;
  return `${Math.ceil(seconds / 60)}분 뒤`;
}

export function buildApiError(input: {
  status: number;
  bodyText: string;
  retryAfterHeader?: string | null;
  nowMs?: number;
}): ApiError {
  const kind = kindFromStatus(input.status);
  const retryAfterSec = kind === "rate_limited" ? parseRetryAfter(input.retryAfterHeader, input.nowMs) : null;

  let messages = extractServerMessages(input.bodyText);
  if (messages.length === 0) {
    messages = [fallbackMessage(kind)];
  }
  // 429: 서버 문구는 "잠시 후"라고만 하는 고정 문구라, 남은 시간을 아는 경우 그 시간으로 바꿔 안내한다
  // (남은 시도 횟수는 서버가 알려 주지 않고, 우리도 만들어 내지 않는다)
  if (kind === "rate_limited" && retryAfterSec !== null) {
    messages = [`요청이 너무 많습니다. ${formatRetryAfter(retryAfterSec)}에 다시 시도해 주세요.`];
  }
  if (kind === "conflict") {
    messages = [...messages, CONFLICT_REFRESH_HINT];
  }

  return new ApiError({ kind, status: input.status, messages, retryAfterSec });
}

export function buildClientError(kind: "network" | "timeout" | "aborted" | "unauthorized" | "unknown", message?: string): ApiError {
  return new ApiError({ kind, status: null, messages: [message ?? fallbackMessage(kind)] });
}

/** 조회(GET) 재시도 판단: 일시적 네트워크·서버 오류만 한 번 더 시도한다. 4xx와 취소는 다시 해도 같다 */
export function isRetryableRead(error: unknown, failureCount: number): boolean {
  if (failureCount >= 1) return false;
  return isApiError(error) && (error.kind === "network" || error.kind === "server" || error.kind === "timeout");
}
