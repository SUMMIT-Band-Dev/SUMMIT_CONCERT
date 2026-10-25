// 서버 apps/api/src/concert-content/dto/update-concert-content.dto.ts의 티켓 규칙·문구와 같다.
import { z } from "zod";
export const ticketSchema = z.object({ description: z.string().trim().max(2000, "티켓 설명은 2000자 이내로 입력해 주세요.") });
export type TicketFormValues = z.infer<typeof ticketSchema>;
