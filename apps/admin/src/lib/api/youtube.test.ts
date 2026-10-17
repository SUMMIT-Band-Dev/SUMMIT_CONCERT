import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./client";
import { removeYoutubeUrl, updateYoutubeUrl } from "./youtube";

vi.mock("./client", () => ({ apiRequest: vi.fn() }));
beforeEach(() => {
  vi.mocked(apiRequest).mockReset();
});

describe("유튜브 URL API", () => {
  it("URL 저장은 PUT 본문으로 주소만 보낸다", async () => {
    await updateYoutubeUrl("50", "https://youtu.be/BTo-I-gCAxk");
    expect(apiRequest).toHaveBeenCalledExactlyOnceWith("/songs/50/youtube-url", {
      method: "PUT",
      body: { url: "https://youtu.be/BTo-I-gCAxk" },
    });
  });
  it("연결 해제는 본문 없는 DELETE를 호출한다", async () => {
    await removeYoutubeUrl("50");
    expect(apiRequest).toHaveBeenCalledExactlyOnceWith("/songs/50/youtube-url", { method: "DELETE" });
  });
  it("전송 오류를 숨기지 않고 호출자에게 전달한다", async () => {
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error("저장 실패"));
    await expect(removeYoutubeUrl("50")).rejects.toThrow("저장 실패");
  });
});
