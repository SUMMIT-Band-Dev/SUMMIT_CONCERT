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
import { UpdateTicketDto } from './dto/update-concert-content.dto.js';

import { ConcertImageService } from './concert-image.service.js';
import { ConcertImageUploadInterceptor } from './concert-image-upload.interceptor.js';
import type { UploadedImageFile } from '../teams/card-image-upload.interceptor.js';

@Controller('ticket')
export class TicketController {
  constructor(
    private readonly content: ConcertContentService,
    private readonly images: ConcertImageService,
  ) {}

  @Get()
  find() {
    return this.content.getTicket();
  }

  @Put()
  update(@Body() dto: UpdateTicketDto) {
    return this.content.updateTicket(dto);
  }
  @Put('images/:side')
  @UseInterceptors(ConcertImageUploadInterceptor)
  replaceImage(
    @Param('side') side: string,
    @UploadedFile() file: UploadedImageFile | undefined,
  ) {
    return this.images.replaceTicket(side, file);
  }
}
