import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { apiRequest, configureApiClient } from "./client";
import { ApiError } from "./errors";

const BASE = "http://localhost:3001";
// 토큰 모양의 문자열을 소스에 두지 않는다(비밀값 패턴 검사 회피). 오류 객체에 새지 않는지 볼 표식일 뿐이다
const TOKEN = "TOKEN_SENTINEL_FOR_TESTS";

function jsonResponse(status: number, payload: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json", ...headers } });
}

function mockFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init ?? {}));
}

async function catchError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error("오류가 나야 합니다");
}

describe("apiRequest", () => {
  let onUnauthorized: Mock<() => void>;

  beforeEach(() => {
    onUnauthorized = vi.fn<() => void>();
    configureApiClient({ getToken: () => TOKEN, onUnauthorized });
  });

  afterEach(() => {
    vi.useRealTimers();
    configureApiClient({ getToken: () => null, onUnauthorized: () => {} });
  });

  describe("요청 구성", () => {
    it("토큰을 Authorization 헤더로 보내고 쿠키·리퍼러는 보내지 않는다", async () => {
      const fetchImpl = mockFetch(() => jsonResponse(200, { id: "1", username: "a" }));
      await apiRequest("/auth/me", { baseUrl: BASE, fetchImpl });

      const [url, init] = fetchImpl.mock.calls[0];
      expect(url).toBe(`${BASE}/auth/me`);
      expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
      expect(init?.credentials).toBe("omit");
      expect(init?.referrerPolicy).toBe("no-referrer");
      expect(init?.cache).toBe("no-store");
    });

    it("auth:false면 토큰을 붙이지 않는다", async () => {
      const fetchImpl = mockFetch(() => jsonResponse(200, { accessToken: "x" }));
      await apiRequest("/auth/login", { method: "POST", body: { a: 1 }, auth: false, baseUrl: BASE, fetchImpl });
      expect((fetchImpl.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBeUndefined();
    });

    it("토큰이 없으면 네트워크를 타지 않고 unauthorized를 던지며 재로그인 훅은 부르지 않는다", async () => {
      configureApiClient({ getToken: () => null });
      const fetchImpl = mockFetch(() => jsonResponse(200, {}));
      const error = await catchError(apiRequest("/teams", { baseUrl: BASE, fetchImpl }));
      expect(error.kind).toBe("unauthorized");
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(onUnauthorized).not.toHaveBeenCalled();
    });

    it("객체 본문은 JSON으로 보낸다", async () => {
      const fetchImpl = mockFetch(() => jsonResponse(200, {}));
      await apiRequest("/teams", { method: "POST", body: { teamName: "팀" }, baseUrl: BASE, fetchImpl });
      const init = fetchImpl.mock.calls[0][1];
      expect((init?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
      expect(init?.body).toBe(JSON.stringify({ teamName: "팀" }));
    });

    it("FormData는 Content-Type을 직접 정하지 않는다(브라우저가 multipart 경계를 붙인다)", async () => {
      const fetchImpl = mockFetch(() => jsonResponse(200, {}));
      const form = new FormData();
      form.append("file", new Blob(["x"]), "a.png");
      await apiRequest("/teams/1/card-image", { method: "PUT", body: form, baseUrl: BASE, fetchImpl });
      const init = fetchImpl.mock.calls[0][1];
      expect((init?.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
      expect(init?.body).toBe(form);
    });

    it("절대 URL·프로토콜 상대 경로는 거부한다(토큰이 다른 곳으로 나가지 않게)", async () => {
      const fetchImpl = mockFetch(() => jsonResponse(200, {}));
      for (const path of ["https://evil.example/x", "//evil.example/x", "teams", "/a\\b", "/redirect?u=http://evil.example"]) {
        await expect(apiRequest(path, { baseUrl: BASE, fetchImpl })).rejects.toThrow(TypeError);
      }
      expect(fetchImpl).not.toHaveBeenCalled();
    });
  });

  describe("응답 처리", () => {
    it("200 JSON을 돌려준다", async () => {
      const fetchImpl = mockFetch(() => jsonResponse(200, { id: "7", username: "admin" }));
      await expect(apiRequest("/auth/me", { baseUrl: BASE, fetchImpl })).resolves.toEqual({ id: "7", username: "admin" });
    });

    it("204·빈 본문은 undefined", async () => {
      const fetchImpl = mockFetch(() => new Response(null, { status: 204 }));
      await expect(apiRequest("/x", { method: "POST", baseUrl: BASE, fetchImpl })).resolves.toBeUndefined();
    });

    it("성공 응답이 JSON이 아니면 unknown 오류", async () => {
      const fetchImpl = mockFetch(() => new Response("<html>oops</html>", { status: 200 }));
      const error = await catchError(apiRequest("/x", { baseUrl: BASE, fetchImpl }));
      expect(error.kind).toBe("unknown");
    });

    it("400 배열 메시지를 그대로 담는다", async () => {
      const fetchImpl = mockFetch(() => jsonResponse(400, { message: ["아이디를 입력해 주세요."], error: "Bad Request", statusCode: 400 }));
      const error = await catchError(apiRequest("/auth/login", { method: "POST", body: {}, auth: false, baseUrl: BASE, fetchImpl }));
      expect(error.kind).toBe("validation");
      expect(error.messages).toEqual(["아이디를 입력해 주세요."]);
    });

    it("429는 Retry-After를 읽어 남은 시간을 안내한다", async () => {
      const fetchImpl = mockFetch(() => jsonResponse(429, { message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { "Retry-After": "900" }));
      const error = await catchError(apiRequest("/auth/login", { method: "POST", body: {}, auth: false, baseUrl: BASE, fetchImpl }));
      expect(error.kind).toBe("rate_limited");
      expect(error.retryAfterSec).toBe(900);
      expect(error.messages[0]).toContain("15분 뒤");
    });

    it("502 프록시 HTML은 한국어 서버 오류 문구", async () => {
      const fetchImpl = mockFetch(() => new Response("<html>Bad Gateway</html>", { status: 502 }));
      const error = await catchError(apiRequest("/x", { baseUrl: BASE, fetchImpl }));
      expect(error.kind).toBe("server");
      expect(error.messages[0]).not.toContain("Bad Gateway");
    });
  });

  describe("401 처리", () => {
    it("인증 요청의 401이면 재로그인 훅을 한 번 부른다", async () => {
      const fetchImpl = mockFetch(() => jsonResponse(401, { message: "인증이 필요합니다." }));
      const error = await catchError(apiRequest("/teams", { baseUrl: BASE, fetchImpl }));
      expect(error.kind).toBe("unauthorized");
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });

    it("로그인 요청(auth:false)의 401은 훅을 부르지 않는다(자격증명이 틀린 것뿐)", async () => {
      const fetchImpl = mockFetch(() => jsonResponse(401, { message: "아이디 또는 비밀번호가 올바르지 않습니다." }));
      const error = await catchError(apiRequest("/auth/login", { method: "POST", body: {}, auth: false, baseUrl: BASE, fetchImpl }));
      expect(error.messages).toEqual(["아이디 또는 비밀번호가 올바르지 않습니다."]);
      expect(onUnauthorized).not.toHaveBeenCalled();
    });

    it("훅이 예외를 던져도 원래 오류가 그대로 나온다", async () => {
      configureApiClient({
        onUnauthorized: () => {
          throw new Error("hook failure");
        },
      });
      const fetchImpl = mockFetch(() => jsonResponse(401, { message: "인증이 필요합니다." }));
      const error = await catchError(apiRequest("/teams", { baseUrl: BASE, fetchImpl }));
      expect(error.kind).toBe("unauthorized");
    });
  });

  describe("네트워크·타임아웃·취소", () => {
    it("fetch가 실패(TypeError)하면 network", async () => {
      const fetchImpl = vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      });
      const error = await catchError(apiRequest("/x", { baseUrl: BASE, fetchImpl }));
      expect(error.kind).toBe("network");
      expect(error.status).toBeNull();
    });

    it("시간이 지나면 timeout", async () => {
      vi.useFakeTimers();
      const fetchImpl = vi.fn(
        (_url: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
          }),
      );
      const pending = catchError(apiRequest("/x", { baseUrl: BASE, fetchImpl, timeoutMs: 1000 }));
      await vi.advanceTimersByTimeAsync(1000);
      expect((await pending).kind).toBe("timeout");
    });

    it("호출한 쪽이 취소하면 aborted(timeout과 구분)", async () => {
      const controller = new AbortController();
      const fetchImpl = vi.fn(
        (_url: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
          }),
      );
      const pending = catchError(apiRequest("/x", { baseUrl: BASE, fetchImpl, signal: controller.signal }));
      controller.abort();
      expect((await pending).kind).toBe("aborted");
    });

    it("이미 취소된 signal이면 바로 aborted", async () => {
      const controller = new AbortController();
      controller.abort();
      const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        if (init?.signal?.aborted) throw new DOMException("aborted", "AbortError");
        return jsonResponse(200, {});
      });
      expect((await catchError(apiRequest("/x", { baseUrl: BASE, fetchImpl, signal: controller.signal }))).kind).toBe("aborted");
    });
  });

  describe("토큰 비노출", () => {
    it("오류 객체를 통째로 직렬화해도 토큰이 들어 있지 않다", async () => {
      const fetchImpl = mockFetch(() => jsonResponse(401, { message: "인증이 필요합니다." }));
      const error = await catchError(apiRequest("/teams", { baseUrl: BASE, fetchImpl }));
      const dump = JSON.stringify(error, Object.getOwnPropertyNames(error)) + String(error) + (error.stack ?? "");
      expect(dump).not.toContain(TOKEN);
    });
  });
});
