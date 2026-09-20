import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamCardImageService } from './team-card-image.service.js';
import {
  StorageRequestError,
  StorageTimeoutError,
  type StorageClient,
} from '../storage/storage.client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { UploadedImageFile } from './card-image-upload.interceptor.js';

const TEAM_ID = 21n;
const PUBLIC_PREFIX = 'https://example-ref.supabase.co/storage/v1/object/public/team-cards';

const jpegFile = (): UploadedImageFile => ({
  buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
  size: 6,
});

const teamRow = (cardImageUrl: string | null = null) => ({
  id: TEAM_ID,
  teamName: '8C8',
  day: 'day1',
  performanceOrder: 1,
  cardImageUrl,
});

interface Harness {
  service: TeamCardImageService;
  storage: {
    upload: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    getPublicUrl: ReturnType<typeof vi.fn>;
    getBucket: ReturnType<typeof vi.fn>;
    bucketName: string;
  };
  findUnique: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  /** 업로드에 쓰인 객체 경로 (uuid가 들어가 있어 호출 후에만 알 수 있다) */
  uploadedPath: () => string;
}

function createHarness(): Harness {
  const storage = {
    bucketName: 'team-cards',
    // 인자 타입을 적어 두지 않으면 mock.calls가 빈 튜플([])로 추론돼 호출 인자를 꺼낼 수 없다
    upload: vi.fn(async (_input: { path: string }) => undefined),
    remove: vi.fn(async () => undefined),
    getPublicUrl: vi.fn((path: string) => `${PUBLIC_PREFIX}/${path}`),
    getBucket: vi.fn(),
  };

  const findUnique = vi.fn(async () => teamRow());
  const update = vi.fn(async (args: { data: { cardImageUrl: string } }) =>
    teamRow(args.data.cardImageUrl),
  );

  const prisma = { lineUp: { findUnique, update } } as unknown as PrismaService;

  return {
    service: new TeamCardImageService(prisma, storage as unknown as StorageClient),
    storage,
    findUnique,
    update,
    uploadedPath: () =>
      (storage.upload.mock.calls[0][0] as { path: string }).path,
  };
}

let errorLogs: string[];
let warnLogs: string[];

beforeEach(() => {
  errorLogs = [];
  warnLogs = [];
  vi.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
    errorLogs.push(String(message));
  });
  vi.spyOn(Logger.prototype, 'warn').mockImplementation((message: unknown) => {
    warnLogs.push(String(message));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TeamCardImageService — 정상 경로', () => {
  it('업로드하고 image_src를 공개 URL로 갱신한다', async () => {
    const h = createHarness();

    const response = await h.service.replace(TEAM_ID, jpegFile());

    expect(h.storage.upload).toHaveBeenCalledTimes(1);
    expect(h.update).toHaveBeenCalledWith({
      where: { id: TEAM_ID },
      data: { cardImageUrl: `${PUBLIC_PREFIX}/${h.uploadedPath()}` },
    });
    expect(response.cardImageUrl).toBe(`${PUBLIC_PREFIX}/${h.uploadedPath()}`);
    expect(h.storage.remove).not.toHaveBeenCalled();
  });

  it('id를 문자열로 직렬화해서 돌려준다', async () => {
    const h = createHarness();

    const response = await h.service.replace(TEAM_ID, jpegFile());

    expect(response.id).toBe('21');
    expect(typeof response.id).toBe('string');
  });

  it('경로는 팀 id 하위이고 확장자는 매직바이트 판별 결과를 따른다', async () => {
    const h = createHarness();

    await h.service.replace(TEAM_ID, jpegFile());

    expect(h.uploadedPath()).toMatch(/^21\/[0-9a-f-]{36}\.jpg$/);
    expect(h.storage.upload.mock.calls[0][0]).toMatchObject({
      contentType: 'image/jpeg',
      cacheControlSeconds: 31_536_000,
    });
  });

  it('업로드마다 새 경로를 만든다(덮어쓰기 금지)', async () => {
    const h = createHarness();

    await h.service.replace(TEAM_ID, jpegFile());
    await h.service.replace(TEAM_ID, jpegFile());

    const [first, second] = h.storage.upload.mock.calls.map(
      (call) => (call[0] as { path: string }).path,
    );
    expect(first).not.toBe(second);
  });

  it('이전 객체를 삭제하지 않는다(보존 정책)', async () => {
    const h = createHarness();
    h.findUnique.mockResolvedValue(teamRow('/day1-team1.png'));

    await h.service.replace(TEAM_ID, jpegFile());

    // 레거시 상대경로는 Storage 객체가 아니다. 삭제 경로가 아예 없어야 한다.
    expect(h.storage.remove).not.toHaveBeenCalled();
  });
});

