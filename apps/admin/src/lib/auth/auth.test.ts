import { describe, expect, it } from "vitest";
import { decideGuard } from "./guard";
import { clearBlockedUntil, FALLBACK_BLOCK_SECONDS, LOGIN_BLOCK_STORAGE_KEY, readBlockedUntil, remainingSeconds, saveBlockedUntil } from "./login-block";
import { loginSchema, LOGIN_MESSAGES } from "./login-schema";
import { buildLoginRedirect, sanitizeNextPath } from "./next-path";
import { clearSessionExpiry, getExpiredToken, markSessionExpired, subscribeSessionExpiry } from "./session-expiry";
import { clearToken, decodeTokenExpiry, isTokenExpired, readToken, TOKEN_STORAGE_KEY, writeToken } from "./token-storage";

/** 브라우저 Storage 대역 */
function memoryStorage(seed: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(seed));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

/** 항상 예외를 던지는 저장소(사생활 보호 모드·저장소 차단) */
function throwingStorage(): Storage {
  const fail = () => {
    throw new DOMException("denied", "SecurityError");
  };
  return { length: 0, clear: fail, getItem: fail, key: fail, removeItem: fail, setItem: fail };
}

const b64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
/** 서명 없는 JWT 모양의 값을 실행 시점에 만든다(소스에 토큰 모양의 리터럴을 두지 않는다) */
function fakeJwt(payload: Record<string, unknown>): string {
  return [b64url({ alg: "HS256", typ: "JWT" }), b64url(payload), "signature"].join(".");
}

const NOW = Date.parse("2026-09-22T00:00:00Z");
const inSeconds = (s: number) => Math.floor(NOW / 1000) + s;

