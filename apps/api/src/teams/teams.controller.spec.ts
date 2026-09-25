import 'reflect-metadata';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { TeamsController } from './teams.controller.js';
import { IS_PUBLIC_KEY } from '../auth/public.decorator.js';
import type { TeamsService } from './teams.service.js';

const handlers = ['findAll', 'create', 'reorder', 'update'] as const;

describe('TeamsController — 전역 Guard 회귀', () => {
  // 전역 APP_GUARD는 @Public()이 붙은 곳만 열어 준다. 실수로 하나라도 붙으면
  // 인증 없이 팀 데이터를 쓸 수 있게 되므로, 메타데이터가 없다는 것을 테스트로 고정한다.
  it('컨트롤러 클래스에 @Public()이 붙어 있지 않다', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, TeamsController)).toBeUndefined();
  });

  it.each(handlers)('%s 핸들러에 @Public()이 붙어 있지 않다', (handler) => {
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, TeamsController.prototype[handler]),
    ).toBeUndefined();
  });
});

describe('TeamsController — 라우트 선언', () => {
  it('reorder가 :id보다 먼저 선언돼 있다', () => {
    // Express는 먼저 선언된 라우트를 먼저 매칭한다. 순서가 뒤집히면
    // PATCH /teams/reorder가 :id로 잡혀 'reorder'를 id로 파싱하려다 400이 난다.
    const declared = Object.getOwnPropertyNames(TeamsController.prototype);

    expect(declared.indexOf('reorder')).toBeLessThan(declared.indexOf('update'));
  });

  it('경로와 메서드가 의도대로 붙어 있다', () => {
    const pathOf = (handler: (typeof handlers)[number]) =>
      Reflect.getMetadata(PATH_METADATA, TeamsController.prototype[handler]);
    const methodOf = (handler: (typeof handlers)[number]) =>
      Reflect.getMetadata(METHOD_METADATA, TeamsController.prototype[handler]);

    expect(Reflect.getMetadata(PATH_METADATA, TeamsController)).toBe('teams');

    expect(methodOf('findAll')).toBe(RequestMethod.GET);
    expect(methodOf('create')).toBe(RequestMethod.POST);
    expect(methodOf('reorder')).toBe(RequestMethod.PATCH);
    expect(methodOf('update')).toBe(RequestMethod.PATCH);

    expect(pathOf('reorder')).toBe('reorder');
    expect(pathOf('update')).toBe(':id');
  });
});

describe('TeamsController — 서비스 위임', () => {
  const createController = () => {
    const service = {
      findAll: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      reorder: vi.fn().mockResolvedValue([]),
    };

    return { controller: new TeamsController(service as unknown as TeamsService), service };
  };

  it('수정은 파이프가 변환한 BigInt id를 그대로 넘긴다', async () => {
    const { controller, service } = createController();

    await controller.update(15n, { teamName: '바뀐이름' });

    expect(service.update).toHaveBeenCalledWith(15n, { teamName: '바뀐이름' });
  });

  it('재정렬은 본문을 그대로 넘긴다', async () => {
    const { controller, service } = createController();
    const dto = { day: 'day1', teamIds: ['2', '1'] };

    await controller.reorder(dto);

    expect(service.reorder).toHaveBeenCalledWith(dto);
  });
});
