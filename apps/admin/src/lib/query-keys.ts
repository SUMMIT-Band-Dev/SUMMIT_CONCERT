// TanStack Query 키. 화면마다 문자열을 흩어 쓰면 무효화(invalidate)가 어긋나므로 한 곳에 모은다.
export const queryKeys = {
  me: ["auth", "me"] as const,
};
