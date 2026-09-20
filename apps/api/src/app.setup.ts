import type { NestExpressApplication } from '@nestjs/platform-express';
import { buildCorsOptions } from './common/cors.js';

export interface HttpSetupOptions {
  /** 프록시 뒤에서 X-Forwarded-For를 몇 단계까지 믿을지. 0이면 믿지 않는다 */
  trustProxyHops: number;
  /** 크로스 오리진 요청을 허용할 오리진. 비어 있으면 전부 거부한다 */
  corsAllowedOrigins: string[];
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

  // CORS 미들웨어는 Guard보다 앞(Express 계층)에서 실행되므로 preflight가 인증·요청 제한을 타지 않는다
  app.enableCors(buildCorsOptions(options.corsAllowedOrigins));
}
