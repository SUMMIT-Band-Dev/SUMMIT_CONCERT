import {
  Body,
  Controller,
  Get,
  Put,
  Post,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConcertContentService } from './concert-content.service.js';
import { UpdateVenueDto } from './dto/update-concert-content.dto.js';

import { GeocodingService } from '../geocoding/geocoding.service.js';
import { GeocodeAddressDto } from './dto/geocode-address.dto.js';

@Controller('venue')
export class VenueController {
  constructor(
    private readonly content: ConcertContentService,
    private readonly geocoding: GeocodingService,
  ) {}

  @Get()
  find() {
    return this.content.getVenue();
  }

  @Put()
  update(@Body() dto: UpdateVenueDto) {
    return this.content.updateVenue(dto);
  }
  @Post('geocode')
  @HttpCode(HttpStatus.OK)
  geocode(@Body() dto: GeocodeAddressDto) {
    return this.geocoding.geocode(dto.address);
  }
}
