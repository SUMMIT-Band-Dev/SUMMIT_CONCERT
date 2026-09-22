// "세션이 만료됐다"는 사실을 앱 전체가 공유하는 작은 저장소(useSyncExternalStore용).
//
// 401을 받거나 토큰 만료 시각이 지나면 여기에 **만료된 토큰**을 기록한다. 화면은 이 값이 현재 토큰과 같을 때
// 페이지를 떠나지 않고 그 자리에 재로그인 대화상자를 띄운다 — 페이지가 그대로 마운트돼 있으므로
// **작성 중이던 폼 내용이 보존된다**(로그인 페이지로 이동하면 언마운트되어 잃는다).
// 새 토큰으로 로그인하면 값이 현재 토큰과 달라져 대화상자가 자동으로 닫힌다.

let expiredToken: string | null = null;
const listeners = new Set<() => void>();

export function markSessionExpired(token: string | null): void {
  if (!token || expiredToken === token) return;
  expiredToken = token;
  listeners.forEach((listener) => listener());
}

export function getExpiredToken(): string | null {
  return expiredToken;
}

export function clearSessionExpiry(): void {
  if (expiredToken === null) return;
  expiredToken = null;
  listeners.forEach((listener) => listener());
}

export function subscribeSessionExpiry(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
