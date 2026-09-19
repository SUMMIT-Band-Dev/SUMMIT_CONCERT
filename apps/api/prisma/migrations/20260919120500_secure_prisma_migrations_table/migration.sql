-- Prisma가 자동 생성하는 _prisma_migrations는 public 스키마에 있어 PostgREST에 노출된다.
-- Supabase 기본 ACL상 anon/authenticated가 ALL 권한을 가지므로,
-- 정책 없이 RLS만 켜서 anon key 경유 읽기/변조를 차단한다.
-- 마이그레이션을 실행하는 postgres 롤은 rolbypassrls=true 이므로 영향받지 않는다.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
