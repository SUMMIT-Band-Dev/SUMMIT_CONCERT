import { describe, expect, it } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import {
  toConcertResponse,
  toVenueResponse,
  toPerformanceDayResponse,
  toTicketResponse,
  toInfoSectionResponse,
} from './content-response.js';

const updatedAt = new Date('2026-10-21T01:23:45.678Z');
const venue = {
  id: 9007199254740993n,
  name: '공연장',
  address: '주소',
  addressDetail: '상세',
  latitude: new Prisma.Decimal('37.552555'),
  longitude: new Prisma.Decimal('126.918990'),
  naverMapUrl: 'https://example.com/map',
  websiteUrl: null,
  updatedAt,
};

describe('공연 콘텐츠 응답 매퍼', () => {
  it('공연 날짜·updatedAt·공연장 요약을 계약대로 직렬화한다', () => {
    const result = toConcertResponse({
      id: 1n,
      titleKo: '공연',
      titleEn: 'Concert',
      subtitle: null,
      startDate: new Date('2028-02-29T00:00:00.000Z'),
      endDate: new Date('2028-03-01T00:00:00.000Z'),
      showTime: '18시',
      posterImageUrl: '/poster',
      titleImageUrl: null,
      subtitleImageUrl: null,
      venueId: venue.id,
      updatedAt,
      venue,
    });
    expect(result).toEqual({
      titleKo: '공연',
      titleEn: 'Concert',
      subtitle: null,
      startDate: '2028-02-29',
      endDate: '2028-03-01',
      showTime: '18시',
      posterImageUrl: '/poster',
      titleImageUrl: null,
      subtitleImageUrl: null,
      venue: { id: '9007199254740993', name: '공연장', address: '주소' },
      updatedAt: '2026-10-21T01:23:45.678Z',
    });
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('공연장의 큰 BigInt는 손실 없이 문자열, Decimal은 number로 내보낸다', () => {
    const result = toVenueResponse(venue);
    expect(result).toEqual({
      id: '9007199254740993',
      name: '공연장',
      address: '주소',
      addressDetail: '상세',
      latitude: 37.552555,
      longitude: 126.91899,
      naverMapUrl: 'https://example.com/map',
      websiteUrl: null,
      updatedAt: '2026-10-21T01:23:45.678Z',
    });
    expect(typeof result.latitude).toBe('number');
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('일차의 자동 출연진과 이미지·선택값을 보존하며 내부 id는 내보내지 않는다', () => {
    expect(
      toPerformanceDayResponse(
        {
          id: 1n,
          dayKey: 'day1',
          dayLabel: '1일차',
          dateLabel: '날짜',
          bookingUrl: null,
          lineupOverride: '직접 입력',
          timetableImageUrl: '/table',
          updatedAt,
        },
        ['첫째', '둘째'],
      ),
    ).toEqual({
      dayKey: 'day1',
      dayLabel: '1일차',
      dateLabel: '날짜',
      bookingUrl: null,
      lineupOverride: '직접 입력',
      timetableImageUrl: '/table',
      autoLineup: ['첫째', '둘째'],
      updatedAt: '2026-10-21T01:23:45.678Z',
    });
  });

  it('티켓의 이미지·null 설명을 그대로 돌려준다', () => {
    expect(
      toTicketResponse({
        id: 1n,
        frontImageUrl: '/front',
        backImageUrl: null,
        description: null,
        updatedAt,
      }),
    ).toEqual({
      frontImageUrl: '/front',
      backImageUrl: null,
      description: null,
      updatedAt: '2026-10-21T01:23:45.678Z',
    });
  });

  it('안내 섹션·항목 id를 문자열로 바꾸고 category·sortOrder·sectionId는 제외한다', () => {
    const result = toInfoSectionResponse({
      id: 1n,
      category: 'notice',
      title: '안내',
      sortOrder: 2,
      items: [
        { id: 9007199254740993n, sectionId: 1n, content: '내용', sortOrder: 3 },
      ],
    });
    expect(result).toEqual({
      id: '1',
      title: '안내',
      items: [{ id: '9007199254740993', content: '내용' }],
    });
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});
