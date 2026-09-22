import { describe, expect, it } from "vitest";
import { checkAlbumCoverUrl, shrinkAlbumCoverUrl } from "./album-cover-url";

// 서버(apps/api/src/album-cover/album-cover-url.ts)와 같은 판정을 하는지 고정한다.
// 여기가 더 느슨하면 "화면은 통과, 서버는 400"이 되고, 더 빡빡하면 올바른 주소를 막는다.

const VALID = "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/ab/cd/ef/abcdef.jpg/600x600bb.jpg";

describe("checkAlbumCoverUrl", () => {
  it("후보 목록에서 받은 형태의 주소는 통과한다", () => {
    expect(checkAlbumCoverUrl(VALID)).toBeNull();
    // 앞뒤 공백은 붙여 넣기에서 흔하므로 허용한다(서버도 저장 전에 같은 값이 된다)
    expect(checkAlbumCoverUrl(`  ${VALID}  `)).toBeNull();
  });

  it("빈 값은 입력 안내를 돌려준다", () => {
    expect(checkAlbumCoverUrl("")).toContain("입력해 주세요");
    expect(checkAlbumCoverUrl("   ")).toContain("입력해 주세요");
  });

  it("http·형식 오류를 구분해서 알려준다", () => {
    expect(checkAlbumCoverUrl(VALID.replace("https:", "http:"))).toContain("https");
    expect(checkAlbumCoverUrl("그냥 문자열")).toContain("URL 형식");
  });

  it("다른 호스트는 호스트 이름을 짚어서 거부한다 (isN-ssl 혼동이 흔하다)", () => {
    const other = VALID.replace("is1-ssl", "is5-ssl");
    expect(checkAlbumCoverUrl(other)).toContain("is5-ssl.mzstatic.com");
  });

  it("크기 꼬리표가 다르면 '600x600bb.jpg 여야 한다'고 구체적으로 알려준다 (§10 요건)", () => {
    const small = VALID.replace("600x600bb.jpg", "100x100bb.jpg");
    const reason = checkAlbumCoverUrl(small);
    expect(reason).toContain("600x600bb.jpg");
  });

  it("경로 형태 자체가 다르면 허용 경로를 안내한다", () => {
    expect(checkAlbumCoverUrl("https://is1-ssl.mzstatic.com/other/path.png")).toContain("/image/thumb/");
  });

  it("사용자 정보·포트·쿼리·프래그먼트를 거부한다", () => {
    expect(checkAlbumCoverUrl(VALID.replace("https://", "https://someone@"))).toContain("사용자 정보");
    expect(checkAlbumCoverUrl(VALID.replace("mzstatic.com", "mzstatic.com:8443"))).toContain("포트");
    expect(checkAlbumCoverUrl(`${VALID}?x=1`)).toContain("쿼리");
    expect(checkAlbumCoverUrl(`${VALID}#top`)).toContain("#");
  });

  it("255자를 넘으면 길이로 막는다", () => {
    const long = `https://is1-ssl.mzstatic.com/image/thumb/${"a".repeat(240)}/600x600bb.jpg`;
    expect(checkAlbumCoverUrl(long)).toContain("너무 깁니다");
  });
});

describe("shrinkAlbumCoverUrl", () => {
  it("크기 꼬리표만 바꾼다 (공개 사이트 src/lib/mzstatic.ts와 같은 규칙)", () => {
    expect(shrinkAlbumCoverUrl(VALID)).toBe(VALID.replace("600x600bb.jpg", "112x112bb.jpg"));
    expect(shrinkAlbumCoverUrl(VALID, 56)).toBe(VALID.replace("600x600bb.jpg", "56x56bb.jpg"));
  });

  it("꼬리표가 없으면 그대로 둔다", () => {
    const other = "https://example.com/cover.png";
    expect(shrinkAlbumCoverUrl(other)).toBe(other);
  });
});
