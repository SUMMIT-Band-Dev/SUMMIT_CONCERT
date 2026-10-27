---
spec_id: WORK05-T7
revision: 0
---

# WORK05-T7 — 유튜브 리뷰 DB 객체 제거 (DROP 마이그레이션 + 정리 코드 삭제)

## 배경

- work05 T1(#55)에서 유튜브 리뷰·배치 워크플로우 코드를 걷어내고, DB 객체는 "미사용 상태로 남겼다가 work05 배포·안정화 후 제거"하기로 했다 (`docs/specs/prd-construction.md` "유튜브 개편에 따른 정리 대상", 확정 사항 #6). 2026-10-27 work05 T1~T6이 배포되고 사용자 수동 확인이 끝나 이 후속 단계를 진행한다
- 이 명세는 `docs/specs/work05-implementation.md`의 **T7**을 단위 명세로 옮긴 것이다. 두 문서가 다르면 **이 명세가 우선**한다
- 운영 DB 현황 (2026-10-27 Claude가 Supabase에서 조회)
  - `YoutubeSearchAttempt` 0행, `YoutubeRecommendation` 0행 → 명세 T7의 선행 단계였던 `youtube-cleanup` 실행은 **필요 없다** (정리할 후보 행이 없다)
  - 제거 대상: 테이블 `YoutubeRecommendation`(CHECK `YoutubeRecommendation_rank_positive`, UNIQUE `(attemptId, rank)`, FK → Attempt), 테이블 `YoutubeSearchAttempt`(CHECK 3개, 인덱스 3개, FK → `Setlist`), 컬럼 `Setlist.youtube_review_status`, enum `youtube_review_status`·`youtube_search_outcome`·`youtube_review_state`
  - 이 컬럼·enum을 참조하는 뷰·다른 컬럼은 없다 (enum 사용처는 위 컬럼과 `YoutubeSearchAttempt.outcome`·`reviewState`뿐). 공개 사이트(`src/`)·관리자 프론트(`apps/admin/src`)에는 참조가 없다
  - `Setlist.youtube_url`은 지금도 쓰는 컬럼이다 (**유지**)
- 코드에 남은 참조 (`apps/api`)
  - `prisma/schema.prisma`: `Setlist.youtubeReviewStatus`·`Setlist.searchAttempts`, 모델 `YoutubeSearchAttempt`·`YoutubeRecommendation`, enum `YoutubeReviewStatus`·`YoutubeSearchOutcome`·`YoutubeReviewState`
  - 정리 스크립트: `src/scripts/youtube-cleanup.ts`, `src/youtube/youtube-maintenance.service.ts`(+ `.spec.ts`), `src/youtube/youtube-maintenance.constants.ts`, `package.json`의 `youtube:cleanup`
  - 잠금 순서: `src/common/lock-order.ts`(+ `.spec.ts`)의 `LOCK_ORDER`에 `'YoutubeSearchAttempt'`가 3번째로 있고, 스펙의 경로 목록에 T1에서 사라진 경로(F013·F012 승인/반려·재큐·배치)가 남아 있다
- 기존 마이그레이션 관례를 따른다: `prisma/migrations/20260920120000_add_youtube_review_status/migration.sql`(머리 주석·[원자성]·[lock_timeout]), 롤백 문서 `prisma/rollback/20260920210000_add_youtube_recommendation.rollback.sql`(0)~4) 구성, DROP 락 주의)

## 범위

**포함** (`apps/api` 안에서만)

- `prisma/migrations/20261027120000_drop_youtube_review_objects/migration.sql` 신규 (수작성 SQL)
- `prisma/rollback/20261027120000_drop_youtube_review_objects.rollback.sql` 신규 (적용하지 않는 절차 문서)
- `prisma/schema.prisma`에서 위 모델 2개·enum 3개·`Setlist` 필드 2개 제거
- 정리 스크립트 삭제: `src/scripts/youtube-cleanup.ts`, `src/youtube/youtube-maintenance.service.ts`, `src/youtube/youtube-maintenance.service.spec.ts`, `src/youtube/youtube-maintenance.constants.ts`, `package.json`의 `youtube:cleanup` 스크립트 한 줄
- `src/common/lock-order.ts`·`src/common/lock-order.spec.ts`를 현재 경로에 맞게 수정

