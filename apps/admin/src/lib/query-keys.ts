// TanStack Query 키. 화면마다 문자열을 흩어 쓰면 무효화(invalidate)가 어긋나므로 한 곳에 모은다.
export const queryKeys = {
  me: ["auth", "me"] as const,
  teams: ["teams"] as const,
  /** 팀별 곡 목록. 팀을 바꿔 가며 보므로 teamId까지 키에 넣는다 */
  teamSongs: (teamId: string) => ["teams", teamId, "songs"] as const,
};
