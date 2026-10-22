import { randomUUID } from 'node:crypto';
import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { isPrismaErrorCode } from '../common/prisma-error.js';
import { detectImageFormat } from '../storage/image-type.js';
import {
  STORAGE_CLIENT,
  StorageTimeoutError,
  type StorageClient,
} from '../storage/storage.client.js';
import {
  CARD_IMAGE_CACHE_CONTROL_SECONDS,
  CARD_IMAGE_REQUIRED_MESSAGE,
  CARD_IMAGE_UNSUPPORTED_MESSAGE,
  STORAGE_FAILED_MESSAGE,
  STORAGE_TIMEOUT_MESSAGE,
} from '../storage/storage.constants.js';
import { DAY_PATTERN } from '../teams/teams.constants.js';
import type { UploadedImageFile } from '../teams/card-image-upload.interceptor.js';
import { RevalidationService } from '../revalidation/revalidation.service.js';
import type { ContentTag } from '../revalidation/content-tags.js';
import {
  CONCERT_IMAGE_SLOTS,
  CONTENT_BASE_ROW_NOT_FOUND,
  PERFORMANCE_DAY_NOT_FOUND,
  TICKET_IMAGE_SIDES,
} from './concert-content.constants.js';
import {
  toConcertResponse,
  toPerformanceDayResponse,
  toTicketResponse,
} from './dto/content-response.js';

type ConcertSlot = (typeof CONCERT_IMAGE_SLOTS)[number];
type TicketSide = (typeof TICKET_IMAGE_SIDES)[number];
const CONCERT_COLUMNS: Record<
  ConcertSlot,
  'posterImageUrl' | 'titleImageUrl' | 'subtitleImageUrl'
> = {
  poster: 'posterImageUrl',
  title: 'titleImageUrl',
  subtitle: 'subtitleImageUrl',
};
const TICKET_COLUMNS: Record<TicketSide, 'frontImageUrl' | 'backImageUrl'> = {
  front: 'frontImageUrl',
  back: 'backImageUrl',
};

