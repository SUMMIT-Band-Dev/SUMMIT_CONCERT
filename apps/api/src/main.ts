import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  // Next.js 개발 서버가 3000을 점유하므로 기본값을 3001로 둔다
  await app.listen(process.env.PORT ?? 3001);
}
await bootstrap();
