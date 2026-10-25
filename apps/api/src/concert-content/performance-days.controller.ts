import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConcertContentService } from './concert-content.service.js';
import { UpdatePerformanceDayDto } from './dto/update-concert-content.dto.js';

import { ConcertImageService } from './concert-image.service.js';
import { ConcertImageUploadInterceptor } from './concert-image-upload.interceptor.js';
import type { UploadedImageFile } from '../teams/card-image-upload.interceptor.js';

@Controller('performance-days')
export class PerformanceDaysController {
  constructor(
    private readonly content: ConcertContentService,
    private readonly images: ConcertImageService,
  ) {}

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
  @Put(':dayKey/timetable-image')
  @UseInterceptors(ConcertImageUploadInterceptor)
  replaceImage(
    @Param('dayKey') dayKey: string,
    @UploadedFile() file: UploadedImageFile | undefined,
  ) {
    return this.images.replaceTimetable(dayKey, file);
  }
}