**제외**

- **DB에 접속하는 Prisma 명령은 실행하지 않는다**: `migrate deploy`·`migrate status`·`migrate dev`·`migrate reset`·`db push`·`db pull`·`db execute`. 공유 폴더의 `apps/api/.env`는 프로덕션 DB를 가리킨다. 적용은 사용자가 한다 (AC-11)
- 이미 적용된 마이그레이션 폴더(`prisma/migrations/2026092*`, `20261021120000_*`)와 기존 롤백 문서는 수정·삭제하지 않는다 (체크섬·이력)
- `Setlist.youtube_url`, `youtube-url.*`·`youtube-video-id.*`·`youtube.module.*`·`youtube.constants.ts`·`dto/` 등 URL 저장 기능
- `youtube.module.spec.ts`의 `/youtube/recommendations`·`/youtube/quota` 404 단언 — 옛 라우트가 없다는 회귀 테스트이므로 유지
- `package-lock.json` (스크립트 한 줄 삭제는 lock에 영향이 없다)
- 문서(`REFACTOR_NOTES.md`, `docs/specs/prd-construction.md`, `docs/specs/work05-implementation.md`, `.claude/rules/work-05-construction.md`, `CLAUDE.md`)의 T7 완료 표기 — 머지·적용 후 일반 브랜치 PR로 처리

## 설계 결정

### 배포 순서 — **코드 먼저, DB 나중** (T2와 반대)

현재 운영 API의 Prisma 클라이언트는 `Setlist`를 조회할 때 `youtube_review_status` 컬럼을 SELECT 목록에 넣는다. 컬럼을 먼저 지우면 곡 조회·수정 API가 "column does not exist"로 실패한다. 반대로 새 코드(필드 없음)가 먼저 배포되면 DB에 컬럼·테이블이 남아 있어도 읽지 않으므로 무해하다. 그래서:

1. 구현 PR 머지 → 2. Lightsail API 재배포 (`apps/api/deploy/README.md`) → 3. 사용자가 `migrate deploy`로 DROP 적용

AC-11은 **머지 전 조건이 아니다.** 머지·재배포 후에 수행한다.

### 마이그레이션 SQL

