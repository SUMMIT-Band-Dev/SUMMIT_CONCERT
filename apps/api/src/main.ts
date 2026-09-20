import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { TRUST_PROXY_HOPS_ENV, parseTrustProxyHops } from './common/trust-proxy.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 프록시 뒤에서 클라이언트 IP(req.ip)를 어떻게 식별할지. 요청 제한(throttler)이 이 값으로 IP를 센다.
  // 기본 0(믿지 않음) — 프록시 없이 열려 있는데 켜 두면 X-Forwarded-For 위조로 제한을 피할 수 있다.
  const trustProxyHops = parseTrustProxyHops(
    app.get(ConfigService).get<string>(TRUST_PROXY_HOPS_ENV),
  );
  app.set('trust proxy', trustProxyHops > 0 ? trustProxyHops : false);

  // DTO 검증을 전역으로 건다.
  // whitelist/forbidNonWhitelisted: DTO에 선언하지 않은 필드가 섞여 들어오면 400으로 막는다
  //   — 3~6단계에서 팀/곡 수정 API를 만들 때 의도치 않은 컬럼이 덮어써지는 것을 방지
  // transform: 요청 본문을 DTO 클래스 인스턴스로 변환
  // stopAtFirstError: 한 필드에 대해 메시지를 하나만 내보낸다. 없으면 값이 비었을 때
  //   "비어 있음"과 "너무 김"이 함께 나와 로그인 화면에 모순된 안내가 뜬다
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
    }),
  );

  app.enableShutdownHooks();
  // Next.js 개발 서버가 3000을 점유하므로 기본값을 3001로 둔다
  await app.listen(process.env.PORT ?? 3001);
}
await bootstrap();
