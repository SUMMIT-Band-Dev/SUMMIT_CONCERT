-- 공연 콘텐츠 스키마 추가 (work05 T2)
--
-- [배경]
-- 공개 사이트에 흩어진 공연 정보를 DB 한 곳에서 관리하는 단일 출처로 옮긴다.
-- 이번 단계는 스키마와 명백한 임시값만 준비한다. 실제 콘텐츠는 T6에서 사용자가 입력한다.
--
-- [원자성]
-- 파일 전체가 하나의 암묵적 트랜잭션으로 실행된다 (20260920120000 마이그레이션의 실측 선례).
-- Prisma apply_migrations는 파일 전문을 connector.apply_script에 넘기고, postgres raw_cmd는
-- simple_query를 호출한다. Postgres는 멀티스테이트먼트 Query를 하나의 암묵적 트랜잭션으로
-- 실행하므로 도중 실패하면 앞 문장도 롤백된다. 테이블만 생기고 권한 회수가 빠지는 상태를 막는다.
--
-- [lock_timeout]
-- 암묵적 트랜잭션 안의 SET LOCAL은 파일 실행이 끝나면 원복된다.
-- 락을 5초 안에 잡지 못하면 실패시켜 조회·쓰기 요청이 오래 대기하지 않게 한다.
--
-- [권한]
-- Supabase public 스키마의 신규 테이블·시퀀스에는 anon·authenticated 권한이 기본 부여된다.
-- RLS는 TRUNCATE를 막지 못하므로 권한도 회수하고, 공개 사이트의 anon SELECT만 다시 허용한다.
-- 쓰기는 RLS를 우회하는 postgres 계정의 API만 수행한다. 시퀀스 권한도 모두 회수한다.
SET LOCAL lock_timeout = '5s';

CREATE TYPE "info_section_category" AS ENUM ('ticket', 'notice');