- 머리 주석: [배경](work05 T7, PRD 확정 #6의 후속 단계), [배포 순서](위 절), [원자성](파일 전체가 하나의 암묵적 트랜잭션 — 선례 주석 참조), [lock_timeout](`DROP TABLE "YoutubeSearchAttempt"`는 FK 때문에 참조 대상 `Setlist`에도 ACCESS EXCLUSIVE를 잡고, `ALTER TABLE "Setlist" DROP COLUMN`도 ACCESS EXCLUSIVE다. 메타데이터 변경이라 짧지만 공개 사이트 조회가 잠깐 막힐 수 있다), [데이터 손실](두 테이블은 0행 확인. `youtube_review_status` 값은 지워지지만 T1 이후 읽거나 쓰는 코드가 없다)
- 첫 실행 문장은 `SET LOCAL lock_timeout = '5s';`. `BEGIN`·`COMMIT`은 쓰지 않는다
- **안전장치**: DROP 전에 `DO $$ ... $$` 블록에서 `YoutubeSearchAttempt` 또는 `YoutubeRecommendation`에 행이 하나라도 있으면 `RAISE EXCEPTION`으로 파일 전체를 롤백시킨다 (메시지에 "행이 남아 있어 DROP을 중단" 취지와 롤백 문서 경로)
- DROP 순서 (`CASCADE` 쓰지 않음):
  1. `DROP TABLE "YoutubeRecommendation";`
  2. `DROP TABLE "YoutubeSearchAttempt";`
  3. `ALTER TABLE "Setlist" DROP COLUMN "youtube_review_status";`
  4. `DROP TYPE "youtube_review_state";`
  5. `DROP TYPE "youtube_search_outcome";`
  6. `DROP TYPE "youtube_review_status";`
- `IF EXISTS`는 쓰지 않는다 — 객체가 없으면 실패해야 실제 스키마가 예상과 다르다는 것을 알 수 있다

### 롤백 문서

선례(`20260920210000_add_youtube_recommendation.rollback.sql`)의 구성을 따른다. 맨 위에 "이 파일은 적용하지 않는다", "적용된 migration.sql은 수정하지 않는다"를 적고:

- 0) 실행 순서: 되돌릴 때는 **DB 먼저, 코드 나중** (객체를 다시 만든 뒤에 그 객체를 쓰는 옛 코드를 배포). 지금 코드는 이 객체를 쓰지 않으므로 DB만 되돌려도 무해하다
- 1) 확인 쿼리: 이 마이그레이션의 `_prisma_migrations` 이력, 테이블 2개·컬럼·enum 3개의 실제 존재 여부 (`logs` 컬럼은 조회하지 않는다)
- 2) 재생성 SQL: 수동 실행용(`BEGIN; SET LOCAL lock_timeout = '5s'; ... COMMIT;`)과 정방향 마이그레이션용(BEGIN/COMMIT 없음). 내용은 `20260920120000_add_youtube_review_status/migration.sql`과 `20260920210000_add_youtube_recommendation/migration.sql`의 생성 문장(enum·테이블·컬럼·제약·인덱스·RLS·권한 회수)을 **그대로** 옮긴다. 컬럼 백필(`youtube_url`이 있으면 `approved`)도 원본과 같이 포함한다. 원본 파일을 바꾸지 않는다
- 3) Prisma 이력 처리 갈래 (가)~(라): 선례 문서와 같은 판단 기준을 이 마이그레이션 이름으로 적는다. 성공 기록이면 정방향 재생성 마이그레이션이 우선안이다
- 경고: 재생성해도 지워진 `youtube_review_status` 값과 리뷰 이력은 돌아오지 않는다 (두 테이블은 DROP 시점에 0행이었다)

### Prisma 스키마

- `Setlist`에서 `youtubeReviewStatus` 필드와 그 `///` 주석, `searchAttempts` 필드와 그 `///` 주석을 지운다. `youtubeUrl`을 포함한 나머지 필드·관계는 그대로 둔다
- `YoutubeReviewStatus`·`YoutubeSearchOutcome`·`YoutubeReviewState` enum과 `YoutubeSearchAttempt`·`YoutubeRecommendation` 모델을 주석까지 지운다
- 다른 모델(`AdminUser`, `LineUp`, 공연 콘텐츠 6개 등)과 generator·datasource는 바꾸지 않는다

### 잠금 순서 (`lock-order.ts`)

- `LOCK_ORDER`를 `['Line Up', 'Setlist'] as const`로 바꾼다
- 문서 주석의 전역 순서 그림에서 `"YoutubeSearchAttempt"`(3)를 지우고, 경로 표에서 `youtube:cleanup` 줄을 지운다. 나머지 4개 경로(곡 등록·곡 수정·F025 PUT·F025 DELETE)와 "데드락이 불가능한 이유"·"새 경로를 추가할 때" 절은 유지하되 `1 → 2 → 3` 표현을 `1 → 2`로 고친다
- `lock-order.spec.ts`
  - 첫 테스트: 기대값 `['Line Up', 'Setlist']`, 테스트 이름도 맞춘다
  - 경로 목록: `lock-order.ts` 표의 4개 경로로 바꾼다 — `['곡 등록', ['Line Up', 'Setlist']]`, `['곡 수정', ['Line Up', 'Setlist']]`, `['F025 URL 저장', ['Setlist']]`, `['F025 연결 해제', ['Setlist']]`
  - `locksBefore` 테스트: `YoutubeSearchAttempt`가 들어간 단언 2개를 지우고, `locksBefore('Setlist', 'Line Up')`이 `false`임을 추가한다

