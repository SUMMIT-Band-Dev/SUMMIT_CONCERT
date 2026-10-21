import { Body, Controller, Get, Put } from '@nestjs/common';
import { ConcertContentService } from './concert-content.service.js';
import { UpdateConcertDto } from './dto/update-concert-content.dto.js';

@Controller('concert')
export class ConcertController {
  constructor(private readonly content: ConcertContentService) {}

  @Get()
  find() {
    return this.content.getConcert();
  }

  @Put()
  update(@Body() dto: UpdateConcertDto) {
    return this.content.updateConcert(dto);
  }
}
