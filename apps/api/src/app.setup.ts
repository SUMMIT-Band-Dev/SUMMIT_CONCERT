import { Logger, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { buildCorsOptions } from './common/cors.js';
import { HardenedExpressAdapter } from './common/hardened-express.adapter.js';
import { buildTrustProxyWarning } from './common/trust-proxy.js';

export interface HttpSetupOptions {
  /** 프록시 뒤에서 X-Forwarded-For를 몇 단계까지 믿을지. 0이면 믿지 않는다 */
  trustProxyHops: number;
  /** 크로스 오리진 요청을 허용할 오리진. 비어 있으면 전부 거부한다 */
  corsAllowedOrigins: string[];
}

/**
 * HTTP 어댑터. `NestFactory.create()`에 넘겨야 한다 — 어댑터는 앱을 만든 뒤에는 바꿀 수 없다.
 * 본문 파서 오류의 원본 메시지(요청 값 에코)가 응답으로 나가지 않게 한다.
 */
export function createHttpAdapter(): HardenedExpressAdapter {
  return new HardenedExpressAdapter();
}

/**
 * DTO 검증 파이프.
 * - whitelist/forbidNonWhitelisted: DTO에 선언하지 않은 필드가 섞여 들어오면 400으로 막는다
 *   — 팀/곡 수정 API에서 의도치 않은 컬럼이 덮어써지는 것을 방지
 * - transform: 요청 본문을 DTO 클래스 인스턴스로 변환
 * - stopAtFirstError: 한 필드에 대해 메시지를 하나만 내보낸다. 없으면 값이 비었을 때
 *   "비어 있음"과 "너무 김"이 함께 나와 로그인 화면에 모순된 안내가 뜬다
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    stopAtFirstError: true,
  });
}

/**
 * `main.ts`에서 분리한 HTTP 계층 설정.
 *
 * 분리한 이유는 테스트다 — 스펙이 설정을 복사해서 흉내 내면 `main.ts`가 바뀌어도 테스트가 계속 통과한다.
 * 스펙이 이 함수를 그대로 호출하므로 운영과 같은 설정이 검증된다.
 */
export function configureHttp(app: NestExpressApplication, options: HttpSetupOptions): void {
  // 프레임워크 정보를 응답 헤더로 알려 줄 이유가 없다
  app.disable('x-powered-by');

  // 요청 제한(throttler)이 req.ip로 IP를 센다. 기본 0(믿지 않음) — 프록시 없이 열려 있는데 켜 두면
  // X-Forwarded-For 위조로 제한을 피할 수 있다.
  app.set('trust proxy', options.trustProxyHops > 0 ? options.trustProxyHops : false);
  // 0이 아니면 배포 구성(앱 포트는 프록시에서만 접근, 홉 수 = 실제 프록시 수)에 기대는 설정이라 기동 때마다 알린다
  const trustProxyWarning = buildTrustProxyWarning(options.trustProxyHops);
  if (trustProxyWarning) {
    new Logger('Bootstrap').warn(trustProxyWarning);
  }

  // CORS 미들웨어는 Guard보다 앞(Express 계층)에서 실행되므로 preflight가 인증·요청 제한을 타지 않는다
  app.enableCors(buildCorsOptions(options.corsAllowedOrigins));

  app.useGlobalPipes(createValidationPipe());

  // 오류 응답 형태를 {message, error, statusCode}로 통일하고, 요청 값·접속 호스트가 응답과 로그에 남지 않게 한다
  app.useGlobalFilters(new AllExceptionsFilter());
}
