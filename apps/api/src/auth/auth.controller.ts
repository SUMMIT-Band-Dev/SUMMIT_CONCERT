import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService, type AdminProfile, type LoginResult } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { Public } from './public.decorator.js';
import { CurrentAdmin } from './current-admin.decorator.js';
import { LoginThrottle } from '../throttling/login-throttle.decorator.js';
import type { JwtPayload } from './jwt-payload.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** 관리자 로그인 (PRD F001). 토큰을 발급할 뿐 자원을 만들지 않으므로 201이 아니라 200. */
  @Public()
  @LoginThrottle()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.authService.login(dto);
  }

  /**
   * 전역 Guard(PRD F002)가 실제로 동작하는지 확인하는 보호 엔드포인트.
   * 프론트에서는 저장된 토큰이 아직 유효한지 확인하는 용도로도 쓸 수 있다.
   */
  @Get('me')
  me(@CurrentAdmin() admin: JwtPayload): Promise<AdminProfile> {
    return this.authService.findAdminById(admin.sub);
  }
}
