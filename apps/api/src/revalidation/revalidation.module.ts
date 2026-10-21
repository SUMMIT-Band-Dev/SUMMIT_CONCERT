import { Module } from '@nestjs/common';
import { RevalidationService } from './revalidation.service.js';

@Module({ providers: [RevalidationService], exports: [RevalidationService] })
export class RevalidationModule {}
