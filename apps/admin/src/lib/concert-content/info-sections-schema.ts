// 서버 apps/api/src/concert-content/dto/update-concert-content.dto.ts의 안내 규칙·문구와 같다.
import { z } from "zod";
import type { InfoSection } from "@/lib/api/types";
import type { UpdateInfoSectionsInput } from "@/lib/api/concert-content";

export const infoSectionsSchema = z.object({
  sections: z
    .array(
      z.object({
        title: z.string().trim().min(1, "섹션 제목은 1~100자로 입력해 주세요.").max(100, "섹션 제목은 1~100자로 입력해 주세요."),
        items: z
          .array(
            z.object({
              content: z.string().trim().min(1, "안내 문장은 1~500자로 입력해 주세요.").max(500, "안내 문장은 1~500자로 입력해 주세요."),
            }),
          )
          .max(50, "안내 항목은 50개 이하여야 합니다."),
      }),
    )
    .max(20, "안내 섹션은 20개 이하여야 합니다."),
});
export type InfoSectionsFormValues = z.infer<typeof infoSectionsSchema>;
export function toInfoSectionsFormValues(sections: InfoSection[]): InfoSectionsFormValues {
  return { sections: sections.map(({ title, items }) => ({ title, items: items.map(({ content }) => ({ content })) })) };
}
export function toInfoSectionsPayload(values: InfoSectionsFormValues): UpdateInfoSectionsInput {
  return {
    sections: values.sections.map(({ title, items }) => ({
      title: title.trim(),
      items: items.map(({ content }) => ({ content: content.trim() })),
    })),
  };
}
