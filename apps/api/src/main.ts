import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureHttp, createHttpAdapter } from './app.setup.js';
import { CORS_ALLOWED_ORIGINS_ENV, parseCorsAllowedOrigins } from './common/cors.js';
import { LISTEN_HOST_ENV, buildListenHostWarning, parseListenHost } from './common/listen-host.js';
import { TRUST_PROXY_HOPS_ENV, parseTrustProxyHops } from './common/trust-proxy.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, createHttpAdapter());

  // 잘못된 값은 첫 요청이 아니라 기동 시점에 실패한다(JWT_SECRET 선례). 값 해석은 각 parse 함수가 맡는다.
  const config = app.get(ConfigService);
  const listenHost = parseListenHost(config.get<string>(LISTEN_HOST_ENV));
  const corsAllowedOrigins = parseCorsAllowedOrigins(config.get<string>(CORS_ALLOWED_ORIGINS_ENV));
  configureHttp(app, {
    trustProxyHops: parseTrustProxyHops(config.get<string>(TRUST_PROXY_HOPS_ENV)),
    corsAllowedOrigins,
  });
  const logger = new Logger('Bootstrap');
  logger.log(
    corsAllowedOrigins.length > 0
      ? `CORS 허용 오리진 ${corsAllowedOrigins.length}개`
      : 'CORS 허용 오리진 없음 — 크로스 오리진 요청은 모두 거부됩니다',
  );
  const listenHostWarning = buildListenHostWarning(listenHost);
  if (listenHostWarning) {
    logger.warn(listenHostWarning);
  }

  app.enableShutdownHooks();
  // Next.js 개발 서버가 3000을 점유하므로 기본값을 3001로 둔다
  const port = process.env.PORT ?? 3001;
  // 호스트를 생략하면 모든 인터페이스에 열린다. 기본은 루프백 — 외부 트래픽은 리버스 프록시(Caddy)로만 들어온다
  await app.listen(port, listenHost);
  logger.log(`${listenHost}:${port}에서 대기 중`);
}
await bootstrap();
