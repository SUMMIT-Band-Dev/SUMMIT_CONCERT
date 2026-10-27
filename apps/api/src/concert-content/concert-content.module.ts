import { Module } from '@nestjs/common';
import { RevalidationModule } from '../revalidation/revalidation.module.js';
import { ConcertContentService } from './concert-content.service.js';
import { ConcertController } from './concert.controller.js';
import { VenueController } from './venue.controller.js';
import { PerformanceDaysController } from './performance-days.controller.js';
import { TicketController } from './ticket.controller.js';
import { InfoSectionsController } from './info-sections.controller.js';

import { StorageModule } from '../storage/storage.module.js';
import { GeocodingModule } from '../geocoding/geocoding.module.js';
import { ConcertImageService } from './concert-image.service.js';

@Module({
  imports: [RevalidationModule, StorageModule, GeocodingModule],
  controllers: [
    ConcertController,
    VenueController,
    PerformanceDaysController,
    TicketController,
    InfoSectionsController,
  ],
  providers: [ConcertContentService, ConcertImageService],
})
export class ConcertContentModule {}
