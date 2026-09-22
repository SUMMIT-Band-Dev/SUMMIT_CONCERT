// API 계약 타입 (apps/api 응답을 손으로 옮긴 것).
//
// ⚠️ 드리프트 위험: API에 OpenAPI 스펙이 없어 이 파일은 자동 생성되지 않는다. 그래서
//  1) 각 타입 위에 **미러링하는 API 쪽 정의의 위치**를 적는다 — API를 바꾸는 PR은 여기를 함께 확인한다
//  2) 화면은 이 타입을 신뢰하되, 값이 비어 있거나 모양이 다를 가능성을 화면 코드가 방어한다(특히 7c-2 이후 목록)
// 근본 대책은 API의 OpenAPI 노출이다(REFACTOR_NOTES §18 "API 요청 목록").

/** 미러링: apps/api/src/auth/auth.service.ts `LoginResult` */
export interface LoginResult {
  accessToken: string;
}

/** 미러링: apps/api/src/auth/auth.service.ts `AdminProfile`. id는 DB가 int8이라 문자열이다 */
export interface AdminProfile {
  id: string;
  username: string;
}

/** 로그인 요청. 검증 규칙은 apps/api/src/auth/dto/login.dto.ts 와 같아야 한다(auth/login-schema.ts) */
export interface LoginCredentials {
  username: string;
  password: string;
}

/** 미러링: apps/api/src/teams/dto/team-response.ts `TeamResponse`. id는 DB가 int8이라 문자열이다 */
export interface Team {
  id: string;
  teamName: string;
  day: string | null;
  performanceOrder: number | null;
  /** work02-7c-2b(카드뉴스 사진 업로드)부터 화면에서 갱신한다. 이번 단계는 읽기만 한다 */
  cardImageUrl: string | null;
}
