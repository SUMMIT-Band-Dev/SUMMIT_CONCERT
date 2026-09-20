import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { SongsService } from './songs.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { YoutubeReviewStatus } from '../generated/prisma/enums.js';

// 3단계와 같은 방식으로 PrismaService만 대역으로 두되, 작은 인메모리 저장소로
// 동작까지 흉내 내서 중복 판정·잠금 순서 같은 로직을 실제로 검증한다.
interface SongRow {
  id: bigint;
  teamId: bigint | null;
  title: string;
  singer: string | null;
  albumCoverUrl: string | null;
  youtubeUrl: string | null;
  youtubeReviewStatus: YoutubeReviewStatus;
}

/** 실데이터와 같은 모양: 팀별로 곡이 묶이고, 앨범 커버는 대부분 채워져 있다 */
const initialRows = (): SongRow[] => [
  {
    id: 1n,
    teamId: 1n,
    title: '0+0',
    singer: '한로로',
    albumCoverUrl: 'https://cdn.example/a.jpg',
    youtubeUrl: null,
    youtubeReviewStatus: 'pending',
  },
  {
    id: 2n,
    teamId: 1n,
    title: 'Congratulations',
    singer: 'Day6',
    albumCoverUrl: 'https://cdn.example/b.jpg',
    youtubeUrl: 'https://www.youtube.com/watch?v=BTo-I-gCAxk',
    youtubeReviewStatus: 'approved',
  },
  {
    id: 3n,
    teamId: 1n,
    title: 'Butterfly',
    singer: '러브홀릭스',
    albumCoverUrl: null,
    youtubeUrl: null,
    youtubeReviewStatus: 'pending',
  },
  // 같은 제목이지만 팀도 가수도 다르다 — 실데이터의 "Butterfly" 2건과 같은 상황
  {
    id: 4n,
    teamId: 2n,
    title: 'Butterfly',
    singer: '전영호',
    albumCoverUrl: null,
    youtubeUrl: null,
    youtubeReviewStatus: 'pending',
  },
];

interface WhereArgs {
  where?: { id?: bigint; teamId?: bigint };
}
interface OrderByArgs {
  orderBy?: unknown;
}
interface DataArgs {
  data: Partial<SongRow>;
}

/** 팀 3은 곡이 0건인 실제 팀(등록 직후 상태)을 재현한다 */
function createService(rows: SongRow[] = initialRows(), teamIds = [1n, 2n, 3n]) {
  const store = rows.map((row) => ({ ...row }));
  let nextId = 65n;

  const lineUp = {
    findUnique: vi.fn(async (args: WhereArgs) => {
      const found = teamIds.find((id) => id === args.where?.id);
      return found === undefined ? null : { id: found };
    }),
  };

  const setlist = {
    findMany: vi.fn(async (args: WhereArgs & OrderByArgs = {}) =>
      store
        .filter((row) => row.teamId === args.where?.teamId)
        .sort((a, b) => Number(a.id - b.id))
        .map((row) => ({ ...row })),
    ),

    findUnique: vi.fn(async (args: WhereArgs) => {
      const found = store.find((row) => row.id === args.where?.id);
      return found ? { ...found } : null;
    }),

    create: vi.fn(async (args: DataArgs) => {
      const created: SongRow = {
        id: nextId,
        teamId: null,
        title: '',
        singer: null,
        albumCoverUrl: null,
        youtubeUrl: null,
        youtubeReviewStatus: 'pending',
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
        throw Object.assign(new Error('Record to update not found.'), {
          code: 'P2025',
        });
      }
      Object.assign(target, args.data);
      return { ...target };
    }),
  };

  // 태그드 템플릿이라 (strings, ...values) 형태로 들어온다
  const $queryRaw = vi.fn(async (_strings: TemplateStringsArray, teamId: bigint) =>
    teamIds.some((id) => id === teamId) ? [{ id: teamId }] : [],
  );

  // work02-6b: 제목·가수가 실제로 바뀌면 그 곡의 추천 이력을 무효화하므로 델리게이트가 필요하다.
  const openAttempts: bigint[] = [];
  const youtubeSearchAttempt = {
    findMany: vi.fn(async () => openAttempts.map((id) => ({ id }))),
    updateMany: vi.fn(async () => ({ count: 0 })),
  };
  const youtubeRecommendation = {
    deleteMany: vi.fn(async () => ({ count: 0 })),
  };

  const $transaction = vi.fn(
    async (
      callback: (tx: {
        setlist: typeof setlist;
        $queryRaw: typeof $queryRaw;
        youtubeSearchAttempt: typeof youtubeSearchAttempt;
        youtubeRecommendation: typeof youtubeRecommendation;
      }) => Promise<unknown>,
    ) => callback({ setlist, $queryRaw, youtubeSearchAttempt, youtubeRecommendation }),
  );

  const prisma = {
    lineUp,
    setlist,
    $queryRaw,
    $transaction,
    youtubeSearchAttempt,
    youtubeRecommendation,
  } as unknown as PrismaService;

  return {
    service: new SongsService(prisma),
    lineUp,
    setlist,
    $queryRaw,
    $transaction,
    youtubeSearchAttempt,
    youtubeRecommendation,
    store,
  };
}

