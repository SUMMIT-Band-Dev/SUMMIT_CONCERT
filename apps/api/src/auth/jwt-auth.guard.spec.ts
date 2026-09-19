import 'reflect-metadata';
import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it } from 'vitest';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { Public } from './public.decorator.js';
import type { AuthenticatedRequest, JwtPayload } from './jwt-payload.js';

const TEST_SECRET = 'test-secret-for-unit-tests-only-not-used-anywhere-else';

class ProtectedController {
  handler(): void {}
}

@Public()
class PublicController {
  handler(): void {}
}

/** 헤더와 대상 핸들러만 갈아끼우는 ExecutionContext 대역 */
function createContext(
  authorization: string | undefined,
  target: new () => { handler: () => void } = ProtectedController,
): { context: ExecutionContext; request: AuthenticatedRequest } {
  const request = { headers: { authorization } } as unknown as AuthenticatedRequest;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => target.prototype.handler,
    getClass: () => target,
  } as unknown as ExecutionContext;

  return { context, request };
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: JwtService;

  beforeEach(() => {
    jwtService = new JwtService({
      secret: TEST_SECRET,
      signOptions: { expiresIn: '2h' },
    });
    guard = new JwtAuthGuard(jwtService, new Reflector());
  });

  it('토큰이 없으면 401로 막는다', async () => {
    const { context } = createContext(undefined);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('유효한 Bearer 토큰이면 통과시키고 요청에 관리자 정보를 실어 준다', async () => {
    const payload: JwtPayload = { sub: '1' };
    const token = jwtService.sign(payload);
    const { context, request } = createContext(`Bearer ${token}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.admin?.sub).toBe('1');
  });

  it('다른 시크릿으로 서명된 토큰은 막는다', async () => {
    const forged = new JwtService({ secret: 'some-other-secret-value-entirely' }).sign({
      sub: '1',
    });
    const { context } = createContext(`Bearer ${forged}`);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('만료된 토큰은 막는다', async () => {
    const expired = jwtService.sign({ sub: '1' }, { expiresIn: '-1s' });
    const { context } = createContext(`Bearer ${expired}`);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('Bearer 스킴이 아니면 막는다', async () => {
    const token = jwtService.sign({ sub: '1' });
    const { context } = createContext(`Basic ${token}`);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('실패 메시지는 원인(없음/만료/위조)을 구분해서 알려주지 않는다', async () => {
    const cases = [undefined, `Bearer ${jwtService.sign({ sub: '1' }, { expiresIn: '-1s' })}`];
    const messages: string[] = [];

    for (const authorization of cases) {
      try {
        await guard.canActivate(createContext(authorization).context);
      } catch (error) {
        messages.push((error as UnauthorizedException).message);
      }
    }

    expect(messages).toHaveLength(2);
    expect(new Set(messages).size).toBe(1);
  });

  it('@Public()이 붙은 라우트는 토큰 없이도 통과시킨다', async () => {
    const { context } = createContext(undefined, PublicController);

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
