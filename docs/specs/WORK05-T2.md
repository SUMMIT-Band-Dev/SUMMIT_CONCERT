---
spec_id: WORK05-T2
revision: 0
---

# WORK05-T2 — 공연 콘텐츠 스키마 (마이그레이션 SQL + Prisma 모델)

## 배경

- work05는 공개 사이트에 하드코딩된 공연 정보(포스터·장소·날짜·티켓·유의사항·예매 링크 등)를 DB 한 곳에서 관리하도록 옮기는 작업이다 (`docs/specs/prd-construction.md`, `.claude/rules/work-05-construction.md`)
- 이 명세는 `docs/specs/work05-implementation.md`의 **T2와 설계 결정 D5**를 단위 명세로 옮긴 것이다. 두 문서가 다르면 **이 명세가 우선**한다. T3(관리 API)~T5(공개 사이트 전환)는 이 명세가 머지된 뒤 각각 별도 명세로 진행한다
- 기존 마이그레이션의 관례를 따른다: `apps/api/prisma/migrations/20260920120000_add_youtube_review_status/migration.sql`(머리 주석·`SET LOCAL lock_timeout`), `20260920210000_add_youtube_recommendation/migration.sql`(신규 테이블의 RLS·권한 회수·시퀀스 처리), 롤백 문서 `apps/api/prisma/rollback/20260920120000_add_youtube_review_status.rollback.sql`
- `schema.prisma`의 generator는 `../src/generated/prisma`로 출력하고(gitignore 대상), `prisma.config.ts`가 `DATABASE_URL`을 읽는다

## 범위

**포함**

- `apps/api/prisma/migrations/20261021120000_add_concert_content/migration.sql` 신규 (수작성 SQL)
- `apps/api/prisma/rollback/20261021120000_add_concert_content.rollback.sql` 신규 (적용하지 않는 절차 문서)
- `apps/api/prisma/schema.prisma`에 모델 6개·enum 1개 추가

**제외**

- **DB에 접속하는 Prisma 명령은 실행하지 않는다**: `migrate deploy`·`migrate status`·`migrate dev`·`migrate reset`·`db push`·`db pull`·`db execute`. 공유 폴더의 `apps/api/.env`는 프로덕션 DB를 가리킨다. 적용은 사용자가 한다 (AC-10)
- API·관리자 프론트·공개 사이트 코드 (T3~T5)
- `.env`·`.env.example` 변경 (이 작업은 환경변수를 추가하지 않는다)
- 문서(`CLAUDE.md`, `REFACTOR_NOTES.md`, `work05-implementation.md`) 갱신 — 필요하면 머지 후 일반 브랜치 PR로 처리

## 설계 결정

### 테이블과 컬럼

테이블은 PascalCase(따옴표), 컬럼은 camelCase다. Prisma 모델명·필드명이 DB 이름과 같아 `@@map`/`@map`이 필요 없다 (enum만 예외, 아래).

| 테이블 | 컬럼 (DB 타입 · NULL 여부 · 기본값) |
| --- | --- |
| `Venue` | `id` BIGSERIAL PK · `name` text NOT NULL · `address` text NOT NULL · `addressDetail` text NULL · `latitude` numeric(9,6) NOT NULL · `longitude` numeric(9,6) NOT NULL · `naverMapUrl` text NULL · `websiteUrl` text NULL · `updatedAt` timestamptz(6) NOT NULL DEFAULT now() |
| `Concert` | `id` bigint PK (**시퀀스 없음**) · `titleKo` text NOT NULL · `titleEn` text NOT NULL · `subtitle` text NULL · `startDate` date NOT NULL · `endDate` date NOT NULL · `showTime` text NOT NULL · `posterImageUrl` text NULL · `titleImageUrl` text NULL · `subtitleImageUrl` text NULL · `venueId` bigint NOT NULL · `updatedAt` timestamptz(6) NOT NULL DEFAULT now() |
| `PerformanceDay` | `id` BIGSERIAL PK · `dayKey` text NOT NULL · `dayLabel` text NOT NULL · `dateLabel` text NOT NULL · `bookingUrl` text NULL · `lineupOverride` text NULL · `timetableImageUrl` text NULL · `updatedAt` timestamptz(6) NOT NULL DEFAULT now() |
| `Ticket` | `id` bigint PK (**시퀀스 없음**) · `frontImageUrl` text NULL · `backImageUrl` text NULL · `description` text NULL · `updatedAt` timestamptz(6) NOT NULL DEFAULT now() |
| `InfoSection` | `id` BIGSERIAL PK · `category` `info_section_category` NOT NULL · `title` text NOT NULL · `sortOrder` integer NOT NULL |
| `InfoItem` | `id` BIGSERIAL PK · `sectionId` bigint NOT NULL · `content` text NOT NULL · `sortOrder` integer NOT NULL |

