import { describe, expect, it } from "vitest";
import { decodeHtmlEntities } from "./decode-html-entities";

// 실측 근거: 2026-09-23 __verify__ 곡 검증 중 실제 YouTube Data API 응답에서
// `&quot;나는 AI..당신은 당연히 사람&quot;`, `officialpsy&#39;s channel` 같은 값을 확인했다.

describe("decodeHtmlEntities", () => {
  it("명명 엔티티를 디코딩한다", () => {
    expect(decodeHtmlEntities("&quot;나는 AI..당신은 당연히 사람&quot;")).toBe('"나는 AI..당신은 당연히 사람"');
    expect(decodeHtmlEntities("Tom &amp; Jerry")).toBe("Tom & Jerry");
    expect(decodeHtmlEntities("officialpsy&#39;s channel")).toBe("officialpsy's channel");
  });

  it("10진·16진 숫자 엔티티를 디코딩한다", () => {
    expect(decodeHtmlEntities("it&#39;s")).toBe("it's");
    expect(decodeHtmlEntities("it&#x27;s")).toBe("it's");
  });

  it("모르는 엔티티는 원문 그대로 둔다(추측으로 바꾸지 않는다)", () => {
    expect(decodeHtmlEntities("&unknown; entity")).toBe("&unknown; entity");
  });

  it("엔티티가 없으면 그대로 돌려준다", () => {
    expect(decodeHtmlEntities("일반 제목")).toBe("일반 제목");
  });

  it("범위를 벗어난 숫자 엔티티는 원문 그대로 둔다", () => {
    expect(decodeHtmlEntities("&#99999999;")).toBe("&#99999999;");
  });
});
