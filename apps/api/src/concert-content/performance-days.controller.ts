import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ConcertContentService } from './concert-content.service.js';
import { UpdatePerformanceDayDto } from './dto/update-concert-content.dto.js';

@Controller('performance-days')
export class PerformanceDaysController {
  constructor(private readonly content: ConcertContentService) {}

  @Get()
  findAll() {
    return this.content.getPerformanceDays();
  }

  @Put(':dayKey')
  update(
    @Param('dayKey') dayKey: string,
    @Body() dto: UpdatePerformanceDayDto,
  ) {
    return this.content.updatePerformanceDay(dayKey, dto);
  }
}
