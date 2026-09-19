import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7부터 접속 정보는 schema.prisma의 datasource 블록이 아니라 이 파일에서 관리한다.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // 런타임/introspection용 (Session pooler)
    url: env('DATABASE_URL'),
    // 마이그레이션용 (direct connection 우선, 불가 시 pooler와 동일)
    directUrl: env('DIRECT_URL'),
  },
});
