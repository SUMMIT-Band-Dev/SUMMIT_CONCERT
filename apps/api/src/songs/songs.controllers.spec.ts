import 'reflect-metadata';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { SongsController } from './songs.controller.js';
import { TeamSongsController } from './team-songs.controller.js';
import { IS_PUBLIC_KEY } from '../auth/public.decorator.js';
import type { SongsService } from './songs.service.js';

describe('곡 컨트롤러 — 전역 Guard 회귀', () => {
  // 전역 APP_GUARD는 @Public()이 붙은 곳만 열어 준다. 실수로 하나라도 붙으면
  // 인증 없이 곡 데이터를 쓸 수 있게 되므로, 메타데이터가 없다는 것을 고정한다.
  it.each([
    ['TeamSongsController', TeamSongsController],
    ['SongsController', SongsController],
  ])('%s 클래스에 @Public()이 붙어 있지 않다', (_name, controller) => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, controller)).toBeUndefined();
  });

  it.each([
    ['findAllByTeam', TeamSongsController.prototype.findAllByTeam],
    ['create', TeamSongsController.prototype.create],
    ['update', SongsController.prototype.update],
  ])('%s 핸들러에 @Public()이 붙어 있지 않다', (_name, handler) => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBeUndefined();
  });
});

describe('곡 컨트롤러 — 라우트 선언', () => {
  it('조회·등록은 팀 하위 경로, 수정은 평탄한 경로다', () => {
    expect(Reflect.getMetadata(PATH_METADATA, TeamSongsController)).toBe(
      'teams/:teamId/songs',
    );
    expect(Reflect.getMetadata(PATH_METADATA, SongsController)).toBe('songs');

    expect(
      Reflect.getMetadata(PATH_METADATA, TeamSongsController.prototype.findAllByTeam),
    ).toBe('/');
    expect(
      Reflect.getMetadata(PATH_METADATA, TeamSongsController.prototype.create),
    ).toBe('/');
    expect(Reflect.getMetadata(PATH_METADATA, SongsController.prototype.update)).toBe(
      ':id',
    );
  });

  it('메서드가 의도대로 붙어 있다', () => {
    expect(
      Reflect.getMetadata(METHOD_METADATA, TeamSongsController.prototype.findAllByTeam),
    ).toBe(RequestMethod.GET);
    expect(
      Reflect.getMetadata(METHOD_METADATA, TeamSongsController.prototype.create),
    ).toBe(RequestMethod.POST);
    expect(
      Reflect.getMetadata(METHOD_METADATA, SongsController.prototype.update),
    ).toBe(RequestMethod.PATCH);
  });
});

describe('곡 컨트롤러 — 서비스 위임', () => {
  const createControllers = () => {
    const service = {
      findAllByTeam: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    };

    return {
      teamSongs: new TeamSongsController(service as unknown as SongsService),
      songs: new SongsController(service as unknown as SongsService),
      service,
    };
  };

  it('조회는 파이프가 변환한 BigInt teamId를 그대로 넘긴다', async () => {
    const { teamSongs, service } = createControllers();

    await teamSongs.findAllByTeam(15n);

    expect(service.findAllByTeam).toHaveBeenCalledWith(15n);
  });

  it('등록은 경로의 teamId와 본문을 함께 넘긴다', async () => {
    const { teamSongs, service } = createControllers();

    await teamSongs.create(15n, { title: '보수공사', singer: '한로로' });

    expect(service.create).toHaveBeenCalledWith(15n, {
      title: '보수공사',
      singer: '한로로',
    });
  });

  it('수정은 곡 id와 본문만 넘긴다 (팀은 관여하지 않는다)', async () => {
    const { songs, service } = createControllers();

    await songs.update(64n, { title: '보수공사' });

    expect(service.update).toHaveBeenCalledWith(64n, { title: '보수공사' });
  });
});
