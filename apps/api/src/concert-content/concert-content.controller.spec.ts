import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import {
  HTTP_CODE_METADATA,
  INTERCEPTORS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants.js';
import { describe, expect, it, vi } from 'vitest';
import { IS_PUBLIC_KEY } from '../auth/public.decorator.js';
import { ConcertController } from './concert.controller.js';
import { VenueController } from './venue.controller.js';
import { PerformanceDaysController } from './performance-days.controller.js';
import { TicketController } from './ticket.controller.js';
import { InfoSectionsController } from './info-sections.controller.js';
import { ConcertContentModule } from './concert-content.module.js';
import { RevalidationModule } from '../revalidation/revalidation.module.js';
import { RevalidationService } from '../revalidation/revalidation.service.js';
import { TeamsModule } from '../teams/teams.module.js';
import type { ConcertContentService } from './concert-content.service.js';
import type { ConcertImageService } from './concert-image.service.js';
import { ConcertImageUploadInterceptor } from './concert-image-upload.interceptor.js';
import { GeocodingModule } from '../geocoding/geocoding.module.js';
import type { GeocodingService } from '../geocoding/geocoding.service.js';

const controllers = [
  ConcertController,
  VenueController,
  PerformanceDaysController,
  TicketController,
  InfoSectionsController,
];
describe('공연 콘텐츠 라우트와 인증 메타데이터', () => {
  it.each([
    [ConcertController, 'concert', 'find', '/'],
    [VenueController, 'venue', 'find', '/'],
    [PerformanceDaysController, 'performance-days', 'findAll', ':dayKey'],
    [TicketController, 'ticket', 'find', '/'],
    [InfoSectionsController, 'info-sections', 'findAll', '/'],
  ])(
    '컨트롤러의 기존 GET·PUT과 새 핸들러 모두 인증을 요구한다',
    (controller, path, getMethod, updatePath) => {
      const prototype = controller.prototype as unknown as Record<
        string,
        object
      >;
      expect(Reflect.getMetadata(PATH_METADATA, controller)).toBe(path);
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, controller)).toBeUndefined();
      const handlers = Object.getOwnPropertyNames(prototype).filter(
        (name) => name !== 'constructor',
      );
      const extra =
        controller === InfoSectionsController
          ? []
          : [controller === VenueController ? 'geocode' : 'replaceImage'];
      expect(handlers.sort()).toEqual([getMethod, 'update', ...extra].sort());
      expect(Reflect.getMetadata(PATH_METADATA, prototype[getMethod])).toBe(
        '/',
      );
      expect(Reflect.getMetadata(METHOD_METADATA, prototype[getMethod])).toBe(
        RequestMethod.GET,
      );
      expect(Reflect.getMetadata(PATH_METADATA, prototype.update)).toBe(
        updatePath,
      );
      expect(Reflect.getMetadata(METHOD_METADATA, prototype.update)).toBe(
        RequestMethod.PUT,
      );
      for (const name of handlers)
        expect(
          Reflect.getMetadata(IS_PUBLIC_KEY, prototype[name]),
        ).toBeUndefined();
    },
  );

  it('콘텐츠·팀 모듈이 비전역 재검증 모듈을 명시적으로 들인다', () => {
    expect(Reflect.getMetadata('controllers', ConcertContentModule)).toEqual(
      controllers,
    );
    for (const module of [ConcertContentModule, TeamsModule])
      expect(Reflect.getMetadata('imports', module)).toContain(
        RevalidationModule,
      );
    expect(Reflect.getMetadata('providers', RevalidationModule)).toContain(
      RevalidationService,
    );
    expect(Reflect.getMetadata('exports', RevalidationModule)).toContain(
      RevalidationService,
    );
    expect(
      Reflect.getMetadata('__module:global__', RevalidationModule),
    ).not.toBe(true);
  });

  it('각 컨트롤러가 DTO·dayKey·category를 해당 서비스 메서드로 전달한다', async () => {
    const stub = {
      getConcert: vi.fn(),
      updateConcert: vi.fn(),
      getVenue: vi.fn(),
      updateVenue: vi.fn(),
      getPerformanceDays: vi.fn(),
      updatePerformanceDay: vi.fn(),
      getTicket: vi.fn(),
      updateTicket: vi.fn(),
      getInfoSections: vi.fn(),
      updateInfoSections: vi.fn(),
    };
    const service = stub as unknown as ConcertContentService;
    const images = {
      replaceConcert: vi.fn(),
      replaceTimetable: vi.fn(),
      replaceTicket: vi.fn(),
    };
    const imageService = images as unknown as ConcertImageService;
    const geocoding = { geocode: vi.fn() };
    const concert = new ConcertController(service, imageService);
    const venue = new VenueController(
      service,
      geocoding as unknown as GeocodingService,
    );
    const days = new PerformanceDaysController(service, imageService);
    const ticket = new TicketController(service, imageService);
    const info = new InfoSectionsController(service);
    const concertDto = {
      titleKo: '공연',
      titleEn: 'Concert',
      startDate: '2026-01-01',
      endDate: '2026-01-01',
      showTime: '18시',
    };
    const venueDto = {
      name: '이름',
      address: '주소',
      latitude: 37,
      longitude: 127,
    };
    const dayDto = { dayLabel: '일차', dateLabel: '날짜' };
    const ticketDto = { description: null };
    const infoDto = { sections: [] };
    await concert.find();
    await concert.update(concertDto);
    await venue.find();
    await venue.update(venueDto);
    await days.findAll();
    await days.update('day1', dayDto);
    await ticket.find();
    await ticket.update(ticketDto);
    await info.findAll({ category: 'notice' });
    await info.update({ category: 'ticket' }, infoDto);
    expect(stub.getConcert).toHaveBeenCalledExactlyOnceWith();
    expect(stub.updateConcert).toHaveBeenCalledExactlyOnceWith(concertDto);
    expect(stub.getVenue).toHaveBeenCalledExactlyOnceWith();
    expect(stub.updateVenue).toHaveBeenCalledExactlyOnceWith(venueDto);
    expect(stub.getPerformanceDays).toHaveBeenCalledExactlyOnceWith();
    expect(stub.updatePerformanceDay).toHaveBeenCalledExactlyOnceWith(
      'day1',
      dayDto,
    );
    expect(stub.getTicket).toHaveBeenCalledExactlyOnceWith();
    expect(stub.updateTicket).toHaveBeenCalledExactlyOnceWith(ticketDto);
    expect(stub.getInfoSections).toHaveBeenCalledExactlyOnceWith('notice');
    expect(stub.updateInfoSections).toHaveBeenCalledExactlyOnceWith(
      'ticket',
      infoDto,
    );
    const file = { buffer: Buffer.from('파일'), size: 6 };
    await concert.replaceImage('poster', file);
    await days.replaceImage('day1', file);
    await ticket.replaceImage('front', file);
    await venue.geocode({ address: '서울' });
    expect(images.replaceConcert).toHaveBeenCalledExactlyOnceWith(
      'poster',
      file,
    );
    expect(images.replaceTimetable).toHaveBeenCalledExactlyOnceWith(
      'day1',
      file,
    );
    expect(images.replaceTicket).toHaveBeenCalledExactlyOnceWith('front', file);
    expect(geocoding.geocode).toHaveBeenCalledExactlyOnceWith('서울');
  });

  it.each([
    [ConcertController, 'images/:slot'],
    [PerformanceDaysController, ':dayKey/timetable-image'],
    [TicketController, 'images/:side'],
  ])('이미지 라우트가 PUT과 공연 전용 파서를 사용한다', (controller, path) => {
    const handler = controller.prototype.replaceImage;
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
      RequestMethod.PUT,
    );
    expect(Reflect.getMetadata(INTERCEPTORS_METADATA, handler)).toEqual([
      ConcertImageUploadInterceptor,
    ]);
  });

  it('주소 검색은 POST geocode·200이고 콘텐츠 모듈이 Geocoding을 들인다', () => {
    const handler = VenueController.prototype.geocode;
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('geocode');
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
      RequestMethod.POST,
    );
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(200);
    expect(Reflect.getMetadata('imports', ConcertContentModule)).toContain(
      GeocodingModule,
    );
  });
});