describe('SongsService.findAllByTeam (F008)', () => {
  it('id 오름차순으로 조회한다 (공개 프론트의 정렬과 동일)', async () => {
    const { service, setlist } = createService();

    await service.findAllByTeam(1n);

    expect(setlist.findMany).toHaveBeenCalledWith({
      where: { teamId: 1n },
      orderBy: { id: 'asc' },
    });
  });

  it('id/teamId를 문자열로 직렬화하고 PRD 필드명으로 내보낸다', async () => {
    const { service } = createService();

    const songs = await service.findAllByTeam(1n);

    expect(songs).toHaveLength(3);
    expect(songs[0]).toEqual({
      id: '1',
      teamId: '1',
      title: '0+0',
      singer: '한로로',
      albumCoverUrl: 'https://cdn.example/a.jpg',
      youtubeUrl: null,
      youtubeReviewStatus: 'pending',
    });
    expect(typeof songs[0].id).toBe('string');
    expect(typeof songs[0].teamId).toBe('string');
  });

  it('곡이 0건인 실제 팀은 빈 배열이다 (404가 아니다)', async () => {
    const { service } = createService();

    await expect(service.findAllByTeam(3n)).resolves.toEqual([]);
  });

  it('존재하지 않는 팀은 404다 (빈 배열과 구분된다)', async () => {
    const { service, setlist } = createService();

    await expect(service.findAllByTeam(999n)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(setlist.findMany).not.toHaveBeenCalled();
  });

  it('응답 전체가 BigInt 없이 JSON으로 직렬화된다', async () => {
    const { service } = createService();

    const songs = await service.findAllByTeam(1n);

    expect(() => JSON.stringify(songs)).not.toThrow();
  });
});

describe('SongsService.create (F009)', () => {
  const validDto = { title: '자처', singer: '한로로' };

  it('곡을 등록하고 id를 문자열로 돌려준다', async () => {
    const { service, store } = createService();

    const created = await service.create(1n, validDto);

    expect(created).toEqual({
      id: '65',
      teamId: '1',
      title: '자처',
      singer: '한로로',
      albumCoverUrl: null,
      youtubeUrl: null,
      youtubeReviewStatus: 'pending',
    });
    expect(store).toHaveLength(5);
  });

  it('등록은 경로의 teamId로만 소속을 정한다', async () => {
    const { service, setlist } = createService();

    await service.create(2n, validDto);

    expect(setlist.create).toHaveBeenCalledWith({
      data: { teamId: 2n, title: '자처', singer: '한로로' },
    });
  });

  it('존재하지 않는 팀이면 404이고 아무것도 쓰지 않는다', async () => {
    const { service, setlist, store } = createService();

    await expect(service.create(999n, validDto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(setlist.create).not.toHaveBeenCalled();
    expect(store).toHaveLength(4);
  });

  it('중복 검사보다 먼저 팀 행을 FOR NO KEY UPDATE로 잠근다', async () => {
    const { service, $queryRaw, setlist } = createService();

    await service.create(1n, validDto);

    // 동시 요청이 중복 검사를 함께 통과하지 않으려면 잠금이 먼저여야 한다
    expect($queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      setlist.findMany.mock.invocationCallOrder[0],
    );

    const [strings, teamId] = $queryRaw.mock.calls[0];
    expect(strings.join('?')).toContain('FOR NO KEY UPDATE');
    expect(strings.join('?')).toContain('"Line Up"');
    expect(teamId).toBe(1n);
  });

  it('같은 팀에 같은 제목+가수면 409로 거부하고 등록하지 않는다', async () => {
    const { service, setlist, store } = createService();

    await expect(
      service.create(1n, { title: 'Butterfly', singer: '러브홀릭스' }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(setlist.create).not.toHaveBeenCalled();
    expect(store).toHaveLength(4);
  });

  it('대소문자·앞뒤 공백·자모 분리만 다른 값도 중복으로 본다', async () => {
    const { service } = createService();

    // DTO가 trim한 뒤에도 남는 차이들 — 눈에 같아 보이면 중복이다
    await expect(
      service.create(1n, { title: 'BUTTERFLY', singer: '러브홀릭스' }),
    ).rejects.toBeInstanceOf(ConflictException);

    await expect(
      service.create(1n, {
        title: 'Butterfly',
        singer: '러브홀릭스'.normalize('NFD'),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('다른 팀의 같은 곡은 중복이 아니다 (판정 범위는 팀 내부)', async () => {
    const { service } = createService();

    // 실데이터의 "Butterfly"도 팀 1·2에 하나씩 있다
    const created = await service.create(3n, {
      title: 'Butterfly',
      singer: '러브홀릭스',
    });

    expect(created.teamId).toBe('3');
  });

  it('같은 팀이라도 가수가 다르면 등록된다', async () => {
    const { service } = createService();

    const created = await service.create(1n, {
      title: 'Butterfly',
      singer: '전영호',
    });

    expect(created.title).toBe('Butterfly');
  });

  it('PK 충돌(P2002)은 500이 아니라 409로 나간다', async () => {
    // §11에서 실제로 났던 사고: id 시퀀스가 기존 데이터보다 뒤처져
    // nextval이 이미 쓰인 id를 돌려줘 PK가 터졌다.
    const { service, setlist } = createService();
    setlist.create.mockRejectedValueOnce(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
    );

    await expect(service.create(1n, validDto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('FK 위반(P2003)은 500이 아니라 404로 나간다 (방어용 매핑)', async () => {
    const { service, setlist } = createService();
    setlist.create.mockRejectedValueOnce(
      Object.assign(new Error('Foreign key constraint failed'), {
        code: 'P2003',
      }),
    );

    await expect(service.create(1n, validDto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('잠금·중복 검사·삽입이 하나의 트랜잭션 안에서 일어난다', async () => {
    const { service, $transaction } = createService();

    await service.create(1n, validDto);

    expect($transaction).toHaveBeenCalledOnce();
  });
});

describe('SongsService.update (F009)', () => {
  it('제목만 수정하면 가수는 그대로다', async () => {
    const { service } = createService();

    const updated = await service.update(1n, { title: '자처' });

    expect(updated).toMatchObject({
      id: '1',
      teamId: '1',
      title: '자처',
      singer: '한로로',
    });
  });

  it('앨범 커버와 유튜브 링크를 초기화하지 않는다', async () => {
    const { service, setlist } = createService();

    // 2번 곡은 승인된 유튜브 링크를 갖고 있다 — 제목을 고쳤다고 잃으면 안 된다
    const updated = await service.update(2n, { title: 'Congratulations (Live)' });

    expect(updated.albumCoverUrl).toBe('https://cdn.example/b.jpg');
    expect(updated.youtubeUrl).toBe('https://www.youtube.com/watch?v=BTo-I-gCAxk');
    // work02-6b: 제목이 실제로 바뀌었으므로 검토 상태만 pending으로 되돌아간다.
    // URL은 그대로다 — 배치 대상 조건이 `url IS NULL AND pending`이라 재검색도 일어나지 않는다.
    expect(setlist.update).toHaveBeenCalledWith({
      where: { id: 2n },
      data: { title: 'Congratulations (Live)', youtubeReviewStatus: 'pending' },
    });
    expect(updated.youtubeReviewStatus).toBe('pending');
  });

  it('teamId를 건드리지 않는다 (곡의 팀 이동 불가)', async () => {
    const { service, setlist } = createService();

    await service.update(1n, { title: '자처', singer: '한로로' });

    const [args] = setlist.update.mock.calls[0];
    expect(args.data).not.toHaveProperty('teamId');
  });

  it('같은 값으로 다시 보내면 409가 아니라 200이다 (자기 자신 제외)', async () => {
    const { service } = createService();

    const updated = await service.update(3n, {
      title: 'Butterfly',
      singer: '러브홀릭스',
    });

    expect(updated).toMatchObject({ id: '3', title: 'Butterfly' });
  });

  it('대소문자만 바꾸는 수정도 통과한다 (자기 자신은 비교 대상이 아니다)', async () => {
    const { service } = createService();

    const updated = await service.update(3n, { title: 'butterfly' });

    expect(updated.title).toBe('butterfly');
  });

  it('같은 팀의 다른 곡과 겹치면 409로 거부한다', async () => {
    const { service, setlist } = createService();

    await expect(
      service.update(1n, { title: 'Butterfly', singer: '러브홀릭스' }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(setlist.update).not.toHaveBeenCalled();
  });

  it('중복 판정은 수정 후 값 기준이다 (보내지 않은 필드는 기존 값)', async () => {
    const { service } = createService([
      ...initialRows(),
      // 팀 1에 가수만 다른 "0+0"을 추가해 둔다
      {
        id: 5n,
        teamId: 1n,
        title: '0+0',
        singer: '다른가수',
        albumCoverUrl: null,
        youtubeUrl: null,
        youtubeReviewStatus: 'pending',
      },
    ]);

    // 5번의 가수만 '한로로'로 바꾸면 제목은 기존 값이 유지되어 1번과 겹친다
    await expect(service.update(5n, { singer: '한로로' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('다른 팀의 같은 곡과는 겹쳐도 된다', async () => {
    const { service } = createService();

    // 4번(팀 2)을 팀 1의 3번과 같은 값으로 바꿔도 팀이 다르므로 통과한다
    const updated = await service.update(4n, { singer: '러브홀릭스' });

    expect(updated).toMatchObject({ id: '4', teamId: '2', singer: '러브홀릭스' });
  });

  it('수정도 팀 행을 잠근 뒤에 중복을 검사한다', async () => {
    const { service, $queryRaw } = createService();

    await service.update(1n, { title: '자처' });

    expect($queryRaw).toHaveBeenCalledOnce();
    expect($queryRaw.mock.calls[0][1]).toBe(1n);
  });

  it('teamId가 NULL인 곡은 중복 검사를 건너뛴다', async () => {
    const { service, $queryRaw } = createService([
      {
        id: 9n,
        teamId: null,
        title: '미배정곡',
        singer: '아무개',
        albumCoverUrl: null,
        youtubeUrl: null,
        youtubeReviewStatus: 'pending',
      },
    ]);

    const updated = await service.update(9n, { title: '이름바꾼곡' });

    expect(updated).toMatchObject({ id: '9', teamId: null, title: '이름바꾼곡' });
    expect($queryRaw).not.toHaveBeenCalled();
  });

  it('없는 id면 404', async () => {
    const { service } = createService();

    await expect(service.update(999n, { title: '아무개' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('본문이 비어 있으면 400이고 트랜잭션을 열지 않는다', async () => {
    const { service, $transaction } = createService();

    await expect(service.update(1n, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect($transaction).not.toHaveBeenCalled();
  });

  it('갱신 직전에 행이 사라지면(P2025) 404로 나간다', async () => {
    const { service, setlist } = createService();
    setlist.update.mockRejectedValueOnce(
      Object.assign(new Error('Record to update not found.'), { code: 'P2025' }),
    );

    await expect(service.update(1n, { title: '자처' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('응답이 BigInt 없이 JSON으로 직렬화된다', async () => {
    const { service } = createService();

    const updated = await service.update(1n, { title: '자처' });

    expect(() => JSON.stringify(updated)).not.toThrow();
  });
});

/**
 * work02-6b, 조건 D(2).
 *
 * §14가 남긴 결함: 곡을 "다른 곡으로 교체"해도 `approved`가 남고, approved는 배치 재검색
 * 대상이 아니라 **이전 곡의 영상이 승인 상태로 영원히 남았다.** 실제 변경일 때만 상태를
 * 되돌리고 추천 이력을 무효화해 해소한다. URL은 §12 판단대로 유지한다.
 */
describe('SongsService.update — 검토 상태 재설정 (work02-6b)', () => {
  it('제목이 실제로 바뀌면 상태를 pending으로 되돌리고 추천 이력을 무효화한다', async () => {
    const { service, youtubeSearchAttempt } = createService();

    const updated = await service.update(2n, { title: '다른 곡' });

    expect(updated.youtubeReviewStatus).toBe('pending');
    // URL은 잃지 않는다 — 사람 검토와 쿼터가 든 자산이다.
    expect(updated.youtubeUrl).toBe('https://www.youtube.com/watch?v=BTo-I-gCAxk');
    expect(youtubeSearchAttempt.updateMany).toHaveBeenCalledWith({
      where: { songId: 2n, invalidatedAt: null },
      data: expect.objectContaining({ invalidatedAt: expect.any(Date) }),
    });
  });

  it('가수가 실제로 바뀌어도 마찬가지다', async () => {
    const { service, youtubeSearchAttempt } = createService();

    const updated = await service.update(2n, { singer: '다른 가수' });

    expect(updated.youtubeReviewStatus).toBe('pending');
    expect(youtubeSearchAttempt.updateMany).toHaveBeenCalled();
  });

  it('같은 값으로 다시 보내면 상태를 건드리지 않는다', async () => {
    // 저장값도 그대로이므로 "다른 곡이 됐다"고 볼 근거가 없다.
    const { service, setlist, youtubeSearchAttempt } = createService();

    const updated = await service.update(2n, {
      title: 'Congratulations',
      singer: 'Day6',
    });

    expect(updated.youtubeReviewStatus).toBe('approved');
    expect(setlist.update).toHaveBeenCalledWith({
      where: { id: 2n },
      data: { title: 'Congratulations', singer: 'Day6' },
    });
    expect(youtubeSearchAttempt.updateMany).not.toHaveBeenCalled();
  });

  it('대소문자·공백·자모 분리만 다른 수정은 표기 교정이라 상태를 건드리지 않는다', async () => {
    // 중복 판정(§12)과 **같은 정규화 규칙**을 쓴다. 저장값은 바뀌지만 곡이 바뀐 것은 아니다.
    const { service, youtubeSearchAttempt } = createService();

    const updated = await service.update(2n, { title: '  congratulations  ' });

    expect(updated.title).toBe('  congratulations  ');
    expect(updated.youtubeReviewStatus).toBe('approved');
    expect(youtubeSearchAttempt.updateMany).not.toHaveBeenCalled();
  });

  it('이미 pending인 곡도 실제 변경이면 이력을 무효화한다 (no_results·연속 실패 해제)', async () => {
    // 상태는 그대로 pending이지만, 검색어가 달라졌으니 이전 "결과 0건"·실패 기록은 의미가 없다.
    const { service, youtubeSearchAttempt } = createService();

    const updated = await service.update(1n, { title: '완전히 다른 제목' });

    expect(updated.youtubeReviewStatus).toBe('pending');
    expect(youtubeSearchAttempt.updateMany).toHaveBeenCalled();
  });

  it('잠금 순서를 지킨다 — 팀 행 잠금이 추천 무효화보다 먼저다', async () => {
    // common/lock-order.ts: Line Up → Setlist → YoutubeSearchAttempt
    const { service, $queryRaw, youtubeSearchAttempt } = createService();

    await service.update(2n, { title: '다른 곡' });

    expect($queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      youtubeSearchAttempt.findMany.mock.invocationCallOrder[0],
    );
  });
});
