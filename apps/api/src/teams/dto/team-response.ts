import type { LineUpModel } from '../../generated/prisma/models.js';

/**
 * 팀 API의 응답 계약 (PRD 데이터 모델 기준 이름).
 *
 * DB 컬럼명(`team_name`/`image_src`)은 Prisma의 `@map`이 이미 흡수했으므로
 * 여기서 실제로 하는 일은 `BigInt` → `string` 변환 하나다. 그런데도 전역
 * 인터셉터가 아니라 매퍼를 두는 이유는 **이 타입 자체가 API 계약이 되기**
 * 때문이다 — 컨트롤러 반환 타입만 보고 클라이언트가 받는 모양을 알 수 있다.
 * 인터셉터로 처리하면 선언된 타입은 `bigint`인데 실제로 나가는 값은 `string`이라
 * 타입이 계약을 설명하지 못한다.
 *
 * 매퍼를 빠뜨리면 `JSON.stringify`가 BigInt에서 예외를 던져 즉시 500으로
 * 드러난다 — 조용히 새는 종류의 실수가 아니라서 이 방식을 택했다.
 */
export interface TeamResponse {
  /** `Line Up.id`. DB는 int8이지만 JSON에 실을 수 있도록 문자열로 변환한다 */
  id: string;
  teamName: string;
  day: string | null;
  performanceOrder: number | null;
  /** `image_src`. 5단계(PRD F007)부터 `PUT /teams/:id/card-image`로 갱신된다 */
  cardImageUrl: string | null;
}

export function toTeamResponse(team: LineUpModel): TeamResponse {
  return {
    id: team.id.toString(),
    teamName: team.teamName,
    day: team.day,
    performanceOrder: team.performanceOrder,
    cardImageUrl: team.cardImageUrl,
  };
}
