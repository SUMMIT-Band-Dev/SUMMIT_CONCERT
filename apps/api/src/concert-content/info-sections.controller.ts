import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { ConcertContentService } from './concert-content.service.js';
import {
  InfoCategoryQueryDto,
  UpdateInfoSectionsDto,
} from './dto/update-concert-content.dto.js';

@Controller('info-sections')
export class InfoSectionsController {
  constructor(private readonly content: ConcertContentService) {}

  @Get()
  findAll(@Query() query: InfoCategoryQueryDto) {
    return this.content.getInfoSections(query.category);
  }

  @Put()
  update(
    @Query() query: InfoCategoryQueryDto,
    @Body() dto: UpdateInfoSectionsDto,
  ) {
    return this.content.updateInfoSections(query.category, dto);
  }
}
