import { QueryClient } from "@tanstack/react-query";
import { isRetryableRead } from "@/lib/api/errors";

// 서버 상태 관리 기본값.
// - 조회는 일시적 오류(네트워크·서버·타임아웃)만 한 번 더 시도한다. 401/409/429는 다시 해도 같다
// - 변경(POST/PATCH/PUT)은 절대 자동 재시도하지 않는다(중복 등록 방지)
// - 낙관적 업데이트는 쓰지 않는다: 순서 재정렬·승인처럼 서버가 권위인 변경은 서버 응답을 받은 뒤 화면을 바꾼다
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => isRetryableRead(error, failureCount),
        staleTime: 30_000,
      },
      mutations: { retry: false },
    },
  });
}
