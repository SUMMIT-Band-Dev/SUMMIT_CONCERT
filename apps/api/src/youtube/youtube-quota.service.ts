import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  YOUTUBE_DAILY_SEARCH_LIMIT,
  YOUTUBE_QUOTA_TIME_ZONE,
} from './youtube-search.constants.js';

export interface QuotaStatus {
  /** 오늘(태평양 시간 기준) 예약된 검색 수. 성공·실패·크래시 잔재를 모두 포함한다. */
  usedToday: number;
  limit: number;
  remaining: number;
  /** 다음 리셋 시각(태평양 시간 자정)을 ISO 8601로. */
  resetsAt: string;
  timeZone: string;
}

/**
 * 일일 검색 쿼터 집계 (PRD F011).
 *
 * ## 왜 DB인가
 *
 * 인메모리 카운터는 **재시작하면 0으로 돌아간다.** `search.list`는 별도 버킷에 하루 100회뿐이라
 * 한 번 넘기면 그날 남은 시간 전체가 죽는다. 재시작이 상한을 리셋해 버리면 상한이 사실상
 * 없는 것과 같다.
 *
 * ## 왜 별도 카운터 테이블이 없는가
 *
 * 시도 행의 `searchedAt`을 세는 것이 곧 사용량이다. 카운터를 따로 두면 "카운터는 79인데
 * 실제 시도는 81"처럼 **두 값이 어긋날 수 있는 경로**가 생긴다. 어긋날 수 없는 구조가 낫다.
 *
 * 그래서 시도 행은 외부 호출 **전에** 커밋된다(`outcome='reserved'`). 호출 도중 프로세스가
 * 죽어도 행이 남아 집계에 포함된다 — 쿼터를 적게 세는 쪽이 훨씬 위험하기 때문이다.
 * `invalidatedAt`이 찍힌 행도 **집계에서 빼지 않는다.** 이미 쓴 호출은 되돌릴 수 없다.
 *
 * ## 경계
 *
 * 리셋 기준은 태평양 시간 자정이다(문서: "Daily quotas reset at midnight Pacific Time (PT)").
 * 서버 시간대와 무관하게 Postgres가 `AT TIME ZONE`으로 판단하게 해서, 배포 환경의 TZ 설정에
 * 결과가 흔들리지 않게 한다.
 *
 * ⚠️ **`::timestamp` 캐스팅을 빼면 안 된다.** `(date + 1) AT TIME ZONE tz`는 date가 세션 시간대의
 * 자정인 timestamptz로 암묵 변환된 뒤 계산돼 **세션 시간대에 따라 리셋 시각이 달라진다.**
 * 프로덕션 SELECT 검증에서 실제로 잡힌 결함이다(사용량 집계는 영향이 없었고 리셋 시각만 틀렸다).
 * 단위 테스트는 DB를 대역으로 쓰므로 이런 종류의 오류를 잡지 못한다 —
 * 고정 시각 경계 검증은 `sqlcheck`류 실DB 검증에서만 가능하다(REFACTOR_NOTES §15).
 */
@Injectable()
export class YoutubeQuotaService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(): Promise<QuotaStatus> {
    const [row] = await this.prisma.$queryRaw<
      Array<{ used: number; resets_at: Date }>
    >`
      SELECT
        (SELECT count(*)::int FROM "YoutubeSearchAttempt"
          WHERE ("searchedAt" AT TIME ZONE ${YOUTUBE_QUOTA_TIME_ZONE})::date
              = (now()        AT TIME ZONE ${YOUTUBE_QUOTA_TIME_ZONE})::date) AS used,
        (((now() AT TIME ZONE ${YOUTUBE_QUOTA_TIME_ZONE})::date + 1)::timestamp
            AT TIME ZONE ${YOUTUBE_QUOTA_TIME_ZONE})                          AS resets_at
    `;

    const usedToday = row?.used ?? 0;

    return {
      usedToday,
      limit: YOUTUBE_DAILY_SEARCH_LIMIT,
      remaining: Math.max(0, YOUTUBE_DAILY_SEARCH_LIMIT - usedToday),
      resetsAt: (row?.resets_at ?? new Date()).toISOString(),
      timeZone: YOUTUBE_QUOTA_TIME_ZONE,
    };
  }
}
