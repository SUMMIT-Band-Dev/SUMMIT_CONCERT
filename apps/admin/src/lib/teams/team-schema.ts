import { z } from "zod";

// 서버 DTO(apps/api/src/teams/dto/create-team.dto.ts, update-team.dto.ts, apps/api/src/teams/teams.constants.ts)와
// 같은 규칙, 같은 문구다. day 형식이 어긋나면 등록은 되지만 공개 페이지(문자열 비교, src/app/setlist/page.tsx)에서
// 그 팀이 보이지 않게 되므로 클라이언트도 같은 정규식으로 먼저 막는다. 규칙이 서로 어긋나면
// "클라이언트는 통과했는데 서버가 400"이 되므로, 서버 DTO를 바꾸면 이 파일도 함께 바꾼다.

export const TEAM_NAME_MAX_LENGTH = 100;
export const DAY_MAX_LENGTH = 10;
export const DAY_PATTERN = /^day[1-9]\d*$/;
export const PERFORMANCE_ORDER_MAX = 32767;

export const TEAM_MESSAGES = {
  teamNameRequired: "팀명을 입력해 주세요.",
  teamNameTooLong: `팀명은 ${TEAM_NAME_MAX_LENGTH}자를 넘을 수 없습니다.`,
  dayRequired: "공연일자를 입력해 주세요.",
  dayFormat: "공연일자는 day1, day2 형식으로 입력해 주세요.",
  performanceOrderRange: `공연 순서는 1~${PERFORMANCE_ORDER_MAX} 사이의 정수여야 합니다.`,
} as const;

const teamNameSchema = z
  .string()
  .trim()
  .min(1, { message: TEAM_MESSAGES.teamNameRequired })
  .max(TEAM_NAME_MAX_LENGTH, { message: TEAM_MESSAGES.teamNameTooLong });

const daySchema = z
  .string()
  .trim()
  .min(1, { message: TEAM_MESSAGES.dayRequired })
  .max(DAY_MAX_LENGTH, { message: TEAM_MESSAGES.dayFormat })
  .regex(DAY_PATTERN, { message: TEAM_MESSAGES.dayFormat });

// 등록: 팀명 + 공연일자 + 공연순서를 한 세트로 받는다(서버 CreateTeamDto와 동일).
export const createTeamSchema = z.object({
  teamName: teamNameSchema,
  day: daySchema,
  performanceOrder: z
    .number({ message: TEAM_MESSAGES.performanceOrderRange })
    .int({ message: TEAM_MESSAGES.performanceOrderRange })
    .min(1, { message: TEAM_MESSAGES.performanceOrderRange })
    .max(PERFORMANCE_ORDER_MAX, { message: TEAM_MESSAGES.performanceOrderRange }),
});

// 수정: 팀명 + 공연일자만(서버 UpdateTeamDto와 동일). 순서 변경은 재정렬 전용 엔드포인트를 쓴다.
export const updateTeamSchema = z.object({
  teamName: teamNameSchema,
  day: daySchema,
});

export type CreateTeamFormValues = z.infer<typeof createTeamSchema>;
export type UpdateTeamFormValues = z.infer<typeof updateTeamSchema>;
