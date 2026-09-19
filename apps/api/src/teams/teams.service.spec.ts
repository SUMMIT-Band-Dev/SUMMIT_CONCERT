import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { TeamsService } from './teams.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

// 2단계와 같은 방식으로 PrismaService만 대역으로 둔다. 다만 호출 여부만 보는 게 아니라
// 작은 인메모리 저장소로 동작까지 흉내 내서, 순서 부여·집합 검증 같은 로직을 실제로 검증한다.
interface LineUpRow {
  id: bigint;
  teamName: string;
  day: string | null;
  performanceOrder: number | null;
  cardImageUrl: string | null;
}

/** 실데이터와 같은 모양: 순서가 전체 1..N이 아니라 일자별 1..N */
const initialRows = (): LineUpRow[] => [
  { id: 1n, teamName: '8C8', day: 'day1', performanceOrder: 1, cardImageUrl: '/day1-team1.png' },
  { id: 2n, teamName: '뉴비', day: 'day1', performanceOrder: 2, cardImageUrl: null },
  { id: 3n, teamName: '즐겜굴비', day: 'day1', performanceOrder: 3, cardImageUrl: null },
  { id: 8n, teamName: '오미자', day: 'day2', performanceOrder: 1, cardImageUrl: null },
  { id: 9n, teamName: '낭만치사량', day: 'day2', performanceOrder: 2, cardImageUrl: null },
];

interface WhereArgs {
  where?: { id?: bigint; day?: string; performanceOrder?: number };
}
interface OrderByArgs {
  orderBy?: unknown;
}
interface DataArgs {
  data: Partial<LineUpRow>;
}

function createService(rows: LineUpRow[] = initialRows()) {
  const store = rows.map((row) => ({ ...row }));
  let nextId = 16n;

  const byDay = (day: string | undefined) =>
    day === undefined ? store : store.filter((row) => row.day === day);

  const sorted = (subset: LineUpRow[]) =>
    [...subset].sort(
      (a, b) =>
        (a.performanceOrder ?? Number.MAX_SAFE_INTEGER) -
          (b.performanceOrder ?? Number.MAX_SAFE_INTEGER) || Number(a.id - b.id),
    );

  const lineUp = {
    findMany: vi.fn(async (args: WhereArgs & OrderByArgs = {}) =>
      sorted(byDay(args.where?.day)).map((row) => ({ ...row })),
    ),

    findFirst: vi.fn(async (args: WhereArgs) => {
      const found = store.find(
        (row) =>
          row.day === args.where?.day &&
          row.performanceOrder === args.where?.performanceOrder,
      );
      return found ? { ...found } : null;
    }),

    findUnique: vi.fn(async (args: WhereArgs) => {
      const found = store.find((row) => row.id === args.where?.id);
      return found ? { ...found } : null;
    }),

    create: vi.fn(async (args: DataArgs) => {
      const created: LineUpRow = {
        id: nextId,
        teamName: '',
        day: null,
        performanceOrder: null,
        cardImageUrl: null,
        ...args.data,
      };
      nextId += 1n;
      store.push(created);
      return { ...created };
    }),

    update: vi.fn(async (args: WhereArgs & DataArgs) => {
      const target = store.find((row) => row.id === args.where?.id);
      if (!target) {
        // Prisma가 갱신 대상이 없을 때 내는 코드. mapRecordNotFound가 404로 바꿔야 한다.
        throw Object.assign(new Error('Record to update not found.'), { code: 'P2025' });
      }
      Object.assign(target, args.data);
      return { ...target };
    }),

    aggregate: vi.fn(async (args: WhereArgs) => {
      const orders = byDay(args.where?.day)
        .map((row) => row.performanceOrder)
        .filter((order): order is number => order !== null);
      return {
        _max: { performanceOrder: orders.length > 0 ? Math.max(...orders) : null },
      };
    }),
  };

  const $transaction = vi.fn(
    async (callback: (tx: { lineUp: typeof lineUp }) => Promise<unknown>) =>
      callback({ lineUp }),
  );

  const prisma = { lineUp, $transaction } as unknown as PrismaService;

  return { service: new TeamsService(prisma), lineUp, $transaction, store };
}

