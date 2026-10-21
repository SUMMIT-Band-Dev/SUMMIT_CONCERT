import { Body, Controller, Get, Put } from '@nestjs/common';
import { ConcertContentService } from './concert-content.service.js';
import { UpdateVenueDto } from './dto/update-concert-content.dto.js';

@Controller('venue')
export class VenueController {
  constructor(private readonly content: ConcertContentService) {}

  @Get()
  find() {
    return this.content.getVenue();
  }

  @Put()
  update(@Body() dto: UpdateVenueDto) {
    return this.content.updateVenue(dto);
  }
}
