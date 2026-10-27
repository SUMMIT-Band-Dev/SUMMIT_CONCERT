import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import type {
  InfoSectionModel,
  InfoItemModel,
} from '../generated/prisma/models.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RevalidationService } from '../revalidation/revalidation.service.js';
import { ConcertContentService } from './concert-content.service.js';
import {
  CONTENT_BASE_ROW_NOT_FOUND,
  PERFORMANCE_DAY_NOT_FOUND,
} from './concert-content.constants.js';
import type { InfoCategory } from './concert-content.constants.js';

const concertDto = {
  titleKo: '수정',
  titleEn: 'Updated',
  startDate: '2026-10-21',
  endDate: '2026-10-22',
  showTime: '18시',
};
const venueDto = {
  name: '수정 장소',
  address: '수정 주소',
  latitude: 37.1234567,
  longitude: 127,
};
const dayDto = { dayLabel: '수정 일차', dateLabel: '수정 날짜' };
const missing = () => Object.assign(new Error('행 없음'), { code: 'P2025' });
type SectionRow = InfoSectionModel & { items: InfoItemModel[] };

function createService() {
  const updatedAt = new Date('2026-10-21T01:00:00.000Z');
  const venueRow = {
    id: 12n,
    name: '장소',
    address: '주소',
    addressDetail: null,
    latitude: new Prisma.Decimal('37.552555'),
    longitude: new Prisma.Decimal('126.918990'),
    naverMapUrl: 'https://example.com/map',
    websiteUrl: null,
    updatedAt,
  };
  const concertRow = {
    id: 1n,
    titleKo: '공연',
    titleEn: 'Concert',
    subtitle: null,
    startDate: new Date('2000-01-01T00:00:00Z'),
    endDate: new Date('2000-01-01T00:00:00Z'),
    showTime: '시간',
    posterImageUrl: '/poster.png',
    titleImageUrl: '/title.png',
    subtitleImageUrl: null,
    venueId: venueRow.id,
    updatedAt,
    venue: venueRow,
  };
  const ticketRow = {
    id: 1n,
    frontImageUrl: '/front.png',
    backImageUrl: '/back.png',
    description: null,
    updatedAt,
  };
  const dayRow = {
    id: 2n,
    dayKey: 'day1',
    dayLabel: '1일차',
    dateLabel: '날짜',
    bookingUrl: null,
    lineupOverride: '직접 입력',
    timetableImageUrl: '/day1.png',
    updatedAt,
  };
  const events: string[] = [];
  let sectionRows: SectionRow[] = [
    {
      id: 10n,
      category: 'ticket',
      title: '기존',
      sortOrder: 1,
      items: [{ id: 20n, sectionId: 10n, content: '기존 항목', sortOrder: 1 }],
    },
    { id: 11n, category: 'notice', title: '유지', sortOrder: 1, items: [] },
  ];
  let nextId = 100n;
  const concert = {
    findUnique: vi.fn().mockResolvedValue(concertRow),
    update: vi.fn().mockResolvedValue(concertRow),
  };
  const venue = { update: vi.fn().mockResolvedValue(venueRow) };
  const ticket = {
    findUnique: vi.fn().mockResolvedValue(ticketRow),
    update: vi.fn().mockResolvedValue(ticketRow),
  };
  const performanceDay = {
    findMany: vi
      .fn()
      .mockResolvedValue([
        dayRow,
        { ...dayRow, id: 3n, dayKey: 'day2', lineupOverride: null },
      ]),
    update: vi.fn().mockResolvedValue(dayRow),
  };
  // DB의 orderBy 계약을 실제 데이터 정렬로 흉내 내고, 호출 인자도 별도로 검증한다.
  const teamRows = [
    { id: 9n, teamName: '마지막', day: 'day1', performanceOrder: null },
    { id: 3n, teamName: '둘째', day: 'day1', performanceOrder: 1 },
    { id: 2n, teamName: '첫째', day: 'day1', performanceOrder: 1 },
    { id: 4n, teamName: '다른 날', day: 'day2', performanceOrder: 1 },
  ];
  const lineUp = {
    findMany: vi.fn(async (args: { where: { day: string } }) =>
      teamRows
        .filter((row) => row.day === args.where.day)
        .sort(
          (a, b) =>
            (a.performanceOrder ?? Infinity) -
              (b.performanceOrder ?? Infinity) || Number(a.id - b.id),
        )
        .map((row) => ({ teamName: row.teamName })),
    ),
  };
  const infoSection = {
    findMany: vi.fn(async (args: { where: { category: InfoCategory } }) =>
      sectionRows
        .filter((row) => row.category === args.where.category)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((row) => ({
          ...row,
          items: [...row.items].sort((a, b) => a.sortOrder - b.sortOrder),
        })),
    ),
    deleteMany: vi.fn(async (args: { where: { category: InfoCategory } }) => {
      events.push('delete');
      sectionRows = sectionRows.filter(
        (row) => row.category !== args.where.category,
      );
      return { count: 1 };
    }),
    create: vi.fn(
      async (args: {
        data: {
          category: InfoCategory;
          title: string;
          sortOrder: number;
          items: { create: { content: string; sortOrder: number }[] };
        };
      }) => {
        events.push('create');
        const id = nextId++;
        const row = {
          id,
          category: args.data.category,
          title: args.data.title,
          sortOrder: args.data.sortOrder,
          items: args.data.items.create.map((item) => ({
            ...item,
            id: nextId++,
            sectionId: id,
          })),
        };
        sectionRows.push(row);
        return row;
      },
    ),
  };
  const client = {
    concert,
    venue,
    ticket,
    performanceDay,
    lineUp,
    infoSection,
  };
  const $transaction = vi.fn(
    async (callback: (tx: typeof client) => Promise<unknown>) => {
      const snapshot = sectionRows.map((row) => ({
        ...row,
        items: [...row.items],
      }));
      events.push('begin');
      try {
        const result = await callback(client);
        events.push('commit');
        return result;
      } catch (error) {
        sectionRows = snapshot;
        events.push('rollback');
        throw error;
      }
    },
  );
  const revalidate = vi.fn(async (_tags: readonly string[]) => {
    events.push('revalidate');
    return true;
  });
  return {
    service: new ConcertContentService(
      { ...client, $transaction } as unknown as PrismaService,
      { revalidate } as unknown as RevalidationService,
    ),
    ...client,
    $transaction,
    revalidate,
    events,
    concertRow,
    venueRow,
    dayRow,
    ticketRow,
    rows: () => sectionRows,
  };
}