- enum: `CREATE TYPE "info_section_category" AS ENUM ('ticket', 'notice')`

### 제약 (이름은 Prisma 기본 명명 규칙을 따른다)

| 제약 | 정의 |
| --- | --- |
| PK | 각 테이블 `"<테이블>_pkey"` PRIMARY KEY (`id`) |
| 단일 행 | `"Concert_singleton"` CHECK (`id` = 1), `"Ticket_singleton"` CHECK (`id` = 1) |
| 날짜 순서 | `"Concert_dateRange"` CHECK (`endDate` >= `startDate`) |
| FK | `"Concert_venueId_fkey"` FOREIGN KEY (`venueId`) REFERENCES `"Venue"`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE |
| FK | `"InfoItem_sectionId_fkey"` FOREIGN KEY (`sectionId`) REFERENCES `"InfoSection"`(`id`) ON DELETE CASCADE ON UPDATE CASCADE |
| UNIQUE | `"PerformanceDay_dayKey_key"` UNIQUE (`dayKey`) |
| UNIQUE (지연) | `"InfoSection_category_sortOrder_key"` UNIQUE (`category`, `sortOrder`) **DEFERRABLE INITIALLY DEFERRED** |
| UNIQUE (지연) | `"InfoItem_sectionId_sortOrder_key"` UNIQUE (`sectionId`, `sortOrder`) **DEFERRABLE INITIALLY DEFERRED** |

- 지연 UNIQUE는 T3에서 항목 순서를 한 트랜잭션 안에서 맞바꿀 때 중간 상태의 충돌을 피하기 위함이다. 인덱스가 아니라 **테이블 제약**(`ALTER TABLE ... ADD CONSTRAINT ... UNIQUE ... DEFERRABLE INITIALLY DEFERRED`)으로 만든다

### 권한 (D5 보완 — 2026-09-20 마이그레이션의 선례를 따른다)

Supabase는 public 스키마의 새 테이블·시퀀스에 `anon`·`authenticated` 권한을 기본으로 준다. 공개 사이트는 anon key로 **읽기만** 하고, 쓰기는 RLS를 우회하는 `postgres` 계정의 API만 한다.

1. 6개 테이블 모두 `ENABLE ROW LEVEL SECURITY`
2. 6개 테이블 모두 `REVOKE ALL ON TABLE ... FROM anon, authenticated` 후 `GRANT SELECT ON TABLE ... TO anon` — RLS는 TRUNCATE에 적용되지 않으므로 권한 자체를 SELECT로 줄인다
3. 6개 테이블 모두 정책 `CREATE POLICY "<테이블> anon select" ON "<테이블>" FOR SELECT TO anon USING (true)`. INSERT·UPDATE·DELETE 정책은 만들지 않는다
4. BIGSERIAL 테이블 4개(`Venue`, `PerformanceDay`, `InfoSection`, `InfoItem`)의 시퀀스는 `pg_get_serial_sequence`로 찾아 `REVOKE ALL ... FROM anon, authenticated`. 이름을 하드코딩하지 않고, 하나라도 못 찾으면 `RAISE EXCEPTION`으로 파일 전체를 롤백시킨다 (선례의 `DO $$ ... $$` 블록과 같은 방식)

