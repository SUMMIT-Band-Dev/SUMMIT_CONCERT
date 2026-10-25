// 서버 apps/api/src/concert-content/dto/update-concert-content.dto.ts의 일차 규칙을 미러링한다.
import { z } from "zod";
import type { PerformanceDay } from "@/lib/api/types";
import type { UpdatePerformanceDayInput } from "@/lib/api/concert-content";
import { optionalHttpsUrl } from "./content-rules";

export const performanceDaySchema = z
  .object({
    dayLabel: z.string().trim().min(1, "일차 라벨은 1~50자로 입력해 주세요.").max(50, "일차 라벨은 1~50자로 입력해 주세요."),
    dateLabel: z.string().trim().min(1, "날짜 라벨은 1~100자로 입력해 주세요.").max(100, "날짜 라벨은 1~100자로 입력해 주세요."),
    bookingUrl: optionalHttpsUrl,
    lineupMode: z.enum(["auto", "manual"]),
    lineupText: z.string().trim(),
  })
  .superRefine((values, ctx) => {
    if (values.lineupMode !== "manual") return;
    if (!values.lineupText)
      ctx.addIssue({ code: "custom", path: ["lineupText"], message: "출연진 문구를 입력하거나 '자동으로 되돌리기'를 눌러 주세요." });
    if (values.lineupText.length > 1000)
      ctx.addIssue({ code: "custom", path: ["lineupText"], message: "출연진 문구는 1000자 이내로 입력해 주세요." });
  });
export type PerformanceDayFormValues = z.infer<typeof performanceDaySchema>;

export function toPerformanceDayFormValues(day: PerformanceDay): PerformanceDayFormValues {
  return {
    dayLabel: day.dayLabel,
    dateLabel: day.dateLabel,
    bookingUrl: day.bookingUrl ?? "",
    lineupMode: day.lineupOverride === null ? "auto" : "manual",
    lineupText: day.lineupOverride ?? day.autoLineup.join(", "),
  };
}
export function toPerformanceDayPayload(values: PerformanceDayFormValues): UpdatePerformanceDayInput {
  return {
    dayLabel: values.dayLabel.trim(),
    dateLabel: values.dateLabel.trim(),
    bookingUrl: values.bookingUrl.trim(),
    lineupOverride: values.lineupMode === "auto" ? null : values.lineupText.trim(),
  };
}