CREATE TABLE "Venue" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "addressDetail" TEXT,
    "latitude" NUMERIC(9,6) NOT NULL,
    "longitude" NUMERIC(9,6) NOT NULL,
    "naverMapUrl" TEXT,
    "websiteUrl" TEXT,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Concert" (
    "id" BIGINT NOT NULL,
    "titleKo" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "subtitle" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "showTime" TEXT NOT NULL,
    "posterImageUrl" TEXT,
    "titleImageUrl" TEXT,
    "subtitleImageUrl" TEXT,
    "venueId" BIGINT NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "Concert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PerformanceDay" (
    "id" BIGSERIAL NOT NULL,
    "dayKey" TEXT NOT NULL,
    "dayLabel" TEXT NOT NULL,
    "dateLabel" TEXT NOT NULL,
    "bookingUrl" TEXT,
    "lineupOverride" TEXT,
    "timetableImageUrl" TEXT,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "PerformanceDay_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Ticket" (
    "id" BIGINT NOT NULL,
    "frontImageUrl" TEXT,
    "backImageUrl" TEXT,
    "description" TEXT,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InfoSection" (
    "id" BIGSERIAL NOT NULL,
    "category" "info_section_category" NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "InfoSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InfoItem" (
    "id" BIGSERIAL NOT NULL,
    "sectionId" BIGINT NOT NULL,
    "content" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "InfoItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Concert" ADD CONSTRAINT "Concert_singleton" CHECK ("id" = 1);
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_singleton" CHECK ("id" = 1);
ALTER TABLE "Concert" ADD CONSTRAINT "Concert_dateRange" CHECK ("endDate" >= "startDate");

ALTER TABLE "Concert" ADD CONSTRAINT "Concert_venueId_fkey"
    FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InfoItem" ADD CONSTRAINT "InfoItem_sectionId_fkey"
    FOREIGN KEY ("sectionId") REFERENCES "InfoSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PerformanceDay" ADD CONSTRAINT "PerformanceDay_dayKey_key" UNIQUE ("dayKey");
-- 같은 트랜잭션 안에서 순서를 맞바꿀 때 중간 상태의 충돌을 피하는 지연 제약이다.
ALTER TABLE "InfoSection" ADD CONSTRAINT "InfoSection_category_sortOrder_key"
    UNIQUE ("category", "sortOrder") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "InfoItem" ADD CONSTRAINT "InfoItem_sectionId_sortOrder_key"
    UNIQUE ("sectionId", "sortOrder") DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "Venue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Concert" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PerformanceDay" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Ticket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InfoSection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InfoItem" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "Venue" FROM anon, authenticated;
REVOKE ALL ON TABLE "Concert" FROM anon, authenticated;
REVOKE ALL ON TABLE "PerformanceDay" FROM anon, authenticated;
REVOKE ALL ON TABLE "Ticket" FROM anon, authenticated;
REVOKE ALL ON TABLE "InfoSection" FROM anon, authenticated;
REVOKE ALL ON TABLE "InfoItem" FROM anon, authenticated;

GRANT SELECT ON TABLE "Venue" TO anon;
GRANT SELECT ON TABLE "Concert" TO anon;
GRANT SELECT ON TABLE "PerformanceDay" TO anon;
GRANT SELECT ON TABLE "Ticket" TO anon;
GRANT SELECT ON TABLE "InfoSection" TO anon;
GRANT SELECT ON TABLE "InfoItem" TO anon;

CREATE POLICY "Venue anon select" ON "Venue" FOR SELECT TO anon USING (true);
CREATE POLICY "Concert anon select" ON "Concert" FOR SELECT TO anon USING (true);
CREATE POLICY "PerformanceDay anon select" ON "PerformanceDay" FOR SELECT TO anon USING (true);
CREATE POLICY "Ticket anon select" ON "Ticket" FOR SELECT TO anon USING (true);
CREATE POLICY "InfoSection anon select" ON "InfoSection" FOR SELECT TO anon USING (true);
CREATE POLICY "InfoItem anon select" ON "InfoItem" FOR SELECT TO anon USING (true);

-- 시퀀스 이름을 가정하지 않고 조회하며, 하나라도 찾지 못하면 파일 전체를 롤백한다.
DO $$
DECLARE
    venue_seq TEXT;
    performance_day_seq TEXT;
    info_section_seq TEXT;
    info_item_seq TEXT;
BEGIN
    venue_seq := pg_get_serial_sequence('"Venue"', 'id');
    performance_day_seq := pg_get_serial_sequence('"PerformanceDay"', 'id');
    info_section_seq := pg_get_serial_sequence('"InfoSection"', 'id');
    info_item_seq := pg_get_serial_sequence('"InfoItem"', 'id');

    IF venue_seq IS NULL OR performance_day_seq IS NULL OR info_section_seq IS NULL OR info_item_seq IS NULL THEN
        RAISE EXCEPTION '신규 테이블의 id 시퀀스를 찾지 못했습니다. 권한 회수를 건너뛸 수 없어 중단합니다.';
    END IF;

    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM anon, authenticated', venue_seq);
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM anon, authenticated', performance_day_seq);
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM anon, authenticated', info_section_seq);
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM anon, authenticated', info_item_seq);
END
$$;

-- Venue id는 시퀀스가 정한다. 반환된 id를 사용해 Concert를 같은 문장에서 연결한다.
WITH v AS (
    INSERT INTO "Venue" ("name", "address", "latitude", "longitude")
    VALUES ('(입력 필요)', '(입력 필요)', 37.552555, 126.91899)
    RETURNING "id"
)
INSERT INTO "Concert" ("id", "titleKo", "titleEn", "startDate", "endDate", "showTime", "venueId")
SELECT 1, '(입력 필요)', '(입력 필요)', DATE '2000-01-01', DATE '2000-01-01', '(입력 필요)', v."id"
FROM v;

INSERT INTO "Ticket" ("id") VALUES (1);

INSERT INTO "PerformanceDay" ("dayKey", "dayLabel", "dateLabel")
VALUES ('day1', '(입력 필요)', '(입력 필요)'),
       ('day2', '(입력 필요)', '(입력 필요)');
