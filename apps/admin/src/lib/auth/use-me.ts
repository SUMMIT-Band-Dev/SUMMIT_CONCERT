"use client";

import { useQuery } from "@tanstack/react-query";
import { getMe } from "@/lib/api/auth";
import { queryKeys } from "@/lib/query-keys";
import type { AuthStatus } from "./guard";

/**
 * 로그인한 관리자 정보(GET /auth/me). 토큰이 서버에서도 아직 유효한지 확인하는 역할을 겸한다.
 * 만료 중(expired)에는 다시 조회하지 않고 캐시된 계정 이름만 재로그인 대화상자에 쓴다.
 */
export function useMe(status: AuthStatus) {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => getMe({ signal }),
    enabled: status === "authenticated",
    staleTime: 5 * 60_000,
  });
}
