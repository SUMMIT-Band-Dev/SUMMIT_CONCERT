// 로그인(토큰) 유지 시간 표시용 순수 함수. refresh 토큰이 없어 만료되면 다시 로그인해야 하므로
// 비개발자 사용자가 "언제 끊기는지" 미리 알 수 있게 사이드바에 보여 준다.

/** 이 시간 이하로 남으면 경고 색으로 바꾼다 */
export const SESSION_WARNING_MS = 10 * 60_000;

const MINUTE_MS = 60_000;

/** "1시간 42분" / "42분" / "1분 미만" / "만료됨" */
export function formatSessionRemaining(remainingMs: number): string {
  if (remainingMs <= 0) return "만료됨";
  const totalMinutes = Math.floor(remainingMs / MINUTE_MS);
  if (totalMinutes < 1) return "1분 미만";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}분`;
  return minutes === 0 ? `${hours}시간` : `${hours}시간 ${minutes}분`;
}

export function isSessionExpiringSoon(remainingMs: number): boolean {
  return remainingMs <= SESSION_WARNING_MS;
}
