"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { configureApiClient } from "@/lib/api/client";
import { clearSessionExpiry, getExpiredToken, markSessionExpired, subscribeSessionExpiry } from "./session-expiry";
import { clearToken, decodeTokenExpiry, EXPIRY_SKEW_MS, isTokenExpired, readToken, subscribeToken, writeToken } from "./token-storage";
import type { AuthStatus } from "./guard";

// API 클라이언트에 토큰 조회와 401 처리를 연결한다. 모듈 로드 시점에 해 두는 이유: 자식 컴포넌트의 effect(첫 조회)가
// 부모 Provider의 effect보다 먼저 실행되므로, effect 안에서 연결하면 첫 요청이 토큰 없이 나갈 수 있다.
configureApiClient({
  getToken: () => readToken(),
  onUnauthorized: () => markSessionExpired(readToken()),
});

interface AuthContextValue {
  status: AuthStatus;
  /** 로그인 성공 시 받은 토큰을 저장한다(이후 상태가 authenticated가 된다) */
  signIn: (token: string) => void;
  /** 토큰과 캐시된 서버 데이터를 지운다 */
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // undefined = 아직 하이드레이션 전(서버 렌더링·첫 클라이언트 렌더링). 이 동안은 로그인 여부를 판단하지 않는다
  const storedToken = useSyncExternalStore<string | null | undefined>(subscribeToken, () => readToken(), () => undefined);
  const expiredToken = useSyncExternalStore(subscribeSessionExpiry, getExpiredToken, () => null);
  const [mountedAt] = useState(() => Date.now());

  // 이 페이지를 열 때 이미 만료돼 있던 토큰은 "로그인 안 됨"이다(로그인 페이지로 보낸다).
  // 사용 중에 만료된 토큰은 "expired"다(페이지를 유지한 채 재로그인 대화상자). 둘을 구분해야 입력 중인 폼을 잃지 않는다
  let status: AuthStatus;
  if (storedToken === undefined) status = "loading";
  else if (storedToken === null || isTokenExpired(storedToken, mountedAt)) status = "unauthenticated";
  else if (expiredToken === storedToken) status = "expired";
  else status = "authenticated";

  // 열 때부터 만료돼 있던 토큰은 저장소에서 치운다
  useEffect(() => {
    if (storedToken && isTokenExpired(storedToken, mountedAt)) clearToken();
  }, [storedToken, mountedAt]);

  // 사용 중 만료 시각이 되면 재로그인을 안내한다. 백그라운드 탭은 타이머가 늦어질 수 있어 탭이 다시 보일 때도 확인한다
  useEffect(() => {
    if (status !== "authenticated" || !storedToken) return;
    const token = storedToken;
    const expiry = decodeTokenExpiry(token);
    if (expiry === null) return;

    const expireIfDue = () => {
      if (isTokenExpired(token)) markSessionExpired(token);
    };
    const delay = Math.min(Math.max(0, expiry - EXPIRY_SKEW_MS - Date.now()), 2 ** 31 - 1);
    const timer = setTimeout(expireIfDue, delay);
    document.addEventListener("visibilitychange", expireIfDue);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", expireIfDue);
    };
  }, [status, storedToken]);

  const signIn = useCallback((token: string) => {
    writeToken(token);
    clearSessionExpiry();
  }, []);

  const signOut = useCallback(() => {
    clearToken();
    clearSessionExpiry();
    // 다른 계정으로 다시 로그인했을 때 이전 계정이 본 서버 데이터가 남지 않게 한다
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo(() => ({ status, signIn, signOut }), [status, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth는 AuthProvider 안에서만 쓸 수 있습니다.");
  return value;
}
