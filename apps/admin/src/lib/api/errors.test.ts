import { describe, expect, it } from "vitest";
import {
  ApiError,
  buildApiError,
  CONFLICT_REFRESH_HINT,
  extractServerMessages,
  fallbackMessage,
  formatRetryAfter,
  isRetryableRead,
  kindFromStatus,
  parseRetryAfter,
} from "./errors";

const body = (value: unknown) => JSON.stringify(value);

describe("kindFromStatus", () => {
  it.each([
    [400, "validation"],
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not_found"],
    [409, "conflict"],
    [413, "payload_too_large"],
    [415, "unsupported_media_type"],
    [429, "rate_limited"],
    [500, "server"],
    [502, "server"],
    [504, "server"],
    [418, "unknown"],
  ] as const)("%i → %s", (status, kind) => {
    expect(kindFromStatus(status)).toBe(kind);
  });
});

describe("extractServerMessages (서버 한국어 메시지 그대로)", () => {
  it("문자열 메시지를 그대로 돌려준다", () => {
    expect(extractServerMessages(body({ message: "아이디 또는 비밀번호가 올바르지 않습니다.", error: "Unauthorized", statusCode: 401 }))).toEqual([
      "아이디 또는 비밀번호가 올바르지 않습니다.",
    ]);
  });

  it("배열 메시지는 순서를 유지한다", () => {
    expect(extractServerMessages(body({ message: ["팀명을 입력해 주세요.", "day 형식이 올바르지 않습니다."] }))).toEqual([
      "팀명을 입력해 주세요.",
      "day 형식이 올바르지 않습니다.",
    ]);
  });

  it("HTML·스크립트가 섞인 메시지도 문자열 그대로 둔다(렌더링은 텍스트로만 한다)", () => {
    const message = "<img src=x onerror=alert(1)> 값이 올바르지 않습니다.";
    expect(extractServerMessages(body({ message }))).toEqual([message]);
  });

  it("영문 기본 메시지는 걸러낸다(프레임워크 기본 문구)", () => {
    expect(extractServerMessages(body({ message: "Not Found", statusCode: 404 }))).toEqual([]);
    expect(extractServerMessages(body({ statusCode: 413, message: "request entity too large" }))).toEqual([]);
  });

  it("JSON이 아니거나 모양이 다르면 빈 배열", () => {
    expect(extractServerMessages("<html>502 Bad Gateway</html>")).toEqual([]);
    expect(extractServerMessages("")).toEqual([]);
    expect(extractServerMessages("null")).toEqual([]);
    expect(extractServerMessages(body({ message: 123 }))).toEqual([]);
    expect(extractServerMessages(body({ message: [1, null, "오류가 있습니다."] }))).toEqual(["오류가 있습니다."]);
  });

  it("너무 긴 메시지는 자르고 개수도 제한한다", () => {
    const [long] = extractServerMessages(body({ message: `가${"나".repeat(500)}` }));
    expect(long.length).toBeLessThanOrEqual(301);
    expect(long.endsWith("…")).toBe(true);
    expect(extractServerMessages(body({ message: Array.from({ length: 50 }, (_, i) => `오류 ${i}`) }))).toHaveLength(10);
  });
});

describe("parseRetryAfter", () => {
  const now = Date.parse("2026-09-22T00:00:00Z");

  it("초 정수", () => {
    expect(parseRetryAfter("900", now)).toBe(900);
    expect(parseRetryAfter(" 30 ", now)).toBe(30);
  });

  it("HTTP 날짜", () => {
    expect(parseRetryAfter("Tue, 22 Sep 2026 00:05:00 GMT", now)).toBe(300);
    expect(parseRetryAfter("Mon, 21 Sep 2026 23:00:00 GMT", now)).toBe(0);
  });

  it("없거나 해석 불가면 null", () => {
    expect(parseRetryAfter(null, now)).toBeNull();
    expect(parseRetryAfter(undefined, now)).toBeNull();
    expect(parseRetryAfter("", now)).toBeNull();
    expect(parseRetryAfter("soon", now)).toBeNull();
    expect(parseRetryAfter("-5", now)).toBeNull();
  });

  it("하루를 넘는 값은 하루로 자른다", () => {
    expect(parseRetryAfter("99999999", now)).toBe(86_400);
  });
});

