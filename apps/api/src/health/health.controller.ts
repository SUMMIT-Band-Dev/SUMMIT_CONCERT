import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Public } from '../auth/public.decorator.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // Prisma가 Postgres에 실제로 붙어서 각 테이블을 읽을 수 있는지 확인하는 용도.
  // 배포 환경의 헬스체크가 토큰 없이 호출해야 하므로 공개 유지한다.
  @Public()
  @Get()
  async check() {
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
