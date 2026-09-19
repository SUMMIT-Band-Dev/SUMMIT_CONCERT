import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { JwtPayload } from './jwt-payload.js';

// 프로덕션 DB에 시험용 계정을 만들지 않고 로그인 성공 경로까지 검증하기 위해
// PrismaService만 대역으로 두고, 해싱/서명은 실제 구현을 그대로 쓴다.
const TEST_SECRET = 'test-secret-for-unit-tests-only-not-used-anywhere-else';
const USERNAME = 'summit-admin';
const PASSWORD = 'correct horse battery staple';

describe('AuthService', () => {
  let passwords: PasswordService;
  let jwtService: JwtService;
  let passwordHash: string;

  beforeAll(async () => {
    passwords = new PasswordService();
    await passwords.onModuleInit();
    jwtService = new JwtService({
      secret: TEST_SECRET,
      signOptions: { expiresIn: '2h' },
    });
    passwordHash = await passwords.hash(PASSWORD);
  });

  /** findUnique가 주어진 레코드를 반환하도록 한 PrismaService 대역 */
  const createService = (record: { id: bigint; username: string; passwordHash: string } | null) => {
    const findUnique = vi.fn().mockResolvedValue(record);
    const prisma = { adminUser: { findUnique } } as unknown as PrismaService;
    return { service: new AuthService(prisma, jwtService, passwords), findUnique };
  };

  const admin = () => ({ id: 1n, username: USERNAME, passwordHash });

  it('올바른 자격증명이면 검증 가능한 액세스 토큰을 발급한다', async () => {
    const { service } = createService(admin());

    const { accessToken } = await service.login({ username: USERNAME, password: PASSWORD });

    const payload = jwtService.verify<JwtPayload>(accessToken, { secret: TEST_SECRET });
    expect(payload.sub).toBe('1');
  });

  it('토큰 페이로드에는 sub와 표준 클레임 외에 아무것도 담지 않는다', async () => {
    const { service } = createService(admin());

    const { accessToken } = await service.login({ username: USERNAME, password: PASSWORD });

    const payload = jwtService.verify<Record<string, unknown>>(accessToken, {
      secret: TEST_SECRET,
    });
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'sub']);
  });

  it('비밀번호가 틀리면 401로 막는다', async () => {
    const { service } = createService(admin());

    await expect(
      service.login({ username: USERNAME, password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('없는 계정과 틀린 비밀번호의 에러 메시지가 동일하다 (계정 존재 여부 비노출)', async () => {
    const wrongPassword = createService(admin());
    const noAccount = createService(null);

    const messageOf = async (promise: Promise<unknown>): Promise<string> => {
      try {
        await promise;
        throw new Error('401이 발생해야 한다');
      } catch (error) {
        return (error as UnauthorizedException).message;
      }
    };

    const fromWrongPassword = await messageOf(
      wrongPassword.service.login({ username: USERNAME, password: 'wrong-password' }),
    );
    const fromNoAccount = await messageOf(
      noAccount.service.login({ username: 'ghost', password: PASSWORD }),
    );

    expect(fromNoAccount).toBe(fromWrongPassword);
    expect(fromNoAccount).not.toMatch(/아이디가|비밀번호가 틀/);
  });

  it('없는 계정이어도 해시 검증 비용을 치르고 나서 실패시킨다', async () => {
    const { service } = createService(null);
    const burn = vi.spyOn(passwords, 'burnVerifyCost');

    await expect(
      service.login({ username: 'ghost', password: PASSWORD }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(burn).toHaveBeenCalledOnce();

    burn.mockRestore();
  });

  it('findAdminById는 BigInt id를 문자열로 바꿔 반환하고 해시는 빼고 준다', async () => {
    const { service, findUnique } = createService(admin());

    const profile = await service.findAdminById('1');

    expect(findUnique).toHaveBeenCalledWith({ where: { id: 1n } });
    expect(profile).toEqual({ id: '1', username: USERNAME });
  });

  it('토큰은 유효하지만 계정이 사라졌으면 401로 막는다', async () => {
    const { service } = createService(null);

    await expect(service.findAdminById('1')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('PasswordService', () => {
  it('평문을 저장하지 않고 argon2id 해시로 만든다', async () => {
    const passwords = new PasswordService();
    await passwords.onModuleInit();

    const hashed = await passwords.hash(PASSWORD);

    expect(hashed).not.toContain(PASSWORD);
    expect(hashed.startsWith('$argon2id$')).toBe(true);
    expect(hashed).toContain('m=19456,t=2,p=1');
    expect(await passwords.verify(hashed, PASSWORD)).toBe(true);
    expect(await passwords.verify(hashed, 'wrong')).toBe(false);
  });

  it('같은 비밀번호라도 매번 다른 해시가 나온다 (salt)', async () => {
    const passwords = new PasswordService();
    await passwords.onModuleInit();

    expect(await passwords.hash(PASSWORD)).not.toBe(await passwords.hash(PASSWORD));
  });

  it('손상된 해시는 예외 대신 검증 실패로 처리한다', async () => {
    const passwords = new PasswordService();
    await passwords.onModuleInit();

    expect(await passwords.verify('not-a-valid-hash', PASSWORD)).toBe(false);
  });
});