describe('공연 콘텐츠 저장·재검증', () => {
  const actions = [
    'concert',
    'venue',
    'performance-days',
    'ticket',
    'info-sections',
  ] as const;
  async function save(
    ctx: ReturnType<typeof createService>,
    action: (typeof actions)[number],
  ) {
    if (action === 'concert') return ctx.service.updateConcert(concertDto);
    if (action === 'venue') return ctx.service.updateVenue(venueDto);
    if (action === 'performance-days')
      return ctx.service.updatePerformanceDay('day1', dayDto);
    if (action === 'ticket')
      return ctx.service.updateTicket({ description: '설명' });
    return ctx.service.updateInfoSections('ticket', {
      sections: [{ title: '안내', items: [{ content: '내용' }] }],
    });
  }

  it.each(actions)(
    '%s는 커밋 후 태그를 한 번 재검증하고 false여도 저장 결과를 보존한다',
    async (action) => {
      for (const success of [true, false]) {
        const ctx = createService();
        ctx.revalidate.mockImplementation(async () => {
          ctx.events.push('revalidate');
          return success;
        });
        const result = await save(ctx, action);
        expect(result.revalidated).toBe(success);
        expect(result.data).toBeDefined();
        expect(ctx.events.slice(-2)).toEqual(['commit', 'revalidate']);
        expect(ctx.events).not.toContain('rollback');
        expect(ctx.revalidate).toHaveBeenCalledExactlyOnceWith([action]);
        expect(ctx.$transaction).toHaveBeenCalledOnce();
      }
    },
  );

  it.each(actions)(
    '%s 저장의 DB 오류는 전파되고 재검증되지 않는다',
    async (action) => {
      const ctx = createService();
      const failure = new Error('DB 실패');
      const operation =
        action === 'concert'
          ? ctx.concert.update
          : action === 'venue'
            ? ctx.venue.update
            : action === 'performance-days'
              ? ctx.performanceDay.update
              : action === 'ticket'
                ? ctx.ticket.update
                : ctx.infoSection.create;
      operation.mockRejectedValueOnce(failure);
      await expect(save(ctx, action)).rejects.toBe(failure);
      expect(ctx.revalidate).not.toHaveBeenCalled();
      expect(ctx.events.at(-1)).toBe('rollback');
    },
  );

  it('공연 날짜 순서가 잘못되면 트랜잭션·재검증을 시작하지 않는다', async () => {
    const ctx = createService();
    await expect(
      ctx.service.updateConcert({ ...concertDto, endDate: '2026-10-20' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(ctx.$transaction).not.toHaveBeenCalled();
    expect(ctx.revalidate).not.toHaveBeenCalled();
    await ctx.service.updateConcert({
      ...concertDto,
      endDate: concertDto.startDate,
    });
  });

  it('공연 날짜를 UTC 자정으로 저장하고 이미지 컬럼을 수정하지 않는다', async () => {
    const ctx = createService();
    await ctx.service.updateConcert(concertDto);
    expect(ctx.concert.update).toHaveBeenCalledWith({
      where: { id: 1n },
      include: { venue: true },
      data: {
        titleKo: '수정',
        titleEn: 'Updated',
        subtitle: null,
        startDate: new Date('2026-10-21T00:00:00.000Z'),
        endDate: new Date('2026-10-22T00:00:00.000Z'),
        showTime: '18시',
      },
    });
  });

  it.each([undefined, null, '', '   '])(
    '선택값 %s를 모두 NULL로 전체 교체한다',
    async (value) => {
      const ctx = createService();
      await ctx.service.updateConcert({ ...concertDto, subtitle: value });
      await ctx.service.updateVenue({
        ...venueDto,
        addressDetail: value,
        naverMapUrl: value,
        websiteUrl: value,
      });
      await ctx.service.updatePerformanceDay('day1', {
        ...dayDto,
        bookingUrl: value,
        lineupOverride: value,
      });
      await ctx.service.updateTicket({ description: value });
      expect(ctx.concert.update.mock.calls[0][0].data.subtitle).toBeNull();
      expect(ctx.venue.update).toHaveBeenCalledWith({
        where: { id: 12n },
        data: {
          ...venueDto,
          addressDetail: null,
          naverMapUrl: null,
          websiteUrl: null,
        },
      });
      expect(ctx.performanceDay.update).toHaveBeenCalledWith({
        where: { dayKey: 'day1' },
        data: { ...dayDto, bookingUrl: null, lineupOverride: null },
      });
      expect(ctx.ticket.update).toHaveBeenCalledWith({
        where: { id: 1n },
        data: { description: null },
      });
    },
  );

  it('티켓 PUT은 DB 이미지 값을 그대로 응답한다', async () => {
    const ctx = createService();
    const result = await ctx.service.updateTicket({ description: '설명' });
    expect(result.data).toMatchObject({
      frontImageUrl: '/front.png',
      backImageUrl: '/back.png',
    });
    expect(result.data).toEqual(await ctx.service.getTicket());
  });
});

describe('기본 행·일차의 404', () => {
  it.each(['getConcert', 'getVenue', 'updateConcert', 'updateVenue'] as const)(
    '%s는 Concert 또는 공연장 누락을 같은 문구로 거부한다',
    async (action) => {
      for (const row of [null, { venue: null }]) {
        const ctx = createService();
        ctx.concert.findUnique.mockResolvedValueOnce(row);
        const operation =
          action === 'getConcert'
            ? ctx.service.getConcert()
            : action === 'getVenue'
              ? ctx.service.getVenue()
              : action === 'updateConcert'
                ? ctx.service.updateConcert(concertDto)
                : ctx.service.updateVenue(venueDto);
        await expect(operation).rejects.toThrow(CONTENT_BASE_ROW_NOT_FOUND);
        expect(ctx.revalidate).not.toHaveBeenCalled();
      }
    },
  );
  it('없는 Ticket GET·PUT은 같은 문구로 404다', async () => {
    const ctx = createService();
    ctx.ticket.findUnique.mockResolvedValueOnce(null);
    ctx.ticket.update.mockRejectedValueOnce(missing());
    await expect(ctx.service.getTicket()).rejects.toThrow(
      CONTENT_BASE_ROW_NOT_FOUND,
    );
    await expect(ctx.service.updateTicket({})).rejects.toThrow(
      CONTENT_BASE_ROW_NOT_FOUND,
    );
    expect(ctx.revalidate).not.toHaveBeenCalled();
  });
  it('없는 dayKey는 지정 문구의 404이며 재검증하지 않는다', async () => {
    const ctx = createService();
    ctx.performanceDay.update.mockRejectedValueOnce(missing());
    const operation = ctx.service.updatePerformanceDay('missing', dayDto);
    await expect(operation).rejects.toBeInstanceOf(NotFoundException);
    await expect(operation).rejects.toThrow(PERFORMANCE_DAY_NOT_FOUND);
    expect(ctx.revalidate).not.toHaveBeenCalled();
  });
  it('존재 확인 뒤 Concert·Venue가 없어져도 P2025를 404로 바꾼다', async () => {
    const ctx = createService();
    ctx.concert.update.mockRejectedValueOnce(missing());
    ctx.venue.update.mockRejectedValueOnce(missing());
    await expect(ctx.service.updateConcert(concertDto)).rejects.toThrow(
      CONTENT_BASE_ROW_NOT_FOUND,
    );
    await expect(ctx.service.updateVenue(venueDto)).rejects.toThrow(
      CONTENT_BASE_ROW_NOT_FOUND,
    );
    expect(ctx.revalidate).not.toHaveBeenCalled();
  });
});

describe('일차·자동 출연진 조회', () => {
  it('dayKey 순으로 조회하며 override가 있어도 팀을 순서(NULL 뒤)·id 순으로 계산한다', async () => {
    const ctx = createService();
    const result = await ctx.service.getPerformanceDays();
    expect(ctx.performanceDay.findMany).toHaveBeenCalledExactlyOnceWith({
      orderBy: { dayKey: 'asc' },
    });
    expect(result.map((row) => row.dayKey)).toEqual(['day1', 'day2']);
    expect(result[0]).toMatchObject({
      lineupOverride: '직접 입력',
      autoLineup: ['첫째', '둘째', '마지막'],
    });
    expect(result[1].autoLineup).toEqual(['다른 날']);
    expect(ctx.lineUp.findMany).toHaveBeenCalledWith({
      where: { day: 'day1' },
      orderBy: [
        { performanceOrder: { sort: 'asc', nulls: 'last' } },
        { id: 'asc' },
      ],
      select: { teamName: true },
    });
    expect(ctx.revalidate).not.toHaveBeenCalled();
  });
  it('일차 PUT도 같은 autoLineup을 응답한다', async () => {
    const ctx = createService();
    const result = await ctx.service.updatePerformanceDay('day1', dayDto);
    expect(result.data.autoLineup).toEqual(['첫째', '둘째', '마지막']);
  });
});

describe('안내 섹션 전체 교체의 원자성', () => {
  it('해당 분류만 삭제·재생성하고 1..N 순서로 섹션·항목을 저장한다', async () => {
    const ctx = createService();
    const notice = ctx.rows().filter((row) => row.category === 'notice');
    const result = await ctx.service.updateInfoSections('ticket', {
      sections: [
        {
          title: '첫 섹션',
          items: [{ content: '첫 항목' }, { content: '둘째 항목' }],
        },
        { title: '둘째 섹션', items: [] },
      ],
    });
    expect(ctx.infoSection.deleteMany).toHaveBeenCalledExactlyOnceWith({
      where: { category: 'ticket' },
    });
    expect(ctx.rows().filter((row) => row.category === 'notice')).toEqual(
      notice,
    );
    expect(
      ctx
        .rows()
        .filter((row) => row.category === 'ticket')
        .map((row) => [row.sortOrder, row.items.map((item) => item.sortOrder)]),
    ).toEqual([
      [1, [1, 2]],
      [2, []],
    ]);
    expect(result.data.map((row) => row.title)).toEqual([
      '첫 섹션',
      '둘째 섹션',
    ]);
    expect(result.data[0].items.map((row) => row.content)).toEqual([
      '첫 항목',
      '둘째 항목',
    ]);
    expect(ctx.events).toEqual([
      'begin',
      'delete',
      'create',
      'create',
      'commit',
      'revalidate',
    ]);
    expect(ctx.infoSection.findMany).toHaveBeenCalledWith({
      where: { category: 'ticket' },
      orderBy: { sortOrder: 'asc' },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    const again = await ctx.service.updateInfoSections('ticket', {
      sections: [{ title: '다시 저장', items: [] }],
    });
    expect(again.data[0].id).not.toBe(result.data[0].id);
  });
  it('빈 배열은 해당 분류를 전부 지우고 다른 분류를 유지한다', async () => {
    const ctx = createService();
    const result = await ctx.service.updateInfoSections('ticket', {
      sections: [],
    });
    expect(result.data).toEqual([]);
    expect(ctx.rows().map((row) => row.category)).toEqual(['notice']);
    expect(ctx.infoSection.create).not.toHaveBeenCalled();
  });
  it('중간 생성 실패 시 전체 트랜잭션을 되돌리고 재검증하지 않는다', async () => {
    const ctx = createService();
    const before = ctx.rows().map((row) => ({ ...row, items: [...row.items] }));
    const failure = new Error('두 번째 생성 실패');
    const original = ctx.infoSection.create.getMockImplementation()!;
    ctx.infoSection.create
      .mockImplementationOnce(original)
      .mockRejectedValueOnce(failure);
    await expect(
      ctx.service.updateInfoSections('ticket', {
        sections: [
          { title: '첫째', items: [] },
          { title: '실패', items: [] },
        ],
      }),
    ).rejects.toBe(failure);
    expect(ctx.rows()).toEqual(before);
    expect(ctx.events).toEqual(['begin', 'delete', 'create', 'rollback']);
    expect(ctx.revalidate).not.toHaveBeenCalled();
  });
});
