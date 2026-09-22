import type { Team } from "@/lib/api/types";

/**
 * 드래그 정렬(PATCH /teams/reorder)이 day 단위로만 동작하므로, 화면도 day별로 묶어 보여 준다.
 * day가 null인 팀(이론상 나오지 않지만 API 계약상 nullable)은 별도 그룹으로 마지막에 둔다 — 재정렬 대상이 아니다.
 */
export const UNASSIGNED_DAY_KEY = "__unassigned__";

export interface DayGroup {
  day: string;
  teams: Team[];
}

/** GET /teams가 이미 day → performanceOrder → id로 정렬해 주므로, 여기서는 묶기만 한다(재정렬하지 않는다) */
export function groupTeamsByDay(teams: Team[]): DayGroup[] {
  const groups = new Map<string, Team[]>();

  for (const team of teams) {
    const key = team.day ?? UNASSIGNED_DAY_KEY;
    const bucket = groups.get(key);
    if (bucket) bucket.push(team);
    else groups.set(key, [team]);
  }

  // day 문자열 정렬(day10이 day2보다 앞에 오는 것은 서버와 같은 한계 — REFACTOR_NOTES §11). 미배정은 항상 마지막
  return [...groups.entries()]
    .sort(([a], [b]) => {
      if (a === UNASSIGNED_DAY_KEY) return 1;
      if (b === UNASSIGNED_DAY_KEY) return -1;
      return a.localeCompare(b);
    })
    .map(([day, teamsInDay]) => ({ day, teams: teamsInDay }));
}

/** "day1" → "1일차" 표시용 변환. 패턴에 맞지 않으면(미배정 등) 원문 그대로 */
export function formatDayLabel(day: string): string {
  const match = /^day([1-9]\d*)$/.exec(day);
  return match ? `${match[1]}일차` : day === UNASSIGNED_DAY_KEY ? "일자 미배정" : day;
}