## 수용 기준

- AC-01 `apps/api/prisma/migrations/20261027120000_drop_youtube_review_objects/migration.sql`이 있고, 머리 주석에 [배경]·[배포 순서]·[원자성]·[lock_timeout]·[데이터 손실]이 있으며, 머리 주석 다음 첫 실행 문장이 `SET LOCAL lock_timeout = '5s';`이고 `BEGIN`·`COMMIT`이 없다
- AC-02 마이그레이션의 DROP 문장보다 앞에, `YoutubeSearchAttempt` 또는 `YoutubeRecommendation`에 행이 있으면 `RAISE EXCEPTION`하는 `DO $$ ... $$` 블록이 있다
- AC-03 마이그레이션이 "마이그레이션 SQL" 절의 6개 문장을 그 순서로 실행하고, `CASCADE`·`IF EXISTS`가 없으며, `youtube_url`을 건드리는 문장이 없다
- AC-04 `apps/api/prisma/rollback/20261027120000_drop_youtube_review_objects.rollback.sql`이 있고 "롤백 문서" 절의 0)~3)과 경고를 담으며, 2)의 재생성 SQL이 원본 두 마이그레이션의 생성 문장(enum 3개·테이블 2개·컬럼·CHECK 4개·인덱스 3개·UNIQUE·FK 2개·RLS·권한 회수·백필)과 같다
- AC-05 `schema.prisma`에서 "Prisma 스키마" 절의 대상이 모두 제거되고 다른 모델은 바뀌지 않으며, `apps/api`에서 `npx prisma validate`와 `npx prisma generate`가 성공한다
- AC-06 `src/scripts/youtube-cleanup.ts`, `src/youtube/youtube-maintenance.service.ts`, `src/youtube/youtube-maintenance.service.spec.ts`, `src/youtube/youtube-maintenance.constants.ts`가 삭제되고, `package.json`의 `scripts`에 `youtube:cleanup`이 없다
- AC-07 `lock-order.ts`의 `LOCK_ORDER`가 `['Line Up', 'Setlist']`이고, 주석과 `lock-order.spec.ts`가 "잠금 순서" 절과 같다
- AC-08 `git grep -n -i -E "YoutubeSearchAttempt|YoutubeRecommendation|youtubeReviewStatus|youtube_review_status|YoutubeSearchOutcome|YoutubeReviewState|youtube-maintenance|youtube-cleanup|youtube:cleanup|searchAttempts" -- apps/api/src apps/api/package.json apps/api/prisma/schema.prisma`의 결과가 없다
- AC-09 `apps/api`에서 `npm run build`·`npm run typecheck`·`npm run lint`·`npm test`가 통과한다
- AC-10 `origin/develop` 대비 변경 파일이 범위의 10개뿐이다 (신규 2개, 수정 4개: `schema.prisma`·`package.json`·`lock-order.ts`·`lock-order.spec.ts`, 삭제 4개)
- AC-11 [manual] 구현 PR 머지와 Lightsail API 재배포가 끝난 **뒤**, 사용자가 운영 DB에 `npx prisma migrate deploy`로 적용하고 확인 SQL 결과가 기대값과 같다 (머지 전 조건이 아니다 — "배포 순서" 절)

## 테스트 계획

**커밋하기 전에** 실행하고 명령과 결과를 PR 본문에 남긴다. 새 파일·삭제는 `git add -A apps/api`로 스테이지한 뒤 실행한다.