describe('TeamCardImageService — 입력 거부', () => {
  it('파일이 없으면 400이고 저장소를 부르지 않는다', async () => {
    const h = createHarness();

    await expect(h.service.replace(TEAM_ID, undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(h.storage.upload).not.toHaveBeenCalled();
  });

  it('0바이트 파일은 400이다', async () => {
    const h = createHarness();

    await expect(
      h.service.replace(TEAM_ID, { buffer: Buffer.alloc(0), size: 0 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('SVG는 400이고 저장소를 부르지 않는다', async () => {
    const h = createHarness();

    await expect(
      h.service.replace(TEAM_ID, {
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
        size: 40,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(h.storage.upload).not.toHaveBeenCalled();
  });

  it('없는 팀은 404이고 업로드하지 않는다', async () => {
    const h = createHarness();
    h.findUnique.mockResolvedValue(null);

    await expect(h.service.replace(TEAM_ID, jpegFile())).rejects.toBeInstanceOf(
      NotFoundException,
    );
    // 존재 확인이 업로드보다 먼저다 — 없는 팀 때문에 고아 객체가 생기면 안 된다
    expect(h.storage.upload).not.toHaveBeenCalled();
  });
});

describe('TeamCardImageService — 저장소 실패', () => {
  it('업로드 타임아웃은 504이고 객체를 지우지 않는다', async () => {
    const h = createHarness();
    h.storage.upload.mockRejectedValue(new StorageTimeoutError('timeout'));

    await expect(h.service.replace(TEAM_ID, jpegFile())).rejects.toBeInstanceOf(
      GatewayTimeoutException,
    );
    // 타임아웃은 "실패"가 아니라 "결과를 모름"이다. 지우면 성공한 업로드를 지울 수 있다.
    expect(h.storage.remove).not.toHaveBeenCalled();
    expect(errorLogs.join('\n')).toMatch(/남아 있을 수 있습니다/);
    expect(h.update).not.toHaveBeenCalled();
  });

  it('그 외 저장소 실패는 502다', async () => {
    const h = createHarness();
    h.storage.upload.mockRejectedValue(
      new StorageRequestError('failed', 500),
    );

    await expect(h.service.replace(TEAM_ID, jpegFile())).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(h.update).not.toHaveBeenCalled();
  });
});

describe('TeamCardImageService — 보상 삭제', () => {
  it('P2025(미반영 확정)면 방금 올린 객체를 지우고 404를 낸다', async () => {
    const h = createHarness();
    h.update.mockRejectedValue({ code: 'P2025' });

    await expect(h.service.replace(TEAM_ID, jpegFile())).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(h.storage.remove).toHaveBeenCalledWith([h.uploadedPath()]);
    // 확정된 경우에는 재조회하지 않는다 (존재 확인 1회뿐)
    expect(h.findUnique).toHaveBeenCalledTimes(1);
  });

  it('커밋 불명 오류인데 재조회 결과가 방금 올린 URL이면 지우지 않는다', async () => {
    const h = createHarness();
    const failure = new Error('connection terminated unexpectedly');
    h.update.mockRejectedValue(failure);
    h.findUnique
      .mockResolvedValueOnce(teamRow())
      .mockImplementationOnce(async () =>
        teamRow(`${PUBLIC_PREFIX}/${h.uploadedPath()}`),
      );

    await expect(h.service.replace(TEAM_ID, jpegFile())).rejects.toBe(failure);

    // 실제로는 커밋된 것이다 — 지웠다면 공개 페이지에 깨진 이미지가 뜬다
    expect(h.storage.remove).not.toHaveBeenCalled();
    expect(warnLogs.join('\n')).toMatch(/반영은 완료/);
  });

  it('커밋 불명 오류인데 재조회가 실패하면 지우지 않고 경로만 남긴다', async () => {
    const h = createHarness();
    const failure = new Error('connection terminated unexpectedly');
    h.update.mockRejectedValue(failure);
    h.findUnique
      .mockResolvedValueOnce(teamRow())
      .mockRejectedValueOnce(new Error('db unreachable'));

    await expect(h.service.replace(TEAM_ID, jpegFile())).rejects.toBe(failure);

    // 판단 근거가 없으면 살아 있는 이미지를 지우는 쪽보다 고아를 남기는 쪽이 낫다
    expect(h.storage.remove).not.toHaveBeenCalled();
    expect(errorLogs.join('\n')).toContain(h.uploadedPath());
  });

  it('커밋 불명 오류인데 재조회 결과가 다른 URL이면 지운다', async () => {
    const h = createHarness();
    const failure = new Error('connection terminated unexpectedly');
    h.update.mockRejectedValue(failure);
    h.findUnique
      .mockResolvedValueOnce(teamRow())
      .mockResolvedValueOnce(teamRow(`${PUBLIC_PREFIX}/21/other.jpg`));

    await expect(h.service.replace(TEAM_ID, jpegFile())).rejects.toBe(failure);

    // 동시 업로드에서 밀린 경우다 — 아무도 참조하지 않으므로 지워도 안전하다
    expect(h.storage.remove).toHaveBeenCalledWith([h.uploadedPath()]);
  });

  it('커밋 불명 오류인데 행이 사라졌으면 지운다', async () => {
    const h = createHarness();
    const failure = new Error('connection terminated unexpectedly');
    h.update.mockRejectedValue(failure);
    h.findUnique.mockResolvedValueOnce(teamRow()).mockResolvedValueOnce(null);

    await expect(h.service.replace(TEAM_ID, jpegFile())).rejects.toBe(failure);
    expect(h.storage.remove).toHaveBeenCalledWith([h.uploadedPath()]);
  });

  it('보상 삭제가 실패해도 원래 오류가 그대로 올라간다', async () => {
    const h = createHarness();
    h.update.mockRejectedValue({ code: 'P2025' });
    h.storage.remove.mockRejectedValue(new StorageRequestError('nope'));

    // 삭제 실패로 원인이 덮이면 클라이언트가 전혀 다른 문제를 보게 된다
    await expect(h.service.replace(TEAM_ID, jpegFile())).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(errorLogs.join('\n')).toMatch(/고아 객체/);
  });

  it('로그에는 객체 경로만 남고 버퍼 내용은 남지 않는다', async () => {
    const h = createHarness();
    h.update.mockRejectedValue({ code: 'P2025' });
    h.storage.remove.mockRejectedValue(new StorageRequestError('nope'));

    await h.service.replace(TEAM_ID, jpegFile()).catch(() => undefined);

    const logged = [...errorLogs, ...warnLogs].join('\n');
    expect(logged).toContain(h.uploadedPath());
    expect(logged).not.toContain('Bearer');
    expect(logged).not.toContain('apikey');
  });
});
