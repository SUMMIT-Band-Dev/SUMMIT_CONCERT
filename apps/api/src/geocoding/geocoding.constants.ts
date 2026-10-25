// 공식 문서: https://api.ncloud-docs.com/docs/ko/application-maps-geocoding
export const NAVER_GEOCODE_ENDPOINT =
  'https://maps.apigw.ntruss.com/map-geocode/v2/geocode';
export const GEOCODE_TIMEOUT_MS = 5000;
export const GEOCODE_NOT_FOUND_MESSAGE =
  '주소를 다시 확인하거나 지도에서 직접 위치를 지정해 주세요.';
export const GEOCODE_TIMEOUT_MESSAGE =
  '주소 검색 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.';
export const GEOCODE_FAILED_MESSAGE =
  '주소 검색 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.';