```bash
# 저장소 루트
git diff --cached --name-status origin/develop
#   A  apps/api/prisma/migrations/20261027120000_drop_youtube_review_objects/migration.sql
#   A  apps/api/prisma/rollback/20261027120000_drop_youtube_review_objects.rollback.sql
#   M  apps/api/package.json
#   M  apps/api/prisma/schema.prisma
#   M  apps/api/src/common/lock-order.spec.ts
#   M  apps/api/src/common/lock-order.ts
#   D  apps/api/src/scripts/youtube-cleanup.ts
#   D  apps/api/src/youtube/youtube-maintenance.constants.ts
#   D  apps/api/src/youtube/youtube-maintenance.service.spec.ts
#   D  apps/api/src/youtube/youtube-maintenance.service.ts      ← 이 10줄만 (AC-10)
git status --short                          # 위 10개 외 변경 없음 (AC-10)
git grep --cached -n -i -E "YoutubeSearchAttempt|YoutubeRecommendation|youtubeReviewStatus|youtube_review_status|YoutubeSearchOutcome|YoutubeReviewState|youtube-maintenance|youtube-cleanup|youtube:cleanup|searchAttempts" -- apps/api/src apps/api/package.json apps/api/prisma/schema.prisma
#   출력 없음 (AC-08)
git grep --cached -n -E "CASCADE|IF EXISTS|BEGIN;|COMMIT;" -- apps/api/prisma/migrations/20261027120000_drop_youtube_review_objects/migration.sql
#   출력 없음 (AC-01·AC-03 — 주석에 이 단어를 쓰지 않는다)

# apps/api 폴더 (DB에 접속하지 않는 명령만)
npx prisma validate                         # "is valid" (AC-05)
npx prisma generate                         # 성공 (AC-05)
npm run build                               # 통과 (AC-09)
npm run typecheck                           # 통과 (AC-09)
npm run lint                                # 통과 (AC-09)
npm test                                    # 통과 (AC-09)
```

- **`npm test` 타임아웃 예외**: Windows 로컬에서 전체 실행 시 앱을 띄우는 테스트(`src/common/cors.spec.ts`, `src/app.setup.spec.ts` 등)가 부하로 `Test timed out in 5000ms`만 내고 실패하는 경우가 있다. 실패 사유가 **타임아웃뿐**이면 실패한 파일만 `npx vitest run <파일>`로 다시 실행하고, 통과하면 두 출력을 함께 보고한다. 타임아웃이 아닌 실패는 그대로 실패로 보고한다
- 참고 자가 점검(필수 아님): `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script` 출력에 `Youtube`·`youtube_review` 문자열이 없는지 본다 (DB 접속 없음)

### 사용자 확인 절차 (AC-11) — PR 생성 후 사용자에게 안내할 내용

Codex는 PR을 만든 뒤 아래 절차를 사용자에게 그대로 안내하고 끝낸다 (실행하지 않는다). 사용자는 적용 전에 Claude Code에 SQL 검토를 요청할 수 있다.

1. 구현 PR을 머지한다
2. `apps/api/deploy/README.md` 절차로 Lightsail API를 재배포하고, `sudo systemctl status summit-api`가 `active (running)`이며 관리자 화면에서 곡 목록·유튜브 연결 관리가 열리는지 확인한다
3. 공유 폴더에서 최신 `develop`을 받은 상태로 `cd apps/api`
4. `npx prisma migrate status` → 미적용 항목이 `20261027120000_drop_youtube_review_objects` **하나뿐**인지 확인. 다른 항목이 있으면 중단
5. `npx prisma migrate deploy` (**`migrate dev` 금지**). 안전장치(AC-02)로 실패하면 롤백 SQL을 임의로 실행하지 말고 출력을 Claude Code에 보고한다
6. `npx prisma migrate status` → `Database schema is up to date!`
7. Supabase SQL Editor에서 확인:

```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('YoutubeSearchAttempt', 'YoutubeRecommendation');
-- 기대값: 0행

select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'Setlist' order by ordinal_position;
-- 기대값: youtube_review_status 없음, youtube_url 있음

select typname from pg_type
where typname in ('youtube_review_status', 'youtube_search_outcome', 'youtube_review_state');
-- 기대값: 0행
```

8. 관리자 화면에서 곡 수정·유튜브 URL 저장·연결 해제, 공개 사이트 `/setlist`가 정상인지 확인하고 PR 체크리스트의 AC-11을 체크한다
