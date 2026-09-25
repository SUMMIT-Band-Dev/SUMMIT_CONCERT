import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import type { AuthenticatedRequest, JwtPayload } from './jwt-payload.js';

// 토큰이 없든, 서명이 틀렸든, 만료됐든 클라이언트에는 같은 메시지를 준다.
// 어느 쪽이 문제인지 알려주는 것은 공격자에게만 도움이 된다.
const UNAUTHORIZED_MESSAGE = '인증이 필요합니다.';

/**
 * 관리자 라우트 접근 제어 (PRD F002).
 *
 * `GlobalGuard`(요청 제한 다음 단계)가 호출해 **전역 적용**한다. 즉 새로 추가되는
 * 라우트는 아무것도 하지 않아도 기본이 "인증 필요"이고, 공개가 필요한 쪽만
 * `@Public()`을 붙여 여는 구조다. 3~6단계에서 팀/곡/유튜브 API를 추가할 때
 * `@UseGuards`를 깜빡해서 쓰기 엔드포인트가 열린 채로 나가는 사고를 막기 위한 선택.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
    }

    try {
      // 시크릿/만료 검증은 JwtModule에 등록된 옵션을 그대로 사용한다.
      request.admin = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
    }

    return true;
  }
}

/** `Authorization: Bearer <token>` 헤더에서 토큰만 뽑아낸다. 형식이 다르면 undefined */
function extractBearerToken(header: string | undefined): string | undefined {
  const [scheme, token] = header?.split(' ') ?? [];
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}
