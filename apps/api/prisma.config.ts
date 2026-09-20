import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7부터 접속 정보는 schema.prisma의 datasource 블록이 아니라 이 파일에서 관리한다.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // 런타임·introspection·마이그레이션 모두 이 URL(Session pooler) 하나로 접속한다.
    //
    // 예전에는 여기에 `directUrl: env('DIRECT_URL')`(마이그레이션용 direct connection)이 있었으나
    // Prisma 7.10은 이 옵션을 무시한다. 타입에도 없다(`url`, `shadowDatabaseUrl`만 있음).
    //   - 실측: DIRECT_URL만 존재하지 않는 호스트로 바꿔도 `migrate status`가 그대로 성공했고,
    //     DATABASE_URL만 바꾸면 그 호스트로 접속을 시도해 실패했다 (2026-09-21)
    //   - `migrate deploy`는 같은 마이그레이션 엔진이라 동일할 것으로 추정한다. 확인하지 않았다(미확인)
    // 마이그레이션에만 다른 URL(direct connection 등)을 써야 하면 설정 파일이 아니라 실행 시점에 지정한다:
    //   DATABASE_URL="<마이그레이션용 URL>" npx prisma migrate deploy
    url: env('DATABASE_URL'),
  },
});
