import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // Prisma가 Postgres에 실제로 붙어서 각 테이블을 읽을 수 있는지 확인하는 용도.
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