### 임시값 행

실제 값은 T6에서 사용자가 관리자 화면으로 입력한다. **지금 공개 사이트에 하드코딩된 값을 옮겨 적지 않는다.**

| 테이블 | 행 |
| --- | --- |
| `Venue` | 1행 — `name`·`address` = `'(입력 필요)'`, `latitude` = 37.552555, `longitude` = 126.91899 (현재 `src/components/common/naver-map.tsx` 지도 중심 좌표), 나머지 NULL |
| `Concert` | `id` = 1 — `titleKo`·`titleEn`·`showTime` = `'(입력 필요)'`, `startDate`·`endDate` = `'2000-01-01'`, `venueId` = 위 Venue 행의 id, 나머지 NULL |
| `Ticket` | `id` = 1 — 나머지 NULL |
| `PerformanceDay` | `dayKey` = `'day1'`, `'day2'` 2행 — `dayLabel`·`dateLabel` = `'(입력 필요)'`, 나머지 NULL |
| `InfoSection`, `InfoItem` | 비워 둔다 |

- Venue id는 시퀀스가 정하므로 숫자를 가정하지 않는다. `WITH v AS (INSERT INTO "Venue" ... RETURNING "id") INSERT INTO "Concert" (...) SELECT 1, ..., v."id" FROM v` 형태로 연결한다

### 마이그레이션 파일 형식

- 맨 앞에 머리 주석: [배경](work05 T2, 단일 출처 전환), [원자성](파일 전체가 하나의 암묵적 트랜잭션 — 선례 주석 참조), [lock_timeout], [권한](위 권한 절의 이유)
- 첫 실행 문장은 `SET LOCAL lock_timeout = '5s';`. `BEGIN`·`COMMIT`은 쓰지 않는다 (Prisma가 파일 전체를 한 트랜잭션으로 실행한다)
- 순서: enum → 테이블(Venue → Concert → PerformanceDay → Ticket → InfoSection → InfoItem) → 제약 → 권한·RLS·정책 → 시퀀스 권한 회수 → 임시값 INSERT

### 롤백 문서 형식

선례 롤백 문서의 구성을 따른다. 맨 위에 "이 파일은 적용하지 않는다", "적용된 migration.sql은 수정하지 않는다"를 적고:

- 0) 실행 순서: T3 API가 이 테이블을 쓰기 시작한 뒤라면 **코드 먼저 되돌리고 DB 나중**. T3 배포 전에는 코드 의존이 없다
- 1) 확인 쿼리: `_prisma_migrations` 이력, 6개 테이블과 enum의 실제 존재 여부
- 2) DROP SQL (수동 실행용은 `BEGIN; SET LOCAL lock_timeout = '5s'; ... COMMIT;`, 정방향 마이그레이션용은 BEGIN/COMMIT 없이): `DROP TABLE` 순서 `InfoItem` → `InfoSection` → `Ticket` → `PerformanceDay` → `Concert` → `Venue`, 마지막에 `DROP TYPE "info_section_category"`. 정책은 테이블과 함께 지워진다
- 3) Prisma 이력 처리 갈래 (가)~(라): 선례 문서와 같은 판단 기준을 이 마이그레이션 이름으로 적는다
- 경고: T6에서 실제 데이터를 입력한 뒤의 DROP은 그 데이터를 지운다

### Prisma 모델

