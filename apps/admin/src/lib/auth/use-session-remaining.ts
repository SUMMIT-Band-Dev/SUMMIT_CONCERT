"use client";

import { useSyncExternalStore } from "react";
import { decodeTokenExpiry, readToken, subscribeToken } from "./token-storage";

/** 1분마다 바뀌는 시각(분 단위). 남은 시간 표시를 분 단위로만 갱신한다 */
function subscribeMinuteTick(callback: () => void): () => void {
  const timer = setInterval(callback, 30_000);
  return () => clearInterval(timer);
}

/**
 * 현재 토큰이 만료될 때까지 남은 시간(ms). 토큰이 없거나 만료 시각을 읽을 수 없으면 null.
 * 서버 렌더링·하이드레이션 중에는 null이다(불일치 방지).
 */
export function useSessionRemainingMs(): number | null {
  const token = useSyncExternalStore(subscribeToken, () => readToken(), () => null);
  const nowMinute = useSyncExternalStore(subscribeMinuteTick, () => Math.floor(Date.now() / 60_000), () => 0);

  if (!token || nowMinute === 0) return null;
  const expiry = decodeTokenExpiry(token);
  return expiry === null ? null : Math.max(0, expiry - nowMinute * 60_000);
}