describe("token-storage", () => {
  it("만료 시각(exp)을 읽는다", () => {
    expect(decodeTokenExpiry(fakeJwt({ sub: "1", exp: inSeconds(7200) }))).toBe((inSeconds(7200)) * 1000);
  });

  it("한글이 든 페이로드도 해석한다(UTF-8)", () => {
    expect(decodeTokenExpiry(fakeJwt({ name: "관리자", exp: 1_800_000_000 }))).toBe(1_800_000_000_000);
  });

  it("JWT 모양이 아니거나 exp가 없으면 null", () => {
    expect(decodeTokenExpiry("not-a-jwt")).toBeNull();
    expect(decodeTokenExpiry("a.b.c")).toBeNull();
    expect(decodeTokenExpiry(fakeJwt({ sub: "1" }))).toBeNull();
    expect(decodeTokenExpiry(fakeJwt({ exp: "soon" }))).toBeNull();
  });

  it("만료 판정: 여유 10초를 두고, 모양이 이상한 값은 만료로 본다", () => {
    expect(isTokenExpired(fakeJwt({ exp: inSeconds(7200) }), NOW)).toBe(false);
    expect(isTokenExpired(fakeJwt({ exp: inSeconds(5) }), NOW)).toBe(true);
    expect(isTokenExpired(fakeJwt({ exp: inSeconds(-1) }), NOW)).toBe(true);
    expect(isTokenExpired("garbage", NOW)).toBe(true);
    // exp가 없으면 서버가 판단하도록 유효로 둔다
    expect(isTokenExpired(fakeJwt({ sub: "1" }), NOW)).toBe(false);
  });

  it("저장·조회·삭제", () => {
    const storage = memoryStorage();
    expect(readToken(storage)).toBeNull();
    writeToken("value-1", storage);
    expect(storage.getItem(TOKEN_STORAGE_KEY)).toBe("value-1");
    expect(readToken(storage)).toBe("value-1");
    clearToken(storage);
    expect(storage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(readToken(storage)).toBeNull();
  });

  it("저장소에서 값이 사라지면(다른 탭의 로그아웃) 메모리 값으로 되살리지 않는다", () => {
    const storage = memoryStorage();
    writeToken("value-3", storage);
    storage.removeItem(TOKEN_STORAGE_KEY);
    expect(readToken(storage)).toBeNull();
  });

  it("쓰기만 실패하면(저장소 가득 참 등) 메모리 값으로 이어 가고, 삭제하면 다시 저장소를 따른다", () => {
    const readable = memoryStorage();
    const failingWrites: Storage = { ...readable, setItem: () => { throw new DOMException("quota", "QuotaExceededError"); } };
    writeToken("value-4", failingWrites);
    expect(readToken(failingWrites)).toBe("value-4");
    clearToken(failingWrites);
    expect(readToken(failingWrites)).toBeNull();
  });

  it("저장소가 예외를 던져도 메모리로 동작을 이어 간다", () => {
    const storage = throwingStorage();
    expect(() => writeToken("value-2", storage)).not.toThrow();
    expect(readToken(storage)).toBe("value-2");
    expect(() => clearToken(storage)).not.toThrow();
    expect(readToken(storage)).toBeNull();
  });
});

describe("session-expiry", () => {
  it("만료 토큰을 기록하고 구독자에게 알린다", () => {
    let calls = 0;
    const unsubscribe = subscribeSessionExpiry(() => calls++);
    clearSessionExpiry();
    calls = 0;

    markSessionExpired("token-a");
    expect(getExpiredToken()).toBe("token-a");
    expect(calls).toBe(1);

    markSessionExpired("token-a"); // 같은 값은 다시 알리지 않는다
    expect(calls).toBe(1);

    markSessionExpired(null); // 토큰이 없으면 기록하지 않는다
    expect(getExpiredToken()).toBe("token-a");

    clearSessionExpiry();
    expect(getExpiredToken()).toBeNull();
    unsubscribe();
  });
});

describe("decideGuard (보호 라우트 판단)", () => {
  it("상태별 결정", () => {
    expect(decideGuard("loading")).toBe("wait");
    expect(decideGuard("unauthenticated")).toBe("redirect-to-login");
    expect(decideGuard("authenticated")).toBe("render");
    // 만료: 페이지를 떠나지 않고 재로그인 대화상자(입력 보존)
    expect(decideGuard("expired")).toBe("render-with-reauth");
  });
});

describe("sanitizeNextPath (오픈 리다이렉트 방지)", () => {
  it.each([
    ["/teams", "/teams"],
    ["/songs?teamId=12", "/songs?teamId=12"],
    ["/youtube", "/youtube"],
  ])("%s → %s", (raw, expected) => {
    expect(sanitizeNextPath(raw)).toBe(expected);
  });

  it.each([
    ["https://evil.example/x"],
    ["//evil.example/x"],
    ["/\\evil.example"],
    ["javascript:alert(1)"],
    ["data:text/html,x"],
    ["teams"],
    [""],
    [null],
    [undefined],
    ["/login"],
    ["/login?next=/teams"],
    ["/teams\n/evil"],
  ])("%j → 기본 경로", (raw) => {
    expect(sanitizeNextPath(raw)).toBe("/teams");
  });

  it("해시는 버리고 경로·쿼리만 남긴다", () => {
    expect(sanitizeNextPath("/songs?teamId=3#x")).toBe("/songs?teamId=3");
  });
});

describe("buildLoginRedirect", () => {
  it("기본 경로면 next를 붙이지 않고, 아니면 인코딩해 붙인다", () => {
    expect(buildLoginRedirect("/teams")).toBe("/login");
    expect(buildLoginRedirect("/songs", "?teamId=12")).toBe("/login?next=%2Fsongs%3FteamId%3D12");
    expect(buildLoginRedirect("/login")).toBe("/login");
  });
});

describe("loginSchema (서버 DTO와 같은 규칙·문구)", () => {
  const messages = (value: { username: string; password: string }) => {
    const result = loginSchema.safeParse(value);
    return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  };

  it("정상 값 통과", () => {
    expect(loginSchema.safeParse({ username: "admin", password: "correct horse" }).success).toBe(true);
  });

  it("빈 값·공백 아이디를 막는다(메시지는 하나씩)", () => {
    expect(messages({ username: "", password: "x" })).toEqual([`username: ${LOGIN_MESSAGES.usernameRequired}`]);
    expect(messages({ username: "   ", password: "x" })).toEqual([`username: ${LOGIN_MESSAGES.usernameRequired}`]);
    expect(messages({ username: "admin", password: "" })).toEqual([`password: ${LOGIN_MESSAGES.passwordRequired}`]);
  });

  it("둘 다 비면 두 필드 각각 안내한다", () => {
    expect(messages({ username: "", password: "" })).toEqual([
      `username: ${LOGIN_MESSAGES.usernameRequired}`,
      `password: ${LOGIN_MESSAGES.passwordRequired}`,
    ]);
  });

  it("길이 상한: 아이디 64, 비밀번호 256", () => {
    expect(loginSchema.safeParse({ username: "a".repeat(64), password: "x" }).success).toBe(true);
    expect(messages({ username: "a".repeat(65), password: "x" })).toEqual([`username: ${LOGIN_MESSAGES.usernameTooLong}`]);
    expect(loginSchema.safeParse({ username: "a", password: "x".repeat(256) }).success).toBe(true);
    expect(messages({ username: "a", password: "x".repeat(257) })).toEqual([`password: ${LOGIN_MESSAGES.passwordTooLong}`]);
  });

  it("비밀번호는 다듬지 않는다(공백만 있는 비밀번호도 서버가 판단하도록 통과)", () => {
    expect(loginSchema.safeParse({ username: "a", password: "   " }).success).toBe(true);
  });
});

describe("login-block (429 차단 기억)", () => {
  it("종료 시각은 초 단위로 내린다(화면의 1초 단위 계산에서 900초가 16분으로 보이지 않게)", () => {
    const storage = memoryStorage();
    expect(saveBlockedUntil(900, NOW + 700, storage)).toBe(NOW + 900_000);
    // 저장 직후 1초 단위 시각(내림)으로 계산해도 정확히 900초
    expect(remainingSeconds(readBlockedUntil(storage), Math.floor((NOW + 700) / 1000) * 1000)).toBe(900);
  });

  it("Retry-After만큼 잠그고, 새로고침 뒤(저장소 재조회)에도 남는다", () => {
    const storage = memoryStorage();
    const until = saveBlockedUntil(900, NOW, storage);
    expect(until).toBe(NOW + 900_000);
    expect(readBlockedUntil(storage)).toBe(until);
    expect(remainingSeconds(readBlockedUntil(storage), NOW + 100_000)).toBe(800);
  });

  it("Retry-After를 모르면 짧은 임시 잠금만 건다(서버 값을 지어내지 않는다)", () => {
    const storage = memoryStorage();
    expect(saveBlockedUntil(null, NOW, storage)).toBe(NOW + FALLBACK_BLOCK_SECONDS * 1000);
    expect(saveBlockedUntil(0, NOW, storage)).toBe(NOW + FALLBACK_BLOCK_SECONDS * 1000);
  });

  it("지난 잠금은 남은 시간 0, 삭제하면 사라진다", () => {
    const storage = memoryStorage({ [LOGIN_BLOCK_STORAGE_KEY]: String(NOW - 1000) });
    expect(remainingSeconds(readBlockedUntil(storage), NOW)).toBe(0);
    saveBlockedUntil(60, NOW, storage);
    clearBlockedUntil(storage);
    expect(storage.getItem(LOGIN_BLOCK_STORAGE_KEY)).toBeNull();
    expect(readBlockedUntil(storage)).toBeNull();
  });

  it("저장소 값이 숫자가 아니면 무시하고, 저장소가 막혀 있어도 예외 없이 동작", () => {
    expect(readBlockedUntil(memoryStorage({ [LOGIN_BLOCK_STORAGE_KEY]: "abc" }))).toBeNull();
    const broken = throwingStorage();
    expect(() => saveBlockedUntil(30, NOW, broken)).not.toThrow();
    expect(readBlockedUntil(broken)).toBe(NOW + 30_000);
    clearBlockedUntil(broken);
  });
});
