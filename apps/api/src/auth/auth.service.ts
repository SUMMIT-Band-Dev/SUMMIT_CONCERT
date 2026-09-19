import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { PasswordService } from './password.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { JwtPayload } from './jwt-payload.js';

// 아이디가 틀렸는지 비밀번호가 틀렸는지 구분해서 알려주지 않는다.
// 구분해 주면 "이 아이디는 존재한다"는 정보를 흘리게 된다.
const INVALID_CREDENTIALS = '아이디 또는 비밀번호가 올바르지 않습니다.';

export interface LoginResult {
  accessToken: string;
}

export interface AdminProfile {
  /** AdminUser.id — DB는 int8(BigInt)이지만 JSON으로 실을 수 있도록 문자열로 변환 */
  id: string;
  username: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly passwords: PasswordService,
  ) {}

  /** 아이디/비밀번호를 검증하고 액세스 토큰을 발급한다 (PRD F001). */
  async login(dto: LoginDto): Promise<LoginResult> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { username: dto.username },
    });

    if (!admin) {
      // 계정이 없어도 해시 검증 비용을 동일하게 치르고 나서 같은 에러를 던진다.
      // 그냥 바로 던지면 응답 시간이 눈에 띄게 짧아져 계정 존재 여부가 드러난다.
      await this.passwords.burnVerifyCost(dto.password);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const matched = await this.passwords.verify(admin.passwordHash, dto.password);
    if (!matched) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const payload: JwtPayload = { sub: admin.id.toString() };
    return { accessToken: await this.jwtService.signAsync(payload) };
  }

  /**
   * 토큰의 `sub`로 관리자 정보를 다시 조회한다.
   * 토큰에 username을 담지 않으므로 여기서 DB를 한 번 읽는다 — 그 대신
   * 계정이 삭제/변경된 뒤에도 옛 정보가 응답되는 일이 없다.
   */
  async findAdminById(id: string): Promise<AdminProfile> {
    let adminId: bigint;
    try {
      adminId = BigInt(id);
    } catch {
      // 서명은 유효하지만 sub가 숫자가 아닌 경우(정상 경로에서는 발생하지 않음)
      throw new UnauthorizedException('인증이 필요합니다.');
    }

    const admin = await this.prisma.adminUser.findUnique({ where: { id: adminId } });
    if (!admin) {
      // 토큰 발급 후 계정이 삭제된 경우. 서명이 유효해도 접근을 허용하지 않는다.
      throw new UnauthorizedException('인증이 필요합니다.');
    }

    return { id: admin.id.toString(), username: admin.username };
  }
}
