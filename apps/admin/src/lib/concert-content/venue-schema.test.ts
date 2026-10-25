import { describe, expect, it } from "vitest";
import type { Venue } from "@/lib/api/types";
import { venueSchema, roundCoordinate, toVenueFormValues, toVenuePayload } from "./venue-schema";

const valid = {
  name: "공연장",
  address: "서울특별시 마포구 양화로 100-10",
  addressDetail: "",
  latitude: 37.552555,
  longitude: 126.91899,
  naverMapUrl: "",
  websiteUrl: "",
};

describe("공연장 폼", () => {
  it("실제 좌표와 경계값, 빈 선택 문자열을 허용한다", () => {
    expect(venueSchema.safeParse(valid).success).toBe(true);
    expect(venueSchema.safeParse({ ...valid, latitude: 90, longitude: -180 }).success).toBe(true);
    expect(venueSchema.safeParse({ ...valid, latitude: -90, longitude: 180 }).success).toBe(true);
  });
  it.each([
    ["latitude", 90.000001, "위도는 90 이하여야 합니다."],
    ["latitude", -90.1, "위도는 -90 이상이어야 합니다."],
    ["latitude", NaN, "위도를 숫자로 입력해 주세요."],
    ["latitude", Infinity, "위도를 숫자로 입력해 주세요."],
    ["latitude", "37.5", "위도를 숫자로 입력해 주세요."],
    ["longitude", 180.5, "경도는 180 이하여야 합니다."],
    ["longitude", -180.5, "경도는 -180 이상이어야 합니다."],
    ["longitude", NaN, "경도를 숫자로 입력해 주세요."],
    ["longitude", -Infinity, "경도를 숫자로 입력해 주세요."],
    ["longitude", "126.9", "경도를 숫자로 입력해 주세요."],
    ["name", " ", "공연장 이름은 1~100자로 입력해 주세요."],
    ["name", "가".repeat(101), "공연장 이름은 1~100자로 입력해 주세요."],
    ["address", " ", "주소는 1~200자로 입력해 주세요."],
    ["address", "가".repeat(201), "주소는 1~200자로 입력해 주세요."],
    ["addressDetail", "가".repeat(201), "상세 주소는 200자 이내로 입력해 주세요."],
    ["websiteUrl", "http://example.com", "https로 시작하는 올바른 주소를 입력해 주세요."],
    ["naverMapUrl", "http://example.com", "https로 시작하는 올바른 주소를 입력해 주세요."],
  ])("%s의 잘못된 값은 서버 문구로 거부한다", (field, value, message) => {
    const result = venueSchema.safeParse({ ...valid, [field]: value });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues).toContainEqual(expect.objectContaining({ path: [field], message }));
  });
  it("문자열을 trim하고 최대 길이와 HTTPS 링크를 허용한다", () => {
    const input = {
      ...valid,
      name: ` ${"가".repeat(100)} `,
      address: "가".repeat(200),
      addressDetail: "가".repeat(200),
      websiteUrl: " https://example.com ",
      naverMapUrl: " https://naver.me/test ",
    };
    expect(venueSchema.parse(input)).toMatchObject({
      name: input.name.trim(),
      websiteUrl: "https://example.com",
      naverMapUrl: "https://naver.me/test",
    });
  });
  it("좌표를 DB와 같은 소수점 6자리로 반올림한다", () => {
    expect(roundCoordinate(37.5525554)).toBe(37.552555);
    expect(roundCoordinate(126.9189999)).toBe(126.919);
    expect(roundCoordinate(-37.5525554)).toBe(-37.552555);
  });
  it("서버의 선택 NULL은 폼에서 빈 문자열이다", () => {
    const venue: Venue = { ...valid, id: "1", updatedAt: "2026-10-25", addressDetail: null, websiteUrl: null, naverMapUrl: null };
    expect(toVenueFormValues(venue)).toEqual(valid);
  });
  it("페이로드는 문자열을 trim하고 좌표를 반올림하며 빈 선택값을 유지한다", () => {
    expect(
      toVenuePayload({
        ...valid,
        name: " 공연장 ",
        address: " 주소 ",
        addressDetail: " ",
        latitude: 37.5525554,
        longitude: 126.9189999,
        websiteUrl: " https://example.com ",
      }),
    ).toEqual({
      ...valid,
      name: "공연장",
      address: "주소",
      latitude: 37.552555,
      longitude: 126.919,
      websiteUrl: "https://example.com",
    });
  });
});