describe('TeamsService.findAll (F003)', () => {
  it('day → performanceOrder → id 순으로 정렬해 조회한다', async () => {
    const { service, lineUp } = createService();

    await service.findAll();

    expect(lineUp.findMany).toHaveBeenCalledWith({
      orderBy: [
        { day: { sort: 'asc', nulls: 'last' } },
        { performanceOrder: { sort: 'asc', nulls: 'last' } },
        { id: 'asc' },
      ],
    });
  });

  it('id를 문자열로 직렬화하고 PRD 필드명으로 내보낸다', async () => {
    const { service } = createService();

    const teams = await service.findAll();

    expect(teams[0]).toEqual({
      id: '1',
      teamName: '8C8',
      day: 'day1',
      performanceOrder: 1,
      cardImageUrl: '/day1-team1.png',
    });
    expect(typeof teams[0].id).toBe('string');
  });

  it('응답 전체가 BigInt 없이 JSON으로 직렬화된다', async () => {
    const { service } = createService();

    const teams = await service.findAll();

    expect(() => JSON.stringify(teams)).not.toThrow();
  });
});

describe('TeamsService.create (F004)', () => {
  const validDto = { teamName: '신규팀', day: 'day1', performanceOrder: 4 };

  it('팀을 등록하고 id를 문자열로 돌려준다', async () => {
    const { service, store } = createService();

    const created = await service.create(validDto);

    expect(created).toEqual({
      id: '16',
      teamName: '신규팀',
      day: 'day1',
      performanceOrder: 4,
      cardImageUrl: null,
    });
    expect(store).toHaveLength(6);
  });

  it('같은 일자에 이미 쓰인 순서면 409로 거부하고 등록하지 않는다', async () => {
    const { service, lineUp, store } = createService();

    await expect(
      service.create({ teamName: '중복팀', day: 'day1', performanceOrder: 2 }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(lineUp.create).not.toHaveBeenCalled();
    expect(store).toHaveLength(5);
  });

  it('409 메시지가 어느 팀과 충돌했는지 알려준다', async () => {
    const { service } = createService();

    await expect(
      service.create({ teamName: '중복팀', day: 'day1', performanceOrder: 2 }),
    ).rejects.toThrow(/뉴비/);
  });

  it('다른 일자의 같은 번호는 충돌이 아니다 (순서는 일자별로 매겨진다)', async () => {
    const { service } = createService();

    const created = await service.create({
      teamName: '신규팀',
      day: 'day2',
      performanceOrder: 3,
    });

    expect(created.performanceOrder).toBe(3);
  });

  it('PK 충돌(P2002)은 500이 아니라 409로 나간다', async () => {
    // 실제로 났던 사고: id 시퀀스가 기존 데이터(max=15)보다 뒤처져(last_value=7)
    // nextval이 이미 쓰인 id를 돌려줘 PK가 터졌다.
    const { service, lineUp } = createService();
    lineUp.create.mockRejectedValueOnce(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
    );

    await expect(service.create(validDto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('중복 확인과 등록이 하나의 트랜잭션 안에서 일어난다', async () => {
    const { service, $transaction } = createService();

    await service.create(validDto);

    expect($transaction).toHaveBeenCalledOnce();
  });
});

describe('TeamsService.update (F005)', () => {
  it('팀명만 수정하면 일자와 순서는 그대로다', async () => {
    const { service } = createService();

    const updated = await service.update(1n, { teamName: '이름바꾼팀' });

    expect(updated).toMatchObject({
      id: '1',
      teamName: '이름바꾼팀',
      day: 'day1',
      performanceOrder: 1,
    });
  });

  it('팀명을 바꿔도 id는 건드리지 않는다 (Setlist FK 보호)', async () => {
    const { service, lineUp } = createService();

    await service.update(1n, { teamName: '이름바꾼팀' });

    expect(lineUp.update).toHaveBeenCalledWith({
      where: { id: 1n },
      data: { teamName: '이름바꾼팀' },
    });
  });

  it('없는 id면 404', async () => {
    const { service } = createService();

    await expect(service.update(999n, { teamName: '아무개' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('본문이 비어 있으면 400이고 트랜잭션을 열지 않는다', async () => {
    const { service, $transaction } = createService();

    await expect(service.update(1n, {})).rejects.toBeInstanceOf(BadRequestException);
    expect($transaction).not.toHaveBeenCalled();
  });

  it('day를 바꾸면 대상 일자의 맨 뒤로 이동한다', async () => {
    const { service } = createService();

    // day1의 1번 팀을 day2로 옮긴다. day2는 1,2가 차 있으므로 3번이 되어야 한다.
    const updated = await service.update(1n, { day: 'day2' });

    expect(updated).toMatchObject({ id: '1', day: 'day2', performanceOrder: 3 });
  });

  it('같은 day를 그대로 보내면 순서를 재배치하지 않는다 (no-op)', async () => {
    const { service, lineUp } = createService();

    const updated = await service.update(1n, { day: 'day1' });

    expect(updated.performanceOrder).toBe(1);
    expect(lineUp.aggregate).not.toHaveBeenCalled();
    expect(lineUp.update).toHaveBeenCalledWith({ where: { id: 1n }, data: {} });
  });

  it('팀이 없는 일자로 옮기면 1번이 된다', async () => {
    const { service } = createService();

    const updated = await service.update(1n, { day: 'day9' });

    expect(updated).toMatchObject({ day: 'day9', performanceOrder: 1 });
  });

  it('팀명과 일자를 함께 바꿀 수 있다', async () => {
    const { service } = createService();

    const updated = await service.update(2n, { teamName: '이사간팀', day: 'day2' });

    expect(updated).toMatchObject({
      teamName: '이사간팀',
      day: 'day2',
      performanceOrder: 3,
    });
  });
});

describe('TeamsService.reorder (F006)', () => {
  it('배열 순서대로 1..N을 부여한다', async () => {
    const { service } = createService();

    const reordered = await service.reorder({ day: 'day1', teamIds: ['3', '1', '2'] });

    expect(reordered.map((team) => [team.id, team.performanceOrder])).toEqual([
      ['3', 1],
      ['1', 2],
      ['2', 3],
    ]);
  });

  it('현재 순서를 그대로 보내면 결과가 바뀌지 않는다', async () => {
    const { service } = createService();

    const reordered = await service.reorder({ day: 'day1', teamIds: ['1', '2', '3'] });

    expect(reordered.map((team) => [team.id, team.performanceOrder])).toEqual([
      ['1', 1],
      ['2', 2],
      ['3', 3],
    ]);
  });

  it('다른 일자는 건드리지 않는다', async () => {
    const { service, store } = createService();

    await service.reorder({ day: 'day1', teamIds: ['3', '2', '1'] });

    const day2 = store.filter((row) => row.day === 'day2');
    expect(day2.map((row) => row.performanceOrder)).toEqual([1, 2]);
  });

  it('전체 집합에서 빠진 팀이 있으면 거부하고 아무것도 쓰지 않는다', async () => {
    const { service, lineUp, store } = createService();

    await expect(
      service.reorder({ day: 'day1', teamIds: ['1', '2'] }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(lineUp.update).not.toHaveBeenCalled();
    expect(store.map((row) => row.performanceOrder)).toEqual([1, 2, 3, 1, 2]);
  });

  it('해당 일자에 없는 id가 섞이면 거부한다', async () => {
    const { service, lineUp } = createService();

    // 8번은 day2 소속이다
    await expect(
      service.reorder({ day: 'day1', teamIds: ['1', '2', '3', '8'] }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(lineUp.update).not.toHaveBeenCalled();
  });

  it('존재하지 않는 id도 같은 이유로 거부한다', async () => {
    const { service } = createService();

    await expect(
      service.reorder({ day: 'day1', teamIds: ['1', '2', '999'] }),
    ).rejects.toThrow(/999/);
  });

  it('중복 id는 트랜잭션을 열기 전에 거부한다', async () => {
    const { service, $transaction } = createService();

    await expect(
      service.reorder({ day: 'day1', teamIds: ['1', '1', '2'] }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect($transaction).not.toHaveBeenCalled();
  });

  it('숫자가 아닌 id는 400 (BigInt 변환 예외가 500으로 새지 않는다)', async () => {
    const { service } = createService();

    await expect(
      service.reorder({ day: 'day1', teamIds: ['1', 'two', '3'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('팀이 없는 일자는 400', async () => {
    const { service } = createService();

    await expect(
      service.reorder({ day: 'day9', teamIds: ['1'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('모든 갱신이 하나의 트랜잭션 안에서 일어난다', async () => {
    const { service, $transaction, lineUp } = createService();

    await service.reorder({ day: 'day1', teamIds: ['3', '1', '2'] });

    expect($transaction).toHaveBeenCalledOnce();
    expect(lineUp.update).toHaveBeenCalledTimes(3);
  });

  it('응답이 BigInt 없이 JSON으로 직렬화된다', async () => {
    const { service } = createService();

    const reordered = await service.reorder({ day: 'day2', teamIds: ['9', '8'] });

    expect(() => JSON.stringify(reordered)).not.toThrow();
  });
});
