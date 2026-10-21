import { Body, Controller, Get, Put } from '@nestjs/common';
import { ConcertContentService } from './concert-content.service.js';
import { UpdateTicketDto } from './dto/update-concert-content.dto.js';

@Controller('ticket')
export class TicketController {
  constructor(private readonly content: ConcertContentService) {}

  @Get()
  find() {
    return this.content.getTicket();
  }

  @Put()
  update(@Body() dto: UpdateTicketDto) {
    return this.content.updateTicket(dto);
  }
}