@Injectable()
export class ConcertImageService {
  private readonly logger = new Logger(ConcertImageService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_CLIENT) private readonly storage: StorageClient,
    private readonly revalidation: RevalidationService,
  ) {}

  async replaceConcert(slot: string, file: UploadedImageFile | undefined) {
    if (!CONCERT_IMAGE_SLOTS.includes(slot as ConcertSlot))
      throw new BadRequestException('지원하지 않는 이미지 위치입니다.');
    const column = CONCERT_COLUMNS[slot as ConcertSlot];
    return this.replace(file, {
      prefix: `concert/${slot}`,
      tag: 'concert',
      notFound: CONTENT_BASE_ROW_NOT_FOUND,
      exists: async () => {
        const row = await this.prisma.concert.findUnique({
          where: { id: 1n },
          include: { venue: true },
        });
        return Boolean(row?.venue);
      },
      update: async (url) =>
        toConcertResponse(
          await this.prisma.concert.update({
            where: { id: 1n },
            data: { [column]: url },
            include: { venue: true },
          }),
        ),
      readUrl: async () =>
        (
          await this.prisma.concert.findUnique({
            where: { id: 1n },
            select: { [column]: true },
          })
        )?.[column],
    });
  }

  async replaceTicket(side: string, file: UploadedImageFile | undefined) {
    if (!TICKET_IMAGE_SIDES.includes(side as TicketSide))
      throw new BadRequestException('지원하지 않는 이미지 위치입니다.');
    const column = TICKET_COLUMNS[side as TicketSide];
    return this.replace(file, {
      prefix: `concert/ticket/${side}`,
      tag: 'ticket',
      notFound: CONTENT_BASE_ROW_NOT_FOUND,
      exists: async () =>
        Boolean(
          await this.prisma.ticket.findUnique({
            where: { id: 1n },
            select: { id: true },
          }),
        ),
      update: async (url) =>
        toTicketResponse(
          await this.prisma.ticket.update({
            where: { id: 1n },
            data: { [column]: url },
          }),
        ),
      readUrl: async () =>
        (
          await this.prisma.ticket.findUnique({
            where: { id: 1n },
            select: { [column]: true },
          })
        )?.[column],
    });
  }

  async replaceTimetable(dayKey: string, file: UploadedImageFile | undefined) {
    if (!DAY_PATTERN.test(dayKey))
      throw new NotFoundException(PERFORMANCE_DAY_NOT_FOUND);
    return this.replace(file, {
      prefix: `concert/timetable/${dayKey}`,
      tag: 'performance-days',
      notFound: PERFORMANCE_DAY_NOT_FOUND,
      exists: async () =>
        Boolean(
          await this.prisma.performanceDay.findUnique({
            where: { dayKey },
            select: { id: true },
          }),
        ),
      update: async (url) => {
        const row = await this.prisma.performanceDay.update({
          where: { dayKey },
          data: { timetableImageUrl: url },
        });
        const teams = await this.prisma.lineUp.findMany({
          where: { day: dayKey },
          orderBy: [
            { performanceOrder: { sort: 'asc', nulls: 'last' } },
            { id: 'asc' },
          ],
          select: { teamName: true },
        });
        return toPerformanceDayResponse(
          row,
          teams.map((team) => team.teamName),
        );
      },
      readUrl: async () =>
        (
          await this.prisma.performanceDay.findUnique({
            where: { dayKey },
            select: { timetableImageUrl: true },
          })
        )?.timetableImageUrl,
    });
  }

  // 외부 I/O 동안 트랜잭션·잠금을 잡지 않는다. 옛 객체는 교체 후에도 유지한다.
  private async replace<T>(
    file: UploadedImageFile | undefined,
    target: {
      prefix: string;
      tag: ContentTag;
      notFound: string;
      exists: () => Promise<boolean>;
      update: (url: string) => Promise<T>;
      readUrl: () => Promise<string | null | undefined>;
    },
  ) {
    if (!file || file.size === 0)
      throw new BadRequestException(CARD_IMAGE_REQUIRED_MESSAGE);
    const format = detectImageFormat(file.buffer);
    if (!format) throw new BadRequestException(CARD_IMAGE_UNSUPPORTED_MESSAGE);
    if (!(await target.exists())) throw new NotFoundException(target.notFound);
    const path = `${target.prefix}/${randomUUID()}.${format.extension}`;
    try {
      await this.storage.upload({
        path,
        body: file.buffer,
        contentType: format.mimeType,
        cacheControlSeconds: CARD_IMAGE_CACHE_CONTROL_SECONDS,
      });
    } catch (error) {
      if (error instanceof StorageTimeoutError) {
        this.logger.error(
          `업로드 타임아웃 — 저장소에 객체가 남아 있을 수 있습니다: ${path}`,
        );
        throw new GatewayTimeoutException(STORAGE_TIMEOUT_MESSAGE);
      }
      throw new BadGatewayException(STORAGE_FAILED_MESSAGE);
    }
    const publicUrl = this.storage.getPublicUrl(path);
    let data: T;
    try {
      data = await target.update(publicUrl);
    } catch (error) {
      await this.compensate(error, target.readUrl, path, publicUrl);
      if (isPrismaErrorCode(error, 'P2025'))
        throw new NotFoundException(target.notFound);
      throw error;
    }
    return {
      data,
      revalidated: await this.revalidation.revalidate([target.tag]),
    };
  }

  private async compensate(
    error: unknown,
    readUrl: () => Promise<string | null | undefined>,
    path: string,
    publicUrl: string,
  ) {
    if (isPrismaErrorCode(error, 'P2025')) {
      await this.safeRemove(path);
      return;
    }
    let current: string | null | undefined;
    try {
      current = await readUrl();
    } catch {
      this.logger.error(
        `DB 반영 결과를 확인하지 못해 보상 삭제를 건너뜁니다. 고아일 수 있는 객체: ${path}`,
      );
      return;
    }
    if (current === publicUrl) {
      this.logger.warn(
        `DB 오류가 났지만 반영은 완료돼 있어 객체를 유지합니다: ${path}`,
      );
      return;
    }
    await this.safeRemove(path);
  }

  private async safeRemove(path: string) {
    try {
      await this.storage.remove([path]);
    } catch {
      this.logger.error(`보상 삭제에 실패했습니다. 고아 객체: ${path}`);
    }
  }
}
