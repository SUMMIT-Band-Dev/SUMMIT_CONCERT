// 서버 apps/api/src/concert-content/dto/update-concert-content.dto.ts, content-validation.ts와 같은 규칙·문구다.
import { z } from "zod";

const calendarDate = z
  .string()
  .trim()
  .refine((value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "날짜는 YYYY-MM-DD 형식의 실제 날짜로 입력해 주세요.");

export const concertSchema = z
  .object({
    titleKo: z.string().trim().min(1, "국문 제목은 1~100자로 입력해 주세요.").max(100, "국문 제목은 1~100자로 입력해 주세요."),
    titleEn: z.string().trim().min(1, "영문 제목은 1~100자로 입력해 주세요.").max(100, "영문 제목은 1~100자로 입력해 주세요."),
    subtitle: z.string().trim().max(200, "부제는 200자 이내로 입력해 주세요."),
    startDate: calendarDate,
    endDate: calendarDate,
    showTime: z.string().trim().min(1, "공연 시간은 1~50자로 입력해 주세요.").max(50, "공연 시간은 1~50자로 입력해 주세요."),
  })
  .refine((value) => value.endDate >= value.startDate, {
    path: ["endDate"],
    message: "종료일은 시작일보다 빠를 수 없습니다.",
  });
export type ConcertFormValues = z.infer<typeof concertSchema>;
