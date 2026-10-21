import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { createValidationPipe } from '../../app.setup.js';
import {
  UpdateConcertDto,
  UpdateVenueDto,
  UpdatePerformanceDayDto,
  UpdateTicketDto,
  UpdateInfoSectionsDto,
  InfoCategoryQueryDto,
} from './update-concert-content.dto.js';

const concert = {
  titleKo: '공연',
  titleEn: 'Concert',
  startDate: '2028-02-29',
  endDate: '2028-03-01',
  showTime: '18:00',
};
const venue = {
  name: '공연장',
  address: '주소',
  latitude: 37.5525551,
  longitude: 126.91899,
};
const day = { dayLabel: '1일차', dateLabel: '토요일' };
const sections = {
  sections: [{ title: '안내', items: [{ content: '내용' }] }],
};
const options = { whitelist: true, forbidNonWhitelisted: true };
async function errors<T extends object>(ctor: new () => T, input: unknown) {
  return validate(plainToInstance(ctor, input), options);
}

describe('공연 콘텐츠 DTO — 필수값·형식·상한', () => {
  it.each([
    [UpdateConcertDto, concert],
    [UpdateVenueDto, venue],
    [UpdatePerformanceDayDto, day],
    [UpdateTicketDto, {}],
    [UpdateInfoSectionsDto, sections],
    [InfoCategoryQueryDto, { category: 'ticket' }],
  ])(
    '정상 입력이 검증과 실제 ValidationPipe를 통과한다',
    async (ctor, input) => {
      expect(await errors(ctor as new () => object, input)).toEqual([]);
      await expect(
        createValidationPipe().transform(input, {
          type: 'body',
          metatype: ctor,
        }),
      ).resolves.toBeInstanceOf(ctor);
    },
  );

  it.each(['titleKo', 'titleEn', 'startDate', 'endDate', 'showTime'])(
    '공연 필수값 %s의 누락·null·빈 값·다른 타입을 거부한다',
    async (field) => {
      for (const value of [undefined, null, '   ', 42]) {
        expect(
          await errors(UpdateConcertDto, { ...concert, [field]: value }),
        ).not.toEqual([]);
      }
    },
  );
  it.each(['name', 'address', 'latitude', 'longitude'])(
    '공연장 필수값 %s의 누락·null을 거부한다',
    async (field) => {
      for (const value of [undefined, null])
        expect(
          await errors(UpdateVenueDto, { ...venue, [field]: value }),
        ).not.toEqual([]);
    },
  );
  it.each(['dayLabel', 'dateLabel'])(
    '일차 필수값 %s의 누락·null·빈 값·다른 타입을 거부한다',
    async (field) => {
      for (const value of [undefined, null, '  ', 10])
        expect(
          await errors(UpdatePerformanceDayDto, { ...day, [field]: value }),
        ).not.toEqual([]);
    },
  );

  it.each([
    ['titleKo', 100],
    ['titleEn', 100],
    ['subtitle', 200],
    ['showTime', 50],
  ])('공연 %s의 최대 길이를 지킨다', async (field, max) => {
    expect(
      await errors(UpdateConcertDto, { ...concert, [field]: '가'.repeat(max) }),
    ).toEqual([]);
    expect(
      await errors(UpdateConcertDto, {
        ...concert,
        [field]: '가'.repeat(max + 1),
      }),
    ).not.toEqual([]);
  });
  it.each([
    ['name', 100],
    ['address', 200],
    ['addressDetail', 200],
  ])('공연장 %s의 문자열·길이를 지킨다', async (field, max) => {
    expect(
      await errors(UpdateVenueDto, { ...venue, [field]: '가'.repeat(max) }),
    ).toEqual([]);
    for (const value of ['가'.repeat(max + 1), 42])
      expect(
        await errors(UpdateVenueDto, { ...venue, [field]: value }),
      ).not.toEqual([]);
  });
  it.each(['name', 'address'])(
    '공연장 %s의 공백 문자열을 거부한다',
    async (field) => {
      expect(
        await errors(UpdateVenueDto, { ...venue, [field]: '  ' }),
      ).not.toEqual([]);
    },
  );
  it.each([
    ['dayLabel', 50],
    ['dateLabel', 100],
    ['lineupOverride', 1000],
  ])('일차 %s의 길이를 지킨다', async (field, max) => {
    expect(
      await errors(UpdatePerformanceDayDto, {
        ...day,
        [field]: '가'.repeat(max),
      }),
    ).toEqual([]);
    expect(
      await errors(UpdatePerformanceDayDto, {
        ...day,
        [field]: '가'.repeat(max + 1),
      }),
    ).not.toEqual([]);
  });

  it.each([
    '2026-02-30',
    '2026-02-29',
    '2026-13-01',
    '2026-00-10',
    '2026-1-01',
    '2026-01-01T00:00:00Z',
    'not-date',
  ])('실제 날짜가 아닌 %s를 양쪽 날짜에서 거부한다', async (value) => {
    for (const field of ['startDate', 'endDate'])
      expect(
        await errors(UpdateConcertDto, { ...concert, [field]: value }),
      ).not.toEqual([]);
  });
  it.each([
    ['latitude', -90, 90],
    ['longitude', -180, 180],
  ])('좌표 %s는 숫자와 범위만 허용한다', async (field, min, max) => {
    for (const value of [min, max, 37.1234567])
      expect(
        await errors(UpdateVenueDto, { ...venue, [field]: value }),
      ).toEqual([]);
    for (const value of [min - 0.1, max + 0.1, '37', NaN, Infinity])
      expect(
        await errors(UpdateVenueDto, { ...venue, [field]: value }),
      ).not.toEqual([]);
  });

  it.each(['naverMapUrl', 'websiteUrl', 'bookingUrl'])(
    '선택 URL %s는 https·사용자 정보 금지·2048자 상한을 지킨다',
    async (field) => {
      const ctor =
        field === 'bookingUrl' ? UpdatePerformanceDayDto : UpdateVenueDto;
      const base = field === 'bookingUrl' ? day : venue;
      for (const value of [
        'http://example.com',
        'https://user:pass@example.com',
        'bad',
        42,
        `https://example.com/${'x'.repeat(2048)}`,
      ]) {
        expect(
          await errors(ctor as new () => object, { ...base, [field]: value }),
        ).not.toEqual([]);
      }
      for (const value of [
        undefined,
        null,
        '',
        '   ',
        ' https://example.com/path?q=1#hash ',
      ]) {
        expect(
          await errors(ctor as new () => object, { ...base, [field]: value }),
        ).toEqual([]);
      }
      const prefix = 'https://example.com/';
      expect(
        await errors(ctor as new () => object, {
          ...base,
          [field]: prefix + 'a'.repeat(2048 - prefix.length),
        }),
      ).toEqual([]);
    },
  );

  it('티켓 설명의 타입과 2000자 상한을 검사한다', async () => {
    for (const description of [42, '가'.repeat(2001)])
      expect(await errors(UpdateTicketDto, { description })).not.toEqual([]);
    for (const description of [undefined, null, '', '  ', '가'.repeat(2000)])
      expect(await errors(UpdateTicketDto, { description })).toEqual([]);
  });
  it('선택 텍스트는 생략·null·빈 값이 허용되고 잘못된 타입은 거부된다', async () => {
    for (const value of [undefined, null, '', '  ']) {
      expect(
        await errors(UpdateConcertDto, { ...concert, subtitle: value }),
      ).toEqual([]);
      expect(
        await errors(UpdateVenueDto, { ...venue, addressDetail: value }),
      ).toEqual([]);
      expect(
        await errors(UpdatePerformanceDayDto, {
          ...day,
          lineupOverride: value,
        }),
      ).toEqual([]);
    }
    expect(
      await errors(UpdateConcertDto, { ...concert, subtitle: 42 }),
    ).not.toEqual([]);
    expect(
      await errors(UpdatePerformanceDayDto, { ...day, lineupOverride: 42 }),
    ).not.toEqual([]);
  });
  it('문자열과 중첩 문자열을 검사 전에 trim한다', async () => {
    expect(
      plainToInstance(UpdateConcertDto, { ...concert, titleKo: ' 공연 ' })
        .titleKo,
    ).toBe('공연');
    expect(
      plainToInstance(UpdateInfoSectionsDto, {
        sections: [{ title: ' 안내 ', items: [{ content: ' 내용 ' }] }],
      }).sections[0],
    ).toMatchObject({ title: '안내', items: [{ content: '내용' }] });
  });
});

