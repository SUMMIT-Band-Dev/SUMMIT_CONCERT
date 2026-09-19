import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

// 관리자 페이지는 한 번 앉아서 학기 단위 데이터를 몰아서 입력하는 용도라
// 너무 짧으면 입력 도중에 로그인이 풀린다. 반대로 MVP에는 refresh 토큰도
// 서버측 토큰 무효화도 없어서, 이 값이 곧 "토큰이 유출됐을 때 살아있는 시간"이다.
// 둘 사이 타협점으로 2시간을 기본값으로 둔다 (.env의 JWT_EXPIRES_IN으로 덮어쓸 수 있음).
const DEFAULT_EXPIRES_IN = '2h';

// 256비트 미만의 시크릿은 HS256 서명의 의미를 약화시킨다.
// base64url 48바이트(=64자)를 권장하되, 최소선만 강제한다.
const MIN_SECRET_LENGTH = 32;

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // 시크릿이 없거나 약하면 기동 자체를 실패시킨다.
        // 개발 편의를 위한 기본 시크릿을 두면 그대로 배포될 위험이 있다.
        const secret = config.getOrThrow<string>('JWT_SECRET');
        if (secret.length < MIN_SECRET_LENGTH) {
          throw new Error(
            `JWT_SECRET이 너무 짧습니다 (${secret.length}자). ` +
              `최소 ${MIN_SECRET_LENGTH}자 이상으로 설정하세요.`,
          );
        }

        return {
          secret,
          signOptions: { expiresIn: parseExpiresIn(config.get<string>('JWT_EXPIRES_IN')) },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    // 전역 Guard. 기본값을 "인증 필요"로 두고 @Public()으로만 여는 fail-closed 구조.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [PasswordService],
})
export class AuthModule {}

/**
 * `JWT_EXPIRES_IN` 값을 검증한다.
 * jsonwebtoken은 잘못된 형식을 "서명 시점"에야 에러로 알려주기 때문에,
 * 오타가 첫 로그인 때까지 숨어 있지 않도록 기동 시점에 형식을 확인한다.
 */
function parseExpiresIn(raw: string | undefined): JwtSignOptions['expiresIn'] {
  const value = raw?.trim() || DEFAULT_EXPIRES_IN;

  // 숫자만 오면 초 단위, 그 외에는 ms 라이브러리가 해석하는 단위 접미사
  if (!/^\d+\s*(ms|s|m|h|d|w|y)?$/i.test(value)) {
    throw new Error(
      `JWT_EXPIRES_IN 형식이 올바르지 않습니다: "${value}". 예) 2h, 30m, 7d, 3600`,
    );
  }

  // 정규식으로 형식을 확인했으므로 ms 라이브러리의 StringValue 타입으로 단언한다.
  return value as JwtSignOptions['expiresIn'];
}
