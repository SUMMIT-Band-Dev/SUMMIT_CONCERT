import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { mapRecordNotFound } from '../common/prisma-error.js';
import { RevalidationService } from '../revalidation/revalidation.service.js';
import {
  CONTENT_BASE_ROW_NOT_FOUND,
  PERFORMANCE_DAY_NOT_FOUND,
} from './concert-content.constants.js';
import type { InfoCategory } from './concert-content.constants.js';
import type {
  UpdateConcertDto,
  UpdateVenueDto,
  UpdatePerformanceDayDto,
  UpdateTicketDto,
  UpdateInfoSectionsDto,
} from './dto/update-concert-content.dto.js';
import {
  toConcertResponse,
  toVenueResponse,
  toPerformanceDayResponse,
  toTicketResponse,
  toInfoSectionResponse,
} from './dto/content-response.js';

type ContentClient = Pick<
  PrismaService,
  'concert' | 'venue' | 'performanceDay' | 'ticket' | 'infoSection' | 'lineUp'
>;

@Injectable()
export class ConcertContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly revalidation: RevalidationService,
  ) {}

  async getConcert() {
    return toConcertResponse(await this.readConcert(this.prisma));
  }

  async updateConcert(dto: UpdateConcertDto) {
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException('종료일은 시작일보다 빠를 수 없습니다.');
    }
    const data = await this.prisma.$transaction(async (tx) => {
      await this.readConcert(tx);
      const row = await mapRecordNotFound(
        tx.concert.update({
          where: { id: 1n },
          data: {
            titleKo: dto.titleKo,
            titleEn: dto.titleEn,
            subtitle: optionalText(dto.subtitle),
            startDate: new Date(`${dto.startDate}T00:00:00.000Z`),
            endDate: new Date(`${dto.endDate}T00:00:00.000Z`),
            showTime: dto.showTime,
          },
          include: { venue: true },
        }),
        CONTENT_BASE_ROW_NOT_FOUND,
      );
      return toConcertResponse(row);
    });
    return {
      data,
      revalidated: await this.revalidation.revalidate(['concert']),
    };
  }

  async getVenue() {
    return toVenueResponse((await this.readConcert(this.prisma)).venue);
  }

  async updateVenue(dto: UpdateVenueDto) {
    const data = await this.prisma.$transaction(async (tx) => {
      const concert = await this.readConcert(tx);
      const row = await mapRecordNotFound(
        tx.venue.update({
          where: { id: concert.venueId },
          data: {
            name: dto.name,
            address: dto.address,
            addressDetail: optionalText(dto.addressDetail),
            latitude: dto.latitude,
            longitude: dto.longitude,
            naverMapUrl: optionalText(dto.naverMapUrl),
            websiteUrl: optionalText(dto.websiteUrl),
          },
        }),
        CONTENT_BASE_ROW_NOT_FOUND,
      );
      return toVenueResponse(row);
    });
    return { data, revalidated: await this.revalidation.revalidate(['venue']) };
  }

  async getPerformanceDays() {
    const days = await this.prisma.performanceDay.findMany({
      orderBy: { dayKey: 'asc' },
    });
    const result = [];
    for (const day of days) {
      result.push(
        toPerformanceDayResponse(
          day,
          await this.autoLineup(this.prisma, day.dayKey),
        ),
      );
    }
    return result;
  }

  async updatePerformanceDay(dayKey: string, dto: UpdatePerformanceDayDto) {
    const data = await this.prisma.$transaction(async (tx) => {
      const row = await mapRecordNotFound(
        tx.performanceDay.update({
          where: { dayKey },
          data: {
            dayLabel: dto.dayLabel,
            dateLabel: dto.dateLabel,
            bookingUrl: optionalText(dto.bookingUrl),
            lineupOverride: optionalText(dto.lineupOverride),
          },
        }),
        PERFORMANCE_DAY_NOT_FOUND,
      );
      return toPerformanceDayResponse(row, await this.autoLineup(tx, dayKey));
    });
    return {
      data,
      revalidated: await this.revalidation.revalidate(['performance-days']),
    };
  }

  async getTicket() {
    const row = await this.prisma.ticket.findUnique({ where: { id: 1n } });
    if (!row) throw new NotFoundException(CONTENT_BASE_ROW_NOT_FOUND);
    return toTicketResponse(row);
  }

  async updateTicket(dto: UpdateTicketDto) {
    const data = await this.prisma.$transaction(async (tx) => {
      const row = await mapRecordNotFound(
        tx.ticket.update({
          where: { id: 1n },
          data: { description: optionalText(dto.description) },
        }),
        CONTENT_BASE_ROW_NOT_FOUND,
      );
      return toTicketResponse(row);
    });
    return {
      data,
      revalidated: await this.revalidation.revalidate(['ticket']),
    };
  }

  async getInfoSections(category: InfoCategory) {
    return this.readInfoSections(this.prisma, category);
  }

  async updateInfoSections(category: InfoCategory, dto: UpdateInfoSectionsDto) {
    const data = await this.prisma.$transaction(async (tx) => {
      // 매 저장마다 섹션·항목 id가 새로 발급된다. 클라이언트는 저장 간에 id를 유지하는 식별자로 쓰지 않는다.
      await tx.infoSection.deleteMany({ where: { category } });
      for (const [index, section] of dto.sections.entries()) {
        await tx.infoSection.create({
          data: {
            category,
            title: section.title,
            sortOrder: index + 1,
            items: {
              create: section.items.map((item, itemIndex) => ({
                content: item.content,
                sortOrder: itemIndex + 1,
              })),
            },
          },
        });
      }
      return this.readInfoSections(tx, category);
    });
    return {
      data,
      revalidated: await this.revalidation.revalidate(['info-sections']),
    };
  }

  private async readConcert(client: ContentClient) {
    const row = await client.concert.findUnique({
      where: { id: 1n },
      include: { venue: true },
    });
    if (!row || !row.venue)
      throw new NotFoundException(CONTENT_BASE_ROW_NOT_FOUND);
    return row;
  }

  private async autoLineup(client: ContentClient, dayKey: string) {
    const teams = await client.lineUp.findMany({
      where: { day: dayKey },
      orderBy: [
        { performanceOrder: { sort: 'asc', nulls: 'last' } },
        { id: 'asc' },
      ],
      select: { teamName: true },
    });
    return teams.map((team) => team.teamName);
  }

  private async readInfoSections(
    client: ContentClient,
    category: InfoCategory,
  ) {
    const rows = await client.infoSection.findMany({
      where: { category },
      orderBy: { sortOrder: 'asc' },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    return rows.map(toInfoSectionResponse);
  }
}

function optionalText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}