describe('안내 섹션 DTO와 선언되지 않은 필드', () => {
  it.each([undefined, null, 'bad', {}])(
    'sections에는 배열만 허용한다',
    async (value) => {
      expect(
        await errors(UpdateInfoSectionsDto, { sections: value }),
      ).not.toEqual([]);
    },
  );
  it('빈 섹션·빈 항목 배열을 허용하고 상한은 20개·50개다', async () => {
    for (const input of [
      { sections: [] },
      { sections: [{ title: '제목', items: [] }] },
    ])
      expect(await errors(UpdateInfoSectionsDto, input)).toEqual([]);
    expect(
      await errors(UpdateInfoSectionsDto, {
        sections: Array.from({ length: 20 }, () => ({
          title: '제목',
          items: [],
        })),
      }),
    ).toEqual([]);
    expect(
      await errors(UpdateInfoSectionsDto, {
        sections: Array.from({ length: 21 }, () => ({
          title: '제목',
          items: [],
        })),
      }),
    ).not.toEqual([]);
    for (const count of [50, 51]) {
      const result = await errors(UpdateInfoSectionsDto, {
        sections: [
          {
            title: '제목',
            items: Array.from({ length: count }, () => ({ content: '내용' })),
          },
        ],
      });
      expect(result.length === 0).toBe(count === 50);
    }
  });
  it('중첩 필수값·타입·최대 길이를 검증한다', async () => {
    for (const title of [undefined, null, '', '  ', 42, '가'.repeat(101)])
      expect(
        await errors(UpdateInfoSectionsDto, {
          sections: [{ title, items: [] }],
        }),
      ).not.toEqual([]);
    for (const items of [undefined, null, 'bad', {}])
      expect(
        await errors(UpdateInfoSectionsDto, {
          sections: [{ title: '제목', items }],
        }),
      ).not.toEqual([]);
    for (const content of [undefined, null, '', '  ', 42, '가'.repeat(501)])
      expect(
        await errors(UpdateInfoSectionsDto, {
          sections: [{ title: '제목', items: [{ content }] }],
        }),
      ).not.toEqual([]);
    expect(
      await errors(UpdateInfoSectionsDto, {
        sections: [
          { title: '가'.repeat(100), items: [{ content: '가'.repeat(500) }] },
        ],
      }),
    ).toEqual([]);
  });
  it.each([undefined, null, '', 'other', ['ticket']])(
    '없는 분류·잘못된 분류를 거부한다',
    async (category) => {
      expect(await errors(InfoCategoryQueryDto, { category })).not.toEqual([]);
    },
  );
  it.each(['ticket', 'notice'])('두 분류를 허용한다: %s', async (category) => {
    expect(await errors(InfoCategoryQueryDto, { category })).toEqual([]);
  });
  it.each([
    [UpdateConcertDto, { ...concert, posterImageUrl: 'https://example.com' }],
    [UpdateVenueDto, { ...venue, id: '2' }],
    [
      UpdatePerformanceDayDto,
      { ...day, timetableImageUrl: 'https://example.com' },
    ],
    [
      UpdateTicketDto,
      { description: null, frontImageUrl: 'https://example.com' },
    ],
    [UpdateInfoSectionsDto, { ...sections, extra: true }],
    [
      UpdateInfoSectionsDto,
      { sections: [{ title: '제목', items: [], sortOrder: 2 }] },
    ],
    [
      UpdateInfoSectionsDto,
      { sections: [{ title: '제목', items: [{ content: '내용', id: '1' }] }] },
    ],
  ])(
    '선언되지 않은 본문·중첩 필드가 실제 파이프에서 400이다',
    async (ctor, input) => {
      await expect(
        createValidationPipe().transform(input, {
          type: 'body',
          metatype: ctor,
        }),
      ).rejects.toMatchObject({ status: 400 });
    },
  );
});
