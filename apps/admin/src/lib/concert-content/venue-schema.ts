// 서버 apps/api/src/concert-content/dto/update-concert-content.dto.ts의 UpdateVenueDto와 같은 규칙·문구다.
import { z } from "zod";
import type { Venue } from "@/lib/api/types";
import type { UpdateVenueInput } from "@/lib/api/concert-content";
import { optionalHttpsUrl } from "./content-rules";

export const venueSchema = z.object({
  name: z.string().trim().min(1, "공연장 이름은 1~100자로 입력해 주세요.").max(100, "공연장 이름은 1~100자로 입력해 주세요."),
  address: z.string().trim().min(1, "주소는 1~200자로 입력해 주세요.").max(200, "주소는 1~200자로 입력해 주세요."),
  addressDetail: z.string().trim().max(200, "상세 주소는 200자 이내로 입력해 주세요."),
  latitude: z
    .number({ message: "위도를 숫자로 입력해 주세요." })
    .min(-90, "위도는 -90 이상이어야 합니다.")
    .max(90, "위도는 90 이하여야 합니다."),
  longitude: z
    .number({ message: "경도를 숫자로 입력해 주세요." })
    .min(-180, "경도는 -180 이상이어야 합니다.")
    .max(180, "경도는 180 이하여야 합니다."),
  naverMapUrl: optionalHttpsUrl,
  websiteUrl: optionalHttpsUrl,
});
export type VenueFormValues = z.infer<typeof venueSchema>;

/** DB numeric(9,6)에 맞춰 지도·폼·저장의 좌표 정밀도를 통일한다. */
export function roundCoordinate(value: number): number {
  return Number(value.toFixed(6));
}

export function toVenueFormValues(venue: Venue): VenueFormValues {
  return {
    name: venue.name,
    address: venue.address,
    addressDetail: venue.addressDetail ?? "",
    latitude: venue.latitude,
    longitude: venue.longitude,
    naverMapUrl: venue.naverMapUrl ?? "",
    websiteUrl: venue.websiteUrl ?? "",
  };
}
export function toVenuePayload(values: VenueFormValues): UpdateVenueInput {
  return {
    name: values.name.trim(),
    address: values.address.trim(),
    addressDetail: values.addressDetail.trim(),
    latitude: roundCoordinate(values.latitude),
    longitude: roundCoordinate(values.longitude),
    naverMapUrl: values.naverMapUrl.trim(),
    websiteUrl: values.websiteUrl.trim(),
  };
}
