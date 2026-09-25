// 로그인 429(15분 차단)를 받은 뒤 "언제까지 시도하지 않을지"를 기억한다.
//
// 상태를 메모리에만 두면 새로고침으로 사라지고, 비개발자 사용자가 차단 중에 새로고침하며 계속 눌러 보게 된다.
// sessionStorage(탭 단위)에 종료 시각을 두어 새로고침 뒤에도 버튼을 잠근다. 남은 시도 횟수는 표시하지 않는다(서버도 숨긴다).

export const LOGIN_BLOCK_STORAGE_KEY = "summit-admin-login-blocked-until";

/** Retry-After를 받지 못한 429일 때의 임시 잠금(서버 값을 지어내지 않고, 짧게만 멈춘다) */
export const FALLBACK_BLOCK_SECONDS = 60;

function getSessionStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

// 저장소를 쓸 수 없을 때를 위한 메모리 보관본
let memoryBlockedUntil: number | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribeBlockedUntil(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/** 잠금 종료 시각(ms epoch)을 그대로 돌려준다. 지났는지는 호출하는 쪽이 remainingSeconds로 판단한다(스냅샷이 안정적이도록) */
export function readBlockedUntil(storage: Storage | null = getSessionStorage()): number | null {
  try {
    const raw = storage?.getItem(LOGIN_BLOCK_STORAGE_KEY);
    if (raw) {
      const until = Number(raw);
      if (Number.isFinite(until)) return until;
    }
  } catch {
    // 아래 메모리 보관본으로
  }
  return memoryBlockedUntil;
}

export function saveBlockedUntil(retryAfterSec: number | null, nowMs: number = Date.now(), storage: Storage | null = getSessionStorage()): number {
  const seconds = retryAfterSec !== null && retryAfterSec > 0 ? retryAfterSec : FALLBACK_BLOCK_SECONDS;
  // 종료 시각을 초 단위로 내린다: 화면은 1초 단위 시각으로 남은 시간을 계산하므로, 내리지 않으면 15분(900초)이 "16분 뒤"로 보인다
  const until = Math.floor((nowMs + seconds * 1000) / 1000) * 1000;
  memoryBlockedUntil = until;
  try {
    storage?.setItem(LOGIN_BLOCK_STORAGE_KEY, String(until));
  } catch {
    // 저장 실패: 메모리 보관본으로 이번 화면 동안만 잠근다
  }
  notify();
  return until;
}

export function clearBlockedUntil(storage: Storage | null = getSessionStorage()): void {
  memoryBlockedUntil = null;
  try {
    storage?.removeItem(LOGIN_BLOCK_STORAGE_KEY);
  } catch {
    // 무시
  }
  notify();
}

export function remainingSeconds(blockedUntil: number | null, nowMs: number = Date.now()): number {
  return blockedUntil === null ? 0 : Math.max(0, Math.ceil((blockedUntil - nowMs) / 1000));
}