- 필드 타입: numeric(9,6) → `Decimal @db.Decimal(9, 6)`, date → `DateTime @db.Date`, timestamptz(6) → `DateTime @default(now()) @updatedAt @db.Timestamptz(6)`, integer → `Int`, bigint → `BigInt`
- `Concert`·`Ticket`의 `id`는 `BigInt @id` (`@default` 없음), 나머지 4개는 `BigInt @id @default(autoincrement())`
- 관계: `Concert.venue`(`onDelete: Restrict, onUpdate: Cascade`) ↔ `Venue.concerts`, `InfoItem.section`(`onDelete: Cascade, onUpdate: Cascade`) ↔ `InfoSection.items`. FK 이름은 위 제약 이름을 `map`으로 지정한다
- UNIQUE: `PerformanceDay.dayKey @unique`, `InfoSection @@unique([category, sortOrder])`, `InfoItem @@unique([sectionId, sortOrder])` (이름은 위 제약 이름. Prisma는 DEFERRABLE을 표현하지 못하므로 그 사실을 모델 주석에 적는다)
- enum: `enum InfoSectionCategory { ticket notice @@map("info_section_category") }`
- CHECK 제약은 Prisma가 표현하지 못하므로 모델 주석(`///`)에 적는다. 기존 모델의 주석 관례를 따른다

## 수용 기준

- AC-01 마이그레이션 파일이 `apps/api/prisma/migrations/20261021120000_add_concert_content/migration.sql`에 있고, 머리 주석 다음 첫 실행 문장이 `SET LOCAL lock_timeout = '5s';`이며 `BEGIN`·`COMMIT`이 없다
- AC-02 6개 테이블의 컬럼 이름·타입·NULL 여부·기본값이 "테이블과 컬럼" 표와 같고, enum `info_section_category`('ticket','notice')가 있다
- AC-03 "제약" 표의 PK·CHECK 3개·FK 2개(ON DELETE 동작 포함)·UNIQUE 3개가 표의 이름으로 있고, `InfoSection`·`InfoItem`의 UNIQUE는 `DEFERRABLE INITIALLY DEFERRED`다
- AC-04 6개 테이블 모두 RLS 활성화, `anon`·`authenticated`에서 `REVOKE ALL`, `anon`에 `GRANT SELECT`, `"<테이블> anon select"` 정책 1개씩이 있고, 4개 시퀀스의 권한 회수가 이름 하드코딩 없이 `RAISE EXCEPTION` 안전장치와 함께 있다
- AC-05 임시값 INSERT가 "임시값 행" 표와 같다 (Venue 1·Concert 1·Ticket 1·PerformanceDay 2·InfoSection 0). 현재 공개 사이트의 하드코딩 값(공연 제목·주소 등)이 들어가 있지 않다
- AC-06 롤백 문서가 `apps/api/prisma/rollback/20261021120000_add_concert_content.rollback.sql`에 있고 "롤백 문서 형식"의 0)~3)과 DROP 순서를 따른다
- AC-07 `schema.prisma`에 "Prisma 모델" 절대로 모델 6개와 enum 1개가 추가되고, `npx prisma validate`와 `npx prisma generate`가 성공한다. 기존 모델은 바뀌지 않는다
- AC-08 `apps/api`에서 `npm run build`·`npm run typecheck`·`npm run lint`·`npm test`가 통과한다
- AC-09 `origin/develop` 대비 변경 파일이 범위의 3개뿐이다 (신규 2개, 수정 1개)
- AC-10 [manual] 사용자가 프로덕션 DB에 `npx prisma migrate deploy`로 적용하고, 확인 SQL의 결과가 기대값과 같다. **적용과 확인이 끝나기 전에는 이 PR을 머지하지 않는다**

## 테스트 계획

**커밋하기 전에** 실행하고 명령과 결과를 PR 본문에 남긴다. 새 파일은 `git add`로 스테이지한 뒤 실행한다.

