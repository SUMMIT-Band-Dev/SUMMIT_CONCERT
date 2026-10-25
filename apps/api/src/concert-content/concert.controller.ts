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
import { UpdateConcertDto } from './dto/update-concert-content.dto.js';

import { ConcertImageService } from './concert-image.service.js';
import { ConcertImageUploadInterceptor } from './concert-image-upload.interceptor.js';
import type { UploadedImageFile } from '../teams/card-image-upload.interceptor.js';

@Controller('concert')
export class ConcertController {
  constructor(
    private readonly content: ConcertContentService,
    private readonly images: ConcertImageService,
  ) {}

  @Get()
  find() {
    return this.content.getConcert();
  }

  @Put()
  update(@Body() dto: UpdateConcertDto) {
    return this.content.updateConcert(dto);
  }
  @Put('images/:slot')
  @UseInterceptors(ConcertImageUploadInterceptor)
  replaceImage(
    @Param('slot') slot: string,
    @UploadedFile() file: UploadedImageFile | undefined,
  ) {
    return this.images.replaceConcert(slot, file);
  }
}
