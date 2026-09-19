-- CreateTable
CREATE TABLE "AdminUser" (
    "id" BIGSERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- Supabase는 public 스키마의 신규 테이블에 anon/authenticated ALL 권한을 기본 부여한다.
-- 정책 없이 RLS만 켜서 anon key 경유(PostgREST) 접근을 전면 차단한다.
-- Nest.js가 쓰는 postgres 롤은 rolbypassrls=true 이므로 영향받지 않는다.
ALTER TABLE "AdminUser" ENABLE ROW LEVEL SECURITY;
