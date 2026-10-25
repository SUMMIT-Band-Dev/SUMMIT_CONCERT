import { describe, expect, it } from "vitest";
import { infoSectionsSchema, toInfoSectionsFormValues, toInfoSectionsPayload } from "./info-sections-schema";

describe("안내 섹션", () => {
  it("빈 전체 목록과 항목 0개 섹션을 허용한다", () => {
    expect(infoSectionsSchema.safeParse({ sections: [] }).success).toBe(true);
    expect(infoSectionsSchema.safeParse({ sections: [{ title: "안내", items: [] }] }).success).toBe(true);
  });
  it.each([
    [{ sections: Array.from({ length: 21 }, () => ({ title: "안내", items: [] })) }, "안내 섹션은 20개 이하여야 합니다."],
    [
      { sections: [{ title: "안내", items: Array.from({ length: 51 }, () => ({ content: "문장" })) }] },
      "안내 항목은 50개 이하여야 합니다.",
    ],
    [{ sections: [{ title: " ", items: [] }] }, "섹션 제목은 1~100자로 입력해 주세요."],
    [{ sections: [{ title: "가".repeat(101), items: [] }] }, "섹션 제목은 1~100자로 입력해 주세요."],
    [{ sections: [{ title: "안내", items: [{ content: "가".repeat(501) }] }] }, "안내 문장은 1~500자로 입력해 주세요."],
    [{ sections: [{ title: "안내", items: [{ content: " " }] }] }, "안내 문장은 1~500자로 입력해 주세요."],
  ])("한도 위반을 서버 문구로 거부한다", (input, message) => {
    const result = infoSectionsSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe(message);
  });
  it("정확히 최대 개수·길이는 허용한다", () => {
    expect(
      infoSectionsSchema.safeParse({
        sections: Array.from({ length: 20 }, () => ({
          title: "가".repeat(100),
          items: Array.from({ length: 50 }, () => ({ content: "가".repeat(500) })),
        })),
      }).success,
    ).toBe(true);
  });
  it("서버 id를 제외하고 순서를 유지하며 전송 값만 trim한다", () => {
    const server = [
      {
        id: "20",
        title: " 둘 ",
        items: [
          { id: "9", content: " 나 " },
          { id: "3", content: " 가 " },
        ],
      },
      { id: "10", title: " 하나 ", items: [] },
    ];
    const form = toInfoSectionsFormValues(server);
    expect(form).toEqual({
      sections: [
        { title: " 둘 ", items: [{ content: " 나 " }, { content: " 가 " }] },
        { title: " 하나 ", items: [] },
      ],
    });
    expect(toInfoSectionsPayload(form)).toEqual({
      sections: [
        { title: "둘", items: [{ content: "나" }, { content: "가" }] },
        { title: "하나", items: [] },
      ],
    });
    expect(JSON.stringify(toInfoSectionsPayload(form))).not.toContain('"id"');
  });
});
