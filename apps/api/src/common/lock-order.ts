/**
 * 행 잠금 순서 — **이 프로젝트의 단일 출처다.**
 *
 * 잠금을 잡는 모든 서비스가 이 상수의 주석을 참조한다. 문서 파일로 빼지 않은 이유는
 * 코드와 문서가 갈라지면 문서 쪽이 조용히 낡기 때문이다.
 *
 * ## 전역 순서
 *
 * ```
 *   "Line Up"  →  "Setlist"  →  "YoutubeSearchAttempt"
 *      (1)           (2)                 (3)
 * ```
 *
 * ## 경로별로 실제 잡는 잠금
 *
 * | 경로 | 잠금 | 순서 |
 * | --- | --- | --- |
 * | `POST /teams/:id/songs` (곡 등록) | Line Up `FOR NO KEY UPDATE` → Setlist INSERT | 1→2 |
 * | `PATCH /songs/:id` (곡 수정) | Line Up → Setlist UPDATE → Attempt UPDATE | 1→2→3 |
 * | `PUT /songs/:id/youtube-url` (F013) | Setlist UPDATE → Attempt UPDATE | 2→3 |
 * | `POST /youtube/recommendations/:id/approve` | Setlist `FOR UPDATE` → Attempt `FOR UPDATE` | 2→3 |
 * | `POST /youtube/recommendations/:id/reject` | Setlist `FOR UPDATE` → Attempt `FOR UPDATE` | 2→3 |
 * | `POST /youtube/recommendations/songs/:id/requeue` | Setlist `FOR UPDATE` → Attempt UPDATE | 2→3 |
 * | 배치 예약·완료 (F011) | Attempt / Recommendation 만 | 3 |
 *
 * ## 데드락이 불가능한 이유
 *
 * 순환 대기가 성립하려면 **두 경로가 서로 반대 순서로 같은 두 자원을 잡아야** 한다.
 * 위 표의 모든 경로는 `1 → 2 → 3`의 부분열이고, 역순으로 잡는 경로가 하나도 없다.
 * 따라서 대기 그래프에 사이클이 생길 수 없다.
 *
 * ## 새 경로를 추가할 때
 *
 * 이 순서를 어겨야 할 것 같으면 그 설계가 틀렸을 가능성이 높다. 표에 줄을 추가하고
 * 부분열인지 먼저 확인한다. `lock-order.spec.ts`가 이 상수의 순서를 테스트로 고정한다.
 */
export const LOCK_ORDER = ['Line Up', 'Setlist', 'YoutubeSearchAttempt'] as const;

export type LockableTable = (typeof LOCK_ORDER)[number];

/** 잠금 순서상 `a`를 `b`보다 먼저 잡아야 하는지. 테스트와 문서화용이다. */
export function locksBefore(a: LockableTable, b: LockableTable): boolean {
  return LOCK_ORDER.indexOf(a) < LOCK_ORDER.indexOf(b);
}