```bash
# 저장소 루트
git diff --cached --name-status origin/develop
#   A  apps/api/prisma/migrations/20261021120000_add_concert_content/migration.sql
#   A  apps/api/prisma/rollback/20261021120000_add_concert_content.rollback.sql
#   M  apps/api/prisma/schema.prisma      ← 이 3줄만 (AC-09)
git status --short                          # 위 3개 외 변경 없음 (AC-09)
git grep --cached -c "ENABLE ROW LEVEL SECURITY" -- apps/api/prisma/migrations/20261021120000_add_concert_content/migration.sql   # 6 (AC-04)
git grep --cached -c "CREATE POLICY" -- apps/api/prisma/migrations/20261021120000_add_concert_content/migration.sql               # 6 (AC-04)
git grep --cached -c "DEFERRABLE INITIALLY DEFERRED" -- apps/api/prisma/migrations/20261021120000_add_concert_content/migration.sql # 2 (AC-03)

# apps/api 폴더 (DB에 접속하지 않는 명령만)
npx prisma validate                         # "is valid" (AC-07)
npx prisma generate                         # 성공 (AC-07)
npm run build                               # 통과 (AC-08)
npm run typecheck                           # 통과 (AC-08)
npm run lint                                # 통과 (AC-08)
npm test                                    # 통과 (AC-08)
```

- **`npm test` 타임아웃 예외**: Windows 로컬에서 전체 실행 시 앱을 띄우는 테스트(`src/common/cors.spec.ts`, `src/app.setup.spec.ts` 등)가 부하로 `Test timed out in 5000ms`만 내고 실패하는 경우가 있다 (2026-10-21 develop에서 재현, 단독 실행 시 통과). 실패 사유가 **타임아웃뿐**이면 실패한 파일만 `npx vitest run <파일>`로 다시 실행하고, 통과하면 두 출력을 함께 보고한다. 타임아웃이 아닌 실패는 그대로 실패로 보고한다
- 참고 자가 점검(필수 아님): `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`는 DB 없이 schema.prisma가 만들 SQL을 출력한다. 새 6개 테이블의 컬럼 정의가 수작성 SQL과 같은지 비교하는 데 쓸 수 있다

### 사용자 확인 절차 (AC-10) — PR 생성 후 사용자에게 요청할 내용

Codex는 PR을 만든 뒤 아래 절차를 사용자에게 그대로 안내하고 끝낸다 (실행하지 않는다). 사용자는 적용 전에 Claude Code에 SQL 검토를 요청할 수 있다.

1. 공유 폴더에서 PR 브랜치를 체크아웃한 상태로 `cd apps/api`
2. `npx prisma migrate status` → 미적용 항목이 `20261021120000_add_concert_content` **하나뿐**인지 확인. 다른 항목이 있으면 중단
3. `npx prisma migrate deploy` (**`migrate dev` 금지**)
4. `npx prisma migrate status` → `Database schema is up to date!`
5. Supabase SQL Editor에서 확인:

```sql
select 'Venue', count(*) from "Venue" union all
select 'Concert', count(*) from "Concert" union all
select 'Ticket', count(*) from "Ticket" union all
select 'PerformanceDay', count(*) from "PerformanceDay" union all
select 'InfoSection', count(*) from "InfoSection" union all
select 'InfoItem', count(*) from "InfoItem";
-- 기대값: 1, 1, 1, 2, 0, 0

select relname, relrowsecurity from pg_class
where relname in ('Venue','Concert','Ticket','PerformanceDay','InfoSection','InfoItem');
-- 기대값: 6개 모두 true

select tablename, policyname, roles, cmd from pg_policies
where tablename in ('Venue','Concert','Ticket','PerformanceDay','InfoSection','InfoItem');
-- 기대값: 테이블마다 "<테이블> anon select", {anon}, SELECT 1개

select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type)
from information_schema.role_table_grants
where table_name in ('Venue','Concert','Ticket','PerformanceDay','InfoSection','InfoItem')
  and grantee in ('anon','authenticated')
group by table_name, grantee;
-- 기대값: 테이블마다 anon / SELECT 한 줄만 (authenticated 없음)
```

6. 기대값과 다르면 롤백 SQL을 임의로 실행하지 말고 결과를 Claude Code에 보고한다
7. 확인이 끝나면 PR 본문의 AC-10을 체크하고 머지한다. 이후 T3 명세를 진행한다
