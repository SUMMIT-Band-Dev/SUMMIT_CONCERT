import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  YOUTUBE_RESERVATION_STALE_MINUTES,
  YOUTUBE_RETENTION_DAYS,
} from './youtube-search.constants.js';

export interface MaintenanceResult {
  /** 크래시 잔재로 보고 `failed`로 정리한 예약 수. */
  staleReservations: number;
  /** 30일이 지나 `expired`로 닫은 시도 수. */
  expiredAttempts: number;
  /** 그때 삭제한 후보 행 수. */
  deletedCandidates: number;
}

/**
 * 정리 작업 (PRD F011의 부수 요구).
 *
 * 두 가지를 한다.
 *
 * **1) 오래된 예약 정리** — `reserved`로 10분 넘게 남은 행은 외부 호출 도중 프로세스가
 * 죽은 흔적이다. `failed`로 바꾸되 `completedAt`은 **NULL로 둔다.** 그래야 곡별 연속
 * 실패수에서 빠져(→ `youtube-batch.service.ts`의 판정 규칙), 크래시 한 번이 멀쩡한 곡을
 * 배치에서 영구 제외하는 일이 없다. 쿼터 집계에는 그대로 남는다 — 그 호출은 실제로
 * 나갔을 수 있기 때문이다.
 *
 * **2) 30일 경과 후보 정리** — `open`인 채로 30일이 지난 시도의 후보를 지우고 시도를
 * `expired`로 닫는다. 그러면 그 곡은 열린 추천이 없어져 배치 대상으로 돌아온다.
 * 정책이 요구하는 "delete or refresh"에서 **delete 후 refresh**에 해당한다.
 *
 * ⚠️ **스케줄러가 없다.** 이 서비스는 배치 실행 시작 시점과 `npm run youtube:cleanup`에서만
 * 돌아간다. 배치를 오래 돌리지 않으면 정리도 돌지 않으며, 그동안 후보 행이 30일을 넘겨
 * 남아 있을 수 있다(조회 응답에서는 제외되므로 화면 노출은 없다). 크론 연결은 7단계
 * 항목으로 남겼다 — REFACTOR_NOTES §10 참조.
 */
@Injectable()
export class YoutubeMaintenanceService {
  private readonly logger = new Logger(YoutubeMaintenanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async run(now: Date = new Date()): Promise<MaintenanceResult> {
    const staleReservations = await this.sweepStaleReservations(now);
    const { expiredAttempts, deletedCandidates } = await this.expireOldOpenAttempts(now);

    if (staleReservations > 0 || expiredAttempts > 0) {
      this.logger.log(
        `유튜브 추천 정리: 예약 만료 ${staleReservations}건, ` +
          `30일 경과 ${expiredAttempts}건(후보 ${deletedCandidates}행 삭제)`,
      );
    }

    return { staleReservations, expiredAttempts, deletedCandidates };
  }

  /** `completedAt`은 채우지 않는다 — 위 주석의 "곡 탓이 아닌 실패" 규칙. */
  private async sweepStaleReservations(now: Date): Promise<number> {
    const cutoff = new Date(now.getTime() - YOUTUBE_RESERVATION_STALE_MINUTES * 60_000);
    const { count } = await this.prisma.youtubeSearchAttempt.updateMany({
      where: { outcome: 'reserved', searchedAt: { lt: cutoff } },
      data: { outcome: 'failed' },
    });

    return count;
  }

  /**
   * 후보 삭제와 상태 전환을 **한 트랜잭션**으로 묶는다.
   * 나누면 "후보는 지워졌는데 여전히 open"인 시도가 남아, 관리자가 후보 0개짜리 리뷰 화면을 본다.
   */
  private async expireOldOpenAttempts(
    now: Date,
  ): Promise<{ expiredAttempts: number; deletedCandidates: number }> {
    const cutoff = new Date(now.getTime() - YOUTUBE_RETENTION_DAYS * 24 * 60 * 60_000);

    return this.prisma.$transaction(async (tx) => {
      const stale = await tx.youtubeSearchAttempt.findMany({
        where: { reviewState: 'open', searchedAt: { lt: cutoff } },
        select: { id: true },
      });

      if (stale.length === 0) {
        return { expiredAttempts: 0, deletedCandidates: 0 };
      }

      const ids = stale.map((attempt) => attempt.id);
      const deleted = await tx.youtubeRecommendation.deleteMany({
        where: { attemptId: { in: ids } },
      });
      await tx.youtubeSearchAttempt.updateMany({
        where: { id: { in: ids } },
        // outcome은 'searched' 그대로 둔다 — CHECK가 "searched가 아니면 closed"를 강제하므로
        // expired는 searched인 행만 가질 수 있는 값이다.
        data: { reviewState: 'expired', reviewedAt: now },
      });

      return { expiredAttempts: ids.length, deletedCandidates: deleted.count };
    });
  }
}
