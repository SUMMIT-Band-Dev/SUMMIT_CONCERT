// 관리자 토큰의 저장·조회. localStorage에 둔다(7c-1 결정: 새로고침·새 탭에서도 로그인 유지, 로그인 5회/5분 한도 보호).
//
// 이 파일이 토큰을 읽고 쓰는 유일한 곳이다. 토큰을 로그·오류 화면·URL·analytics에 남기지 않는다.
// 저장소는 접근이 막히거나 예외를 던질 수 있다(사생활 보호 모드, 저장소 차단 등). 모든 접근을 try/catch로 감싸고,
// 저장에 실패하면 "메모리에서만 유지"로 동작을 이어 간다(새로고침하면 다시 로그인).

export const TOKEN_STORAGE_KEY = "summit-admin-token";

/** 만료 직전에 보낸 요청이 서버에서 만료 판정을 받지 않도록 두는 여유 */
export const EXPIRY_SKEW_MS = 10_000;

function getBrowserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

// 저장소를 쓸 수 없을 때(접근 차단·쓰기 실패)를 위한 메모리 보관본.
// **저장소가 정상이면 저장소가 유일한 진실이다.** 메모리 값을 함께 들고 있다가 저장소에서 사라진 뒤에도 돌려주면,
// 다른 탭의 로그아웃(저장소 삭제)이 이 탭에는 반영되지 않는다.
let memoryToken: string | null = null;
let useMemoryOnly = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function readToken(storage: Storage | null = getBrowserStorage()): string | null {
  if (useMemoryOnly || !storage) return memoryToken;
  try {
    return storage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return memoryToken;
  }
}

export function writeToken(token: string, storage: Storage | null = getBrowserStorage()): void {
  memoryToken = token;
  useMemoryOnly = false;
  try {
    if (!storage) throw new Error('저장소 없음');
    storage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // 저장 실패: 이 탭에서는 메모리 보관본으로 계속 동작한다(새로고침하면 다시 로그인)
    useMemoryOnly = true;
  }
  notify();
}

export function clearToken(storage: Storage | null = getBrowserStorage()): void {
  memoryToken = null;
  useMemoryOnly = false;
  try {
    storage?.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // 무시
  }
  notify();
}

/** 같은 탭의 변경(notify)과 다른 탭의 변경(storage 이벤트)을 함께 구독한다. useSyncExternalStore용 */
export function subscribeToken(callback: () => void): () => void {
  listeners.add(callback);
  const onStorage = (event: StorageEvent) => {
    // key가 null이면 다른 탭이 storage.clear()를 부른 경우다
    if (event.key === TOKEN_STORAGE_KEY || event.key === null) callback();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

function decodeBase64Url(segment: string): string | null {
  try {
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/**
 * 토큰의 만료 시각(ms). **서명을 검증하지 않는다** — 브라우저는 시크릿이 없고, 이 값은 "언제 재로그인 안내를 띄울지"를
 * 정하는 UX 용도일 뿐이다. 실제 인증 판단은 서버(API의 JWT Guard)가 한다. 해석할 수 없으면 null.
 */
export function decodeTokenExpiry(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const json = decodeBase64Url(parts[1]);
  if (json === null) return null;
  try {
    const payload = JSON.parse(json) as { exp?: unknown };
    return typeof payload.exp === "number" && Number.isFinite(payload.exp) ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** 만료됐거나 모양이 JWT가 아니면 true. exp가 없는 토큰은 서버가 판단하도록 유효로 둔다 */
export function isTokenExpired(token: string, nowMs: number = Date.now()): boolean {
  if (token.split(".").length !== 3) return true;
  const expiry = decodeTokenExpiry(token);
  return expiry !== null && expiry - EXPIRY_SKEW_MS <= nowMs;
}