describe("formatRetryAfter", () => {
  it.each([
    [0, "잠시 뒤"],
    [1, "1초 뒤"],
    [59, "59초 뒤"],
    [60, "1분 뒤"],
    [61, "2분 뒤"],
    [900, "15분 뒤"],
    [901, "16분 뒤"],
  ])("%i초 → %s", (seconds, text) => {
    expect(formatRetryAfter(seconds)).toBe(text);
  });
});

describe("buildApiError", () => {
  it("401: 서버 메시지를 그대로 쓴다", () => {
    const error = buildApiError({ status: 401, bodyText: body({ message: "아이디 또는 비밀번호가 올바르지 않습니다." }) });
    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe("unauthorized");
    expect(error.messages).toEqual(["아이디 또는 비밀번호가 올바르지 않습니다."]);
  });

  it("400 배열 메시지는 모두 보존", () => {
    const error = buildApiError({ status: 400, bodyText: body({ message: ["아이디를 입력해 주세요.", "비밀번호를 입력해 주세요."] }) });
    expect(error.kind).toBe("validation");
    expect(error.messages).toHaveLength(2);
  });

  it("404 영문 기본 메시지는 한국어 문구로 대체", () => {
    const error = buildApiError({ status: 404, bodyText: body({ message: "Not Found" }) });
    expect(error.messages).toEqual([fallbackMessage("not_found")]);
  });

  it("409: 서버 메시지 뒤에 새로고침 안내를 붙인다", () => {
    const error = buildApiError({ status: 409, bodyText: body({ message: "이미 같은 이름의 팀이 있습니다." }) });
    expect(error.messages).toEqual(["이미 같은 이름의 팀이 있습니다.", CONFLICT_REFRESH_HINT]);
  });

  it("413: 영문 본문이어도 한국어 문구", () => {
    const error = buildApiError({ status: 413, bodyText: body({ statusCode: 413, message: "request entity too large" }) });
    expect(error.kind).toBe("payload_too_large");
    expect(error.messages).toEqual([fallbackMessage("payload_too_large")]);
  });

  it("429: Retry-After로 남은 시간을 안내한다", () => {
    const error = buildApiError({
      status: 429,
      bodyText: body({ message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }),
      retryAfterHeader: "900",
    });
    expect(error.kind).toBe("rate_limited");
    expect(error.retryAfterSec).toBe(900);
    expect(error.messages).toEqual(["요청이 너무 많습니다. 15분 뒤에 다시 시도해 주세요."]);
  });

  it("429: Retry-After가 없으면 서버 문구를 그대로 쓰고 시간은 만들지 않는다", () => {
    const error = buildApiError({ status: 429, bodyText: body({ message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }) });
    expect(error.retryAfterSec).toBeNull();
    expect(error.messages).toEqual(["요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."]);
  });

  it("429 외에는 Retry-After를 무시한다", () => {
    expect(buildApiError({ status: 500, bodyText: "", retryAfterHeader: "10" }).retryAfterSec).toBeNull();
  });

  it.each([500, 502, 503, 504])("%i: 프록시 HTML 본문이면 한국어 문구", (status) => {
    const error = buildApiError({ status, bodyText: "<html><body>Bad Gateway</body></html>" });
    expect(error.kind).toBe("server");
    expect(error.messages).toEqual([fallbackMessage("server")]);
  });

  it("500: 서버가 준 고정 한국어 문구는 그대로", () => {
    const error = buildApiError({ status: 500, bodyText: body({ message: "서버 내부 오류가 발생했습니다." }) });
    expect(error.messages).toEqual(["서버 내부 오류가 발생했습니다."]);
  });
});

describe("isRetryableRead", () => {
  const make = (kind: ConstructorParameters<typeof ApiError>[0]["kind"]) => new ApiError({ kind, status: null, messages: ["x"] });

  it("네트워크·서버·타임아웃은 한 번만 다시 시도한다", () => {
    expect(isRetryableRead(make("network"), 0)).toBe(true);
    expect(isRetryableRead(make("server"), 0)).toBe(true);
    expect(isRetryableRead(make("timeout"), 0)).toBe(true);
    expect(isRetryableRead(make("network"), 1)).toBe(false);
  });

  it("4xx·취소·알 수 없는 오류는 다시 시도하지 않는다", () => {
    for (const kind of ["validation", "unauthorized", "forbidden", "not_found", "conflict", "rate_limited", "aborted", "unknown"] as const) {
      expect(isRetryableRead(make(kind), 0)).toBe(false);
    }
    expect(isRetryableRead(new Error("boom"), 0)).toBe(false);
  });
});
