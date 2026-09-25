import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service.js';
import { Public } from '../auth/public.decorator.js';

// 플랫폼 헬스체크는 짧은 주기로 반복 호출된다. 제한에 걸리면 살아 있는 인스턴스가 죽은 것으로 오인된다.
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 프로세스가 살아 있는지만 답한다. 배포 플랫폼의 헬스체크가 토큰 없이 호출해야 하므로 공개다.
   *
   * 공개 라우트라서 **DB 접속 상태도, 행 수도 싣지 않는다.** 그리고 일부러 DB를 건드리지 않는다 —
   * DB가 잠깐 흔들릴 때 헬스체크가 실패하면 살아 있는 인스턴스가 교체·재시작되는 사고가 난다.
   */
  @Public()
  @Get()
  check() {
    return { status: 'ok' };
  }

  /**
   * Prisma가 Postgres에 실제로 붙어서 각 테이블을 읽을 수 있는지 확인한다.
   * 행 수까지 돌려주므로 **인증이 필요하다**(`@Public()`을 붙이지 않는다 — 전역 Guard가 기본으로 막는다).
   */
  @Get('db')
  async checkDatabase() {
    const [lineUp, setlist, adminUser] = await Promise.all([
      this.prisma.lineUp.count(),
      this.prisma.setlist.count(),
      this.prisma.adminUser.count(),
    ]);

    return {
      status: 'ok',
      database: 'connected',
      rowCounts: { lineUp, setlist, adminUser },
    };
  }
}
