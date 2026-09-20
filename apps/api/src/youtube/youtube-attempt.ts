import type { PrismaService } from '../prisma/prisma.service.js';

/**
 * 시도·후보 테이블만 쓰는 최소 클라이언트 타입.
 * 트랜잭션 클라이언트는 `$transaction`/`$connect` 등만 빠진 같은 객체라 델리게이트 타입이 동일하다.
 */
export type AttemptClient = Pick<
  PrismaService,
  'youtubeSearchAttempt' | 'youtubeRecommendation'
>;

/**
 * 열린 추천을 무효화하고 **후보 행을 전량 삭제한다.**
 *
 * 후보를 지우는 것이 이 함수의 핵심이다. YouTube 개발자 정책이 비인증 데이터의 보관을
 * 30일로 제한하므로(해석은 구현자의 것, 법적 확인 없음 — REFACTOR_NOTES 참조),
 * **리뷰가 끝나는 모든 경로에서** 후보를 지운다. 승인/반려/만료도 마찬가지다.
 *
 * 호출자:
 * - F013(`PUT /songs/:id/youtube-url`) — 사람이 직접 주소를 넣었으므로 추천은 의미를 잃는다
 * - 곡 제목·가수 실제 변경(`PATCH /songs/:id`) — 다른 곡의 추천이 남아 있으면 안 된다
 *
 * ⚠️ 반드시 **`Setlist` 행을 먼저 잠근 트랜잭션 안에서** 호출한다 (`common/lock-order.ts`).
 */
export async function supersedeOpenAttempts(
  tx: AttemptClient,
  songId: bigint,
  now: Date = new Date(),
): Promise<number> {
  const open = await tx.youtubeSearchAttempt.findMany({
    where: { songId, reviewState: 'open' },
    select: { id: true },
  });

  if (open.length === 0) {
    return 0;
  }

  const ids = open.map((attempt) => attempt.id);
  await tx.youtubeRecommendation.deleteMany({ where: { attemptId: { in: ids } } });
  await tx.youtubeSearchAttempt.updateMany({
    where: { id: { in: ids } },
    data: { reviewState: 'superseded', reviewedAt: now },
  });

  return ids.length;
}

/**
 * 곡의 시도 이력을 **통째로 무효화**해 배치 대상으로 되돌린다.
 *
 * `invalidatedAt`이 찍힌 행은 배치 선정의 제외 판단(열린 추천 / `no_results` / 연속 실패수)에
 * 쓰이지 않는다. 즉 곡이 다시 후보가 된다. **일일 쿼터 집계에서는 빠지지 않는다** —
 * 이미 쓴 호출은 되돌릴 수 없기 때문이다.
 *
 * 호출자:
 * - 곡 제목·가수 실제 변경 — 검색어가 달라졌으니 이전 결과가 의미를 잃는다
 * - 재큐(`POST /youtube/recommendations/songs/:id/requeue`) — 반려·결과 0건을 되돌린다
 */
export async function invalidateAttempts(
  tx: AttemptClient,
  songId: bigint,
  now: Date = new Date(),
): Promise<{ superseded: number; invalidated: number }> {
  const superseded = await supersedeOpenAttempts(tx, songId, now);
  const { count } = await tx.youtubeSearchAttempt.updateMany({
    where: { songId, invalidatedAt: null },
    data: { invalidatedAt: now },
  });

  return { superseded, invalidated: count };
}
