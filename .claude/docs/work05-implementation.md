# work05 구현 명세 (Codex 구현용)

> **이 문서의 역할**: `prd-construction.md`(무엇을 만들지)를 **어떻게 만들지**로 옮긴 구현 명세다. 설계는 Claude Code가, 구현은 Codex가 맡는다.
> Codex는 이 문서의 설계 결정(D1~D10)을 그대로 따르고, 작업 단위(T1~T7)를 순서대로 하나씩 구현한다.
> **명세대로 구현할 수 없거나 명세가 틀렸다고 판단되면, 우회하지 말고 작업을 멈추고 이유를 보고한다.** 설계 수정은 Claude Code가 이 문서에 반영한다.
>
> 작성: 2026-10-17 · 기준 PRD: `.claude/docs/prd-construction.md` (✅ 확정 사항 2026-10-17)

---

## 0. 공통 규칙

- 공통 규칙은 루트 `AGENTS.md`를 따른다 (한국어 주석·커밋, migrate dev 금지, 막히면 보고, 시크릿 채팅 금지, 머지 금지)
- **작업 단위 하나 = 브랜치 하나 = PR 하나.** 각 작업은 최신 `develop`에서 분기한다 (브랜치명은 작업 단위 표에 있음)
- **흐름은 직렬이다** (`AGENTS.md` "작업 흐름"): 구현 → 결과 보고 → 사용자 확인 후 커밋 → **멈추고 Claude 리뷰 대기** → 수정 요청이 있으면 같은 브랜치에 추가 커밋 → 리뷰 통과 후 push·PR → 사용자 머지 → 다음 작업 단위
- 각 작업의 **완료 기준을 모두 통과해야 완료**다. 검증 명령 출력은 결과 보고에 그대로 붙인다. 실패한 검증을 "완료"로 보고하지 않는다
- 기존 코드의 패턴을 먼저 읽고 맞춘다. 특히 다음은 **새로 만들지 말고 재사용**한다:
  - 인증: 전역 Guard(`apps/api/src/guards/`). 새 라우트는 기본으로 인증 필요 — `@Public()`을 붙이지 않는다
  - 이미지 업로드: `apps/api/src/storage/`(StorageClient, `detectImageFormat`), `apps/api/src/teams/card-image-upload.interceptor.ts`, `team-card-image.service.ts`의 "검증 → 업로드 → DB 반영 → 실패 시 보상 삭제" 흐름
  - 에러 응답·Prisma 에러 매핑: `apps/api/src/common/` (`prisma-error.ts`, `http-messages.ts`, `trim.transform.ts`)
  - 관리자 프론트: `src/lib/api/client.ts`(API 호출), `src/lib/query-keys.ts`, `src/components/layout/*`(page-header, page-states), shadcn/ui 컴포넌트, RHF + Zod 스키마 패턴(`src/lib/teams/team-schema.ts`)
- 환경변수를 추가하면 해당 앱의 `.env.example`에 **키 이름과 설명만** 추가한다 (기존 주석 스타일 그대로). 실제 값은 사용자가 넣는다
- **각 작업을 시작할 때 맨 먼저 "4. 사용자 작업 체크포인트"의 해당 작업 착수 전 항목을 점검한다.** 준비되지 않은 항목이 있으면 구현을 시작하지 말고, 그 항목의 안내(U1~U5)를 사용자에게 그대로 전달한 뒤 완료 확인을 기다린다

---

## 1. 설계 결정

### D1. 공개 사이트 캐시 방식 — `cacheComponents`를 켜지 않는다

- **결정**: Next 16의 `cacheComponents`(+ `"use cache"`)를 **켜지 않고**, 공연 콘텐츠 조회에만 **태그가 붙은 `fetch` 캐시**(`cache: "force-cache"`, `next: { tags, revalidate }`)를 쓴다
- **근거**:
  - `cacheComponents`는 앱 전체의 렌더링 모델을 바꾼다. 캐시되지 않은 데이터를 `<Suspense>` 밖에서 읽는 기존 페이지(`setlist`, `event-goods` — no-store 조회)가 전부 영향을 받아 work01 성능 작업을 다시 건드리게 된다
  - `unstable_cache`는 Next 16 문서에서 "`use cache`로 대체됨"으로 표시돼 새 코드에 쓰지 않는다
  - supabase-js는 `global.fetch`를 주입할 수 있으므로, 태그를 실은 fetch로 PostgREST 요청을 캐시할 수 있다 (`node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md` "Tagging cached data")
- **구현**:
  - 신규 `src/lib/supabase-content.ts`: `createContentClient(tags: ContentTag[])` — 기존 `supabase.ts`와 같은 URL·anon key로 클라이언트를 만들되, fetch를 `fetch(input, { ...init, cache: "force-cache", next: { tags, revalidate: CONTENT_REVALIDATE_SECONDS } })`로 감싼다. 기존 `src/lib/supabase.ts`는 **수정하지 않는다**
  - `CONTENT_REVALIDATE_SECONDS = 3600` — 재검증 호출이 실패했을 때의 안전망(최대 1시간 뒤 자동 갱신)
  - 신규 `src/lib/concert-content.ts`: 페이지가 쓰는 조회 함수 모음(`getConcert`, `getVenue`, `getPerformanceDays`, `getTicket`, `getInfoSections(category)`, `getLineupForBooking`). 각 함수는 자신이 읽는 테이블의 태그로 `createContentClient`를 호출한다. 같은 렌더링 안 중복 호출은 React `cache`로 감싼다
  - `src/lib/supabase-content.ts`·`concert-content.ts`는 `import "server-only"`로 서버 전용임을 강제한다. 루트에 `server-only` 패키지가 없으므로 T5에서 `npm install server-only`로 추가한다 (이 의존성 추가는 승인됨)

### D2. 캐시 태그와 페이지 매핑

| 태그 | 데이터 | 이 태그를 쓰는 공개 페이지 | 이 태그를 무효화하는 저장 |
| --- | --- | --- | --- |
| `concert` | Concert (제목·날짜·포스터·타이틀 이미지) | 포스터를 배경으로 쓰는 **모든 페이지·레이아웃**, Home, Ticket Info | 공연 기본 정보 저장·이미지 교체 |
| `venue` | Venue | Home, Ticket Info, Contact Us(`location`), Stage Info 섹션 | 공연장 정보 저장 |
| `performance-days` | PerformanceDay | Time Table, 예매하기(`book`) | 일차별 공연 저장·타임 테이블 이미지 교체 |
| `ticket` | Ticket | Ticket Info | 티켓 저장·이미지 교체 |
| `info-sections` | InfoSection + InfoItem | Ticket Info(category=ticket), 관람 유의사항(category=notice) | 요금 안내·유의사항 저장 |
| `lineup` | LineUp (예매하기 출연진 자동 모드 전용 조회) | 예매하기(`book`) | **팀 등록·수정·재정렬** (기존 F003~F006) |

- 태그 문자열은 공개 사이트 `src/lib/content-tags.ts`와 API `src/revalidation/content-tags.ts`에 **같은 값**으로 상수 정의한다 (두 앱은 코드를 공유하지 않으므로 양쪽 주석에 서로를 가리키는 경로를 적는다)
- 셋리스트(`setlist`, `event-goods`)의 팀·곡 조회는 **기존 no-store를 그대로 둔다** — 이번 범위가 아니다. `lineup` 태그는 예매하기 출연진 조회에만 쓴다

### D3. 공개 사이트 재검증 엔드포인트

- `src/app/api/revalidate/route.ts` — `POST`만 허용
- 요청: 헤더 `x-revalidate-secret: <REVALIDATE_SECRET>`, 본문 `{ "tags": ContentTag[] }`
- 처리:
  1. 시크릿 검증 — `crypto.timingSafeEqual`로 비교. 환경변수 미설정이면 항상 거부(fail-closed). 실패 시 401, 본문에 이유를 쓰지 않는다
  2. 본문 검증 — `tags`가 D2 허용 목록의 부분집합인지 확인. 아니면 400
  3. 각 태그에 `revalidateTag(tag, { expire: 0 })` — **`"max"`가 아니라 `{ expire: 0 }`인 이유**: `"max"`는 stale-while-revalidate라 저장 후 첫 방문자가 옛 값을 본다. 외부 시스템(NestJS)이 Route Handler를 호출해 즉시 만료가 필요한 경우 문서가 `{ expire: 0 }`을 권장한다 (`03-api-reference/04-functions/revalidateTag.md`). `updateTag`는 Server Action 전용이라 쓸 수 없다
  4. 200 `{ "revalidated": true, "tags": [...] }`
- 환경변수: `REVALIDATE_SECRET` (서버 전용 — `NEXT_PUBLIC_` 접두어 금지). 루트에는 `.env.example`이 없으므로 새로 만들지 않고, `CLAUDE.md` "환경설정" 섹션의 코드 블록에 키를 추가하고 "서버 전용, API의 같은 키와 동일 값" 설명을 붙인다. Vercel 대시보드 등록은 사용자 작업으로 보고한다

### D4. API 측 재검증 호출

- 신규 모듈 `apps/api/src/revalidation/` — `RevalidationService.revalidate(tags: ContentTag[]): Promise<boolean>`
  - `PUBLIC_SITE_URL` + `/api/revalidate`로 POST, 타임아웃 5초, 재시도 없음
  - **예외를 던지지 않는다.** 실패(네트워크·타임아웃·비 2xx)는 경고 로그를 남기고 `false`를 돌려준다. DB 저장은 이미 커밋됐으므로 롤백하지 않는다
  - 로그에 시크릿·요청 헤더를 남기지 않는다
- **호출 시점**: DB 트랜잭션이 커밋된 **뒤**. 트랜잭션 안에서 호출하지 않는다
- **응답 계약**: 공연 콘텐츠의 모든 저장·업로드 응답은 `{ data: <저장된 값>, revalidated: boolean }` 형태다. 관리자 프론트는 `revalidated === false`면 "저장됨 — 사이트 반영이 지연될 수 있습니다(최대 1시간)" 경고를 띄운다
- 팀 등록·수정·재정렬(`teams.service.ts`의 `create`, `update`, `reorder`)도 커밋 후 `lineup` 태그를 재검증한다. 이 세 API는 **기존 응답 형태를 바꾸지 않는다** (기존 프론트 호환) — 실패 시 로그만 남긴다
- 환경변수 (`apps/api/.env.example`에 추가):
  - `PUBLIC_SITE_URL` — 형식 `https://summit-concert.live` (끝 슬래시 없음). https만 허용하되 로컬 개발용 `http://localhost:*`는 허용
  - `REVALIDATE_SECRET` — 공개 사이트와 같은 값, 32자 이상. 생성 방법은 `JWT_SECRET` 주석과 같은 명령을 안내
  - 두 값이 없거나 형식이 틀리면 **서버가 기동하지 않는다** (`JWT_SECRET`과 같은 방침)

### D5. 데이터베이스 스키마

- **마이그레이션**: `apps/api/prisma/migrations/<timestamp>_add_concert_content/migration.sql`에 수작성 SQL, 롤백은 `apps/api/prisma/rollback/<timestamp>_add_concert_content.rollback.sql`. 기존 마이그레이션(`20260920120000_add_youtube_review_status`)의 주석 형식·`SET LOCAL lock_timeout` 관례를 따른다. **Codex는 `migrate deploy`를 실행하지 않는다** — 적용은 사용자가 한다
- **명명**: 테이블은 `AdminUser`처럼 PascalCase(따옴표), 컬럼은 camelCase. Prisma 모델명 = 테이블명이라 `@@map`이 필요 없게 한다
- **테이블** (PRD 데이터 모델 기준, 아래가 확정 컬럼):

| 테이블 | 컬럼 |
| --- | --- |
| `Venue` | `id` bigint PK · `name` text NOT NULL · `address` text NOT NULL · `addressDetail` text NULL · `latitude` numeric(9,6) NOT NULL · `longitude` numeric(9,6) NOT NULL · `naverMapUrl` text NULL · `websiteUrl` text NULL · `updatedAt` timestamptz NOT NULL default now() |
| `Concert` | `id` bigint PK **CHECK (id = 1)** · `titleKo` text NOT NULL · `titleEn` text NOT NULL · `subtitle` text NULL · `startDate` date NOT NULL · `endDate` date NOT NULL · `showTime` text NOT NULL (예: `18:00 ~ 21:00`) · `posterImageUrl` text NULL · `titleImageUrl` text NULL · `subtitleImageUrl` text NULL · `venueId` bigint NOT NULL FK → Venue · `updatedAt` · CHECK (`endDate` >= `startDate`) |
| `PerformanceDay` | `id` bigint PK · `dayKey` text NOT NULL **UNIQUE** (LineUp.day와 같은 `day1`, `day2` 형식) · `dayLabel` text NOT NULL · `dateLabel` text NOT NULL · `bookingUrl` text NULL · `lineupOverride` text NULL · `timetableImageUrl` text NULL · `updatedAt` |
| `Ticket` | `id` bigint PK **CHECK (id = 1)** · `frontImageUrl` text NULL · `backImageUrl` text NULL · `description` text NULL · `updatedAt` |
| `InfoSection` | `id` bigint PK · `category` enum `info_section_category`('ticket','notice') NOT NULL · `title` text NOT NULL · `sortOrder` int NOT NULL · UNIQUE(`category`, `sortOrder`) DEFERRABLE INITIALLY DEFERRED |
| `InfoItem` | `id` bigint PK · `sectionId` bigint NOT NULL FK → InfoSection **ON DELETE CASCADE** · `content` text NOT NULL · `sortOrder` int NOT NULL · UNIQUE(`sectionId`, `sortOrder`) DEFERRABLE INITIALLY DEFERRED |

- **단일 행 보장**: Concert·Ticket은 `CHECK (id = 1)`로 1행만 존재한다. API는 `id = 1`을 조회·수정만 하고 생성·삭제 API는 없다
- **임시값 행 생성** (PRD 확정 #7): 같은 마이그레이션에서 Venue 1행, Concert(id=1) 1행, Ticket(id=1) 1행, PerformanceDay `day1`·`day2` 2행을 INSERT한다. 텍스트는 `"(입력 필요)"` 같은 명백한 임시값, 이미지 URL은 NULL, 좌표는 현재 `naver-map.tsx` 상수(37.552555, 126.91899). InfoSection/InfoItem은 비워 둔다. **현재 하드코딩 값을 옮겨 적지 않는다** — 실제 값은 T6에서 사용자가 어드민으로 입력한다
- **RLS**: 6개 테이블 모두 `ENABLE ROW LEVEL SECURITY` + anon 읽기 정책 `CREATE POLICY "<테이블> anon select" ON "<테이블>" FOR SELECT TO anon USING (true)`. INSERT/UPDATE/DELETE 정책은 만들지 않는다 (API는 RLS를 우회하는 `postgres` 계정으로 쓴다)
- `schema.prisma`에 모델 추가 후 `npx prisma generate`만 실행한다 (`prisma/schema.prisma` 주석 관례 유지)

### D6. 관리 API 계약

모든 라우트는 인증 필요(전역 Guard). 저장·업로드 응답은 D4의 `{ data, revalidated }` 형태. 입력 검증은 class-validator DTO + `TrimString`, 메시지는 한국어.

| 메서드·경로 | 기능 | 비고 |
| --- | --- | --- |
| `GET /concert` | 공연 기본 정보 + 공연장 요약 조회 | F014 |
| `PUT /concert` | `titleKo`·`titleEn`(필수) · `subtitle` · `startDate`·`endDate`(YYYY-MM-DD) · `showTime` 수정 | 태그 `concert` |
| `PUT /concert/images/:slot` | `slot` = `poster` \| `title` \| `subtitle`. 이미지 교체 | 태그 `concert` |
| `GET /venue` / `PUT /venue` | 공연장 이름·주소·상세 주소·좌표·링크 수정. URL은 https 형식 검사 | F016·F018, 태그 `venue` |
| `POST /venue/geocode` | 본문 `{ address }` → `{ latitude, longitude, roadAddress }`. 결과 없으면 404 + "주소를 다시 확인하거나 지도에서 직접 위치를 지정해 주세요" | F017, **DB에 쓰지 않음** |
| `GET /performance-days` | 일차 목록 + 일차별 자동 출연진 미리보기(`autoLineup: string[]`, LineUp에서 day 일치·performanceOrder 순) | F019 |
| `PUT /performance-days/:dayKey` | `dayLabel`·`dateLabel`·`bookingUrl`·`lineupOverride`(null = 자동 모드) | 태그 `performance-days` |
| `PUT /performance-days/:dayKey/timetable-image` | 타임 테이블 이미지 교체 | F020, 태그 `performance-days` |
| `GET /ticket` / `PUT /ticket` | 티켓 설명 수정 | F021, 태그 `ticket` |
| `PUT /ticket/images/:side` | `side` = `front` \| `back` | F021, 태그 `ticket` |
| `GET /info-sections?category=ticket\|notice` | 섹션 + 항목을 sortOrder 순으로 조회 | F022·F023 |
| `PUT /info-sections?category=ticket\|notice` | 해당 category의 **섹션·항목 전체를 한 트랜잭션에서 교체**. 본문은 섹션 배열(각 섹션에 항목 배열), 배열 순서가 곧 sortOrder | 태그 `info-sections` |

- `info-sections`를 "전체 교체"로 정한 이유: 추가·삭제·순서 변경이 한 화면에서 섞이는 편집이라 항목별 API로 나누면 부분 실패 상태가 생긴다. 데이터가 수십 행 이하라 비용이 없다
- 이미지 업로드:
  - 공통 서비스 `apps/api/src/concert-images/`(또는 각 모듈 안 공용 함수)로 `team-card-image.service.ts`의 흐름을 재사용한다. 이미 있는 interceptor·`detectImageFormat`·`StorageClient`를 그대로 쓴다
  - 버킷은 기존 `SUPABASE_STORAGE_BUCKET`(team-cards)를 그대로 쓰고, 경로를 `concert/<slot>/<uuid>.<ext>`로 구분한다 (팀 카드는 `<teamId>/...`라 겹치지 않음). 덮어쓰기 금지 · 새 경로 업로드 · 옛 객체는 지우지 않는 기존 정책을 따른다
  - 크기 상한 `CONCERT_IMAGE_MAX_BYTES = 2MB` (버킷 상한과 같음. 현재 가장 큰 이미지가 티켓 535KB). 형식은 JPEG/PNG/WebP

### D7. 주소 → 좌표 (Geocoding)

- NestJS에서만 호출한다 (Client Secret 노출 금지). 신규 `apps/api/src/geocoding/` — `GeocodingService.geocode(address)`
- 엔드포인트·헤더 이름은 **구현 시 NCP(Naver Cloud Platform) Maps Geocoding 공식 문서를 확인**해서 쓴다. 추측으로 쓰지 않는다
- 타임아웃 5초, 실패 시 502/504 + 한국어 메시지 (기존 `STORAGE_TIMEOUT_MESSAGE` 패턴)
- 환경변수: `NAVER_MAP_CLIENT_ID`, `NAVER_MAP_CLIENT_SECRET` (`apps/api/.env.example`). 미설정이면 기동 실패
- 결과가 여러 개면 첫 번째를 쓴다. 관리자는 지도에서 보정할 수 있다

### D8. 관리자 프론트 지도 (CSP 예외)

- 관리자 앱은 `src/lib/csp.ts`에서 "서드파티 스크립트 0"을 원칙으로 둔다. 공연장 위치 보정(F017)은 네이버 지도 JavaScript API가 필요하므로 **이번에 처음으로 예외를 둔다**
- 결정: `NAVER_MAP_ORIGINS`를 상수로 정의하고 `script-src`·`img-src`·`connect-src`에 **필요한 네이버 지도 오리진만** 추가한다. 와일드카드는 쓰지 않는다
  - 필요한 오리진 목록은 구현 시 **브라우저 콘솔의 CSP 위반 메시지로 실측해서** 확정한다 (추측으로 넓게 열지 않는다). 확정한 목록과 확인 방법을 `csp.ts` 주석에 남긴다
  - `csp.ts`의 기존 테스트에 이 오리진들이 들어가는지 검증하는 케이스를 추가한다
- 지도 스크립트는 공연장 정보 페이지에서만 로드한다 (공개 사이트 `naver-map.tsx`의 로딩 방식 참고)
- 환경변수: `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` (`apps/admin`). NCP 콘솔에 관리자 도메인(로컬 `http://localhost:3010` 포함)을 웹 서비스 URL로 등록하는 것은 **사용자 작업** — 결과 보고에 안내한다

### D9. 관리자 프론트 화면

- 메뉴(`src/lib/nav.ts`): 기존 3개 뒤에 "공연 콘텐츠" 그룹을 추가한다. 경로는 `/concert`, `/venue`, `/performance-days`, `/ticket`, `/notice`. 그룹 표현 방식은 기존 sidebar 구조를 보고 최소 변경으로 한다
- 페이지는 기존 `(admin)/teams/page.tsx` + `components/teams/*-page-client.tsx` 구조를 따른다
- 폼: RHF + Zod. 스키마는 `src/lib/<도메인>/<도메인>-schema.ts`. URL은 https 형식 검사, 날짜는 종료일 ≥ 시작일
- 서버 상태: TanStack Query. **낙관적 업데이트 금지, 재시도 정책은 기존 `query-client.ts` 그대로**
- 저장 성공: 완료 표시 + "공개 페이지에서 확인" 링크(`NEXT_PUBLIC_PUBLIC_SITE_ORIGIN` + 해당 경로). `revalidated === false`면 D4의 경고
- 출연진(F019): 자동 모드 미리보기는 `GET /performance-days`의 `autoLineup`을 쉼표로 이어 표시. "직접 수정"을 누르면 자동 문구를 채운 textarea로 전환, 직접 수정 중에는 "팀 관리 변경이 자동 반영되지 않음" 경고 + "자동으로 되돌리기"(→ `lineupOverride: null`로 저장)
- 서버 문자열은 텍스트로만 렌더링한다 (`dangerouslySetInnerHTML` 금지 — 기존 CSP 주석의 방어 원칙)

### D10. 공개 사이트 전환

- 조회는 각 페이지(Server Component)에서 D1의 함수로 하고, 클라이언트 컴포넌트에는 props로 넘긴다 (`location/page.tsx` 패턴)
- 포스터: 포스터를 쓰는 10곳(`src/app/{page,book,desktop-404,location,notice,ticket-info,time-table}/page.tsx`, `src/app/{setlist,event-goods}/layout.tsx`, `src/components/ui/setlist-detail-modal.tsx`)을 `concert.posterImageUrl`로 교체. 중복을 줄이기 위해 배경 마크업을 공용 컴포넌트(예: `components/common/poster-background.tsx`)로 묶는 것은 허용하되, `priority`·`sizes`·`fill`은 기존 값 유지
- 이미지 URL이 NULL이면 해당 이미지를 렌더링하지 않는다 (포스터는 기존 어두운 오버레이 배경만 남김)
- 제목: Home = `titleKo`, Ticket Info 공연명 = `titleEn`. 타이틀 이미지 alt = `titleKo`(제목 이미지), `subtitle`(부제 이미지)
- 날짜 표기: Home `2026-06-25 ~ 2026-06-26`, Ticket Info `2026.06.25 ~ 06.26 / {showTime}` — 현재 표기 형식을 유지하는 포맷 함수를 만든다
- 지도(`naver-map.tsx`): 좌표·장소명·주소를 props로 받는다. 말풍선 HTML에 넣는 문자열은 **반드시 HTML 이스케이프**한다 (DB 값이 HTML로 해석되면 XSS)
- 예매하기 출연진: `lineupOverride`가 있으면 줄바꿈 그대로(`whitespace-pre-line`), 없으면 `lineup` 태그로 조회한 팀명을 performanceOrder 순으로 `, `로 연결
- `next.config.ts`의 `remotePatterns`는 이미 `**.supabase.co`를 허용하므로 수정하지 않는다

---

## 2. 작업 단위

순서대로 진행한다. 각 작업은 앞 작업의 PR이 `develop`에 머지된 뒤 시작한다.

### T1. 유튜브 연결 관리 단순화 — `feature/youtube-url-simplify`

- **범위 (API)**:
  - `youtube.module.ts`에서 배치·쿼터·스코어링·리뷰·유지보수 서비스와 `YoutubeRecommendationsController`를 제거하고, 관련 파일과 테스트를 삭제한다. `YOUTUBE_BATCH_API_KEY` 필수 검사도 제거하고 `.env.example`에서 해당 섹션을 지운다
  - `youtube-url.service.ts`: `youtubeReviewStatus` 쓰기와 `supersedeOpenAttempts` 호출을 제거한다
  - `songs.service.ts`: 곡명·가수 변경 시 `youtubeReviewStatus = 'pending'` 리셋을 제거한다
  - `song-response.ts`: 응답에서 `youtubeReviewStatus` 필드를 제거한다
  - **연결 해제 API 추가**: `DELETE /songs/:id/youtube-url` → `youtubeUrl = null`. (기존 `PUT`은 빈 값을 거부하므로 F025 "빈 값 저장 = 연결 해제"는 프론트가 빈 값일 때 DELETE를 호출하는 방식으로 구현한다)
  - `schema.prisma`의 유튜브 모델·enum·컬럼 정의는 **그대로 둔다** (DB와 일치 유지)
  - `scripts/youtube-cleanup.ts`는 **삭제하지 않는다** — 남은 추천 후보 정리에 쓴다. 실행하지 않는다 (사용자 확인 후 사용자가 실행)
- **범위 (Admin)**: `youtube` 페이지를 PRD F024·F025대로 다시 만든다 — 팀별로 묶인 곡 목록, 팀 필터, "미연결 곡만 보기", 현재 URL 새 탭 열기, 수정하기 → URL 입력 → 저장. 리뷰·배치 컴포넌트(`attempt-card`, `batch-*`, `candidate-card`, `reject-dialog`, `requeue-button`, `lib/youtube/review-state.ts`)와 `song-table.tsx`의 상태 배지, `csp.ts`의 `YOUTUBE_THUMBNAIL_ORIGIN`(더 이상 쓰지 않으면)을 제거
- **완료 기준**:
  - `apps/api`: `npm run build` · `npm run lint` · `npm test` 통과
  - `apps/admin`: `npm run build` · `npm run lint` · `npm test` 통과
  - `grep -rn "youtubeReviewStatus\|YOUTUBE_BATCH_API_KEY" apps/api/src apps/admin/src` 결과가 생성 코드(`generated/`)와 `scripts/youtube-cleanup.ts` 외에 없음
  - `YOUTUBE_BATCH_API_KEY` 없이 API 서버가 기동함

### T2. 공연 콘텐츠 스키마 — `feature/concert-content-schema`

- **범위**: D5의 마이그레이션 SQL + 롤백 SQL 작성, `schema.prisma` 모델 추가, `npx prisma generate`
- **완료 기준**:
  - 마이그레이션 SQL에 6개 테이블 · enum · FK · CHECK · UNIQUE · RLS + anon SELECT 정책 · 임시값 행 INSERT가 모두 있음
  - 롤백 SQL이 정확히 역순으로 제거함
  - `apps/api`: `npm run build` · `npm test` 통과
  - **결과 보고에 "사용자가 실행할 명령"(`migrate deploy`)과 적용 후 확인할 SQL(행 수·정책 목록)을 적는다.** Codex는 적용하지 않는다

### T3. 공연 콘텐츠 관리 API — `feature/concert-content-api`

- **선행 조건**: "4. 사용자 작업 체크포인트"의 T3 착수 전 항목 (U5 적용 완료, U2, U3-로컬)
- **범위**: D4(재검증 모듈 + 팀 저장 시 `lineup` 재검증), D6(전체 라우트), D7(Geocoding), 이미지 업로드
- **완료 기준**:
  - `apps/api`: `npm run build` · `npm run lint` · `npm test` 통과
  - 새 서비스마다 단위 테스트: 검증 실패(400) · 없는 일차(404) · 저장 후 재검증 호출 · **재검증 실패 시에도 저장 성공 + `revalidated: false`** · 트랜잭션 안에서 재검증을 호출하지 않음 · info-sections 전체 교체의 원자성
  - 미인증 요청이 401인지 확인하는 테스트(기존 패턴)

### T4. 공연 콘텐츠 관리 화면 — `feature/concert-content-admin`

- **선행 조건**: T3 머지 + "4. 사용자 작업 체크포인트"의 T4 착수 전 항목 (U2 어드민 도메인 등록, U4-로컬)
- **범위**: D8(CSP·지도), D9(메뉴·5개 페이지)
- **완료 기준**:
  - `apps/admin`: `npm run build` · `npm run lint` · `npm test` 통과
  - Zod 스키마 단위 테스트 (URL 형식, 날짜 순서, 필수값)
  - 로컬에서 API + admin을 띄우고 5개 페이지 저장이 동작하는지 확인. 공연장 페이지에서 위치 찾기 → 마커 보정 → 저장 흐름과 CSP 위반이 없는지 브라우저 콘솔로 확인. 확인 결과(스크린샷 또는 콘솔 로그)를 보고에 첨부

### T5. 공개 사이트 DB 조회 전환 — `feature/concert-content-public`

- **선행 조건**: T4 머지 + U1-로컬. 이 브랜치는 **T6(실제 데이터 입력)이 끝날 때까지 PR을 머지하지 않는다** — 머지하면 임시값이 공개 사이트에 노출된다
- **범위**: D1·D2·D3·D10. 하드코딩된 공연 정보(제목·장소·날짜·포스터·타임 테이블·티켓·유의사항·예매 링크·출연진·지도 좌표·네이버 지도 링크·Stage Info URL)를 모두 DB 조회로 교체
- **완료 기준**:
  - 루트: `npm run build` · `npm run lint` 통과. build 출력에서 콘텐츠 페이지의 렌더링 방식(정적/ISR vs 동적)을 보고에 적는다
  - `npm run build && npm start`로 로컬 프로덕션 실행 후: ① 페이지 표시 ② `curl -X POST /api/revalidate`(올바른 시크릿) 후 DB 변경값이 다음 요청에 반영 ③ 잘못된 시크릿 401 ④ 허용 목록 밖 태그 400
  - 지도 말풍선에 `<b>test</b>` 같은 값을 넣어도 HTML로 해석되지 않음
  - `source-command-perf-check`로 측정이 필요하다고 사용자에게 알린다 (측정 자체는 사용자가 호출)

### T6. 실제 데이터 입력 — 사용자 작업 (최후순위)

- 사용자가 어드민에서 실제 공연 정보를 입력한다. 주소 불일치("마포구 양화로 100-10" vs "관악구 남부순환로 1937")의 정답은 이때 사용자가 정한다
- 입력이 끝나면 T5 PR을 머지·배포한다

### T7. 유튜브 DB 객체 제거 — 후속 (work05 배포·안정화 후)

- 별도 지시가 있을 때만 착수한다. 수작성 DROP SQL + 롤백 SQL, `schema.prisma`에서 모델·enum·컬럼 제거. 적용은 사용자가 `migrate deploy`로 한다
- 그 전에 남은 추천 후보 행 정리(`youtube-cleanup` 스크립트)는 사용자 확인 후 실행한다

---

## 3. 결과 보고 형식 (작업 단위마다)

1. 변경 요약 (무엇을, 왜)
2. 변경 파일 목록
3. 완료 기준별 통과 여부 + 검증 명령 출력
4. 명세와 다르게 한 부분과 이유 (없으면 "없음")
5. 사용자가 해야 할 일 — "4. 사용자 작업 체크포인트"에서 이 작업의 **완료 후** 항목과 **다음 작업의 착수 전** 항목을 U1~U5 안내와 함께 적는다

---

## 4. 사용자 작업 체크포인트

Codex가 대신할 수 없는 작업(시크릿 입력, 외부 콘솔 설정, 프로덕션 DB 적용)이다. Codex는 아래 표에 따라 **착수 전에 점검하고, 완료 후에 안내한다.**

| 작업 | 착수 전 (준비 안 됐으면 구현 시작 금지) | 완료 후 (결과 보고에 안내) |
| --- | --- | --- |
| T1 | 없음 | 없음 |
| T2 | 없음 | **U5** 마이그레이션 적용 → 적용 확인 후 PR 머지 |
| T3 | U5 적용 완료 (`npx prisma migrate status`가 up to date) · **U2**(NCP 키 발급) · **U3-로컬**(`apps/api/.env` 4개 키) | **U3-서버**: 서버 `.env`를 **T3 배포 전에** 채울 것 (키가 없으면 서버가 기동하지 않음) |
| T4 | **U2**(어드민 도메인 등록) · **U4-로컬** | **U4-Vercel** |
| T5 | **U1-로컬** | **U1-Vercel** · T6(실제 데이터 입력) 완료 전 머지 금지 |

### 점검 방법 (값을 출력하지 않는다)

- 환경변수는 **키가 있고 값이 비어 있지 않은지만** 확인한다. 값을 출력·로그·보고에 남기지 않는다
  - 예: `grep -cE '^REVALIDATE_SECRET=.+' apps/api/.env` → `1`이면 준비됨, `0`이면 미준비
- 마이그레이션은 `cd apps/api && npx prisma migrate status`로 확인한다 (읽기 전용 명령)
- NCP 설정·Vercel 대시보드·서버 `.env`는 Codex가 확인할 수 없으므로 **사용자에게 완료 여부를 물어서** 확인한다

### U1. 공개 사이트 `REVALIDATE_SECRET`

1. 값 생성 (한 번, 로컬용·배포용 각각 따로 만드는 것을 권장):
   `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`
2. **로컬**: 루트 `.env.local`에 `REVALIDATE_SECRET=<로컬용 값>` — `apps/api/.env`의 `REVALIDATE_SECRET`과 **같은 값**
3. **Vercel**: 공개 사이트 프로젝트 → Settings → Environment Variables → `REVALIDATE_SECRET` = 배포용 값 (Production). 서버 `/opt/summit-api/.env`와 **같은 값**. 다음 배포부터 적용된다
4. `NEXT_PUBLIC_` 접두어를 붙이지 않는다

### U2. 네이버 클라우드(NCP) 설정

공개 사이트가 이미 쓰는 Maps Application을 수정한다 (새로 만들지 않음 — Client ID 하나로 공개 지도·어드민 지도·Geocoding 공용).

1. https://console.ncloud.com → Services → Application Services → Maps → Application
2. 공개 사이트 Client ID와 같은 Application 선택 → **변경**
3. API 선택: `Dynamic Map`(기존) + **`Geocoding` 체크**
4. 서비스 환경 → Web 서비스 URL에 추가: `http://localhost:3010`, 어드민 배포 도메인(Vercel 관리자 프로젝트 → Settings → Domains). 기존 공개 사이트 URL은 유지
5. 저장 → 인증 정보에서 Client ID / Client Secret 확인 (U3·U4에서 사용)
6. Geocoding 무료 이용량·요금을 콘솔에서 확인
- 콘솔 메뉴명은 NCP 개편에 따라 다를 수 있다

### U3. 관리자 API 환경변수

| 키 | 로컬 `apps/api/.env` | 서버 `/opt/summit-api/.env` |
| --- | --- | --- |
| `PUBLIC_SITE_URL` | `http://localhost:3000` | `https://summit-concert.live` (끝 슬래시 없음. `curl -I`로 www 리다이렉트 여부 확인 후 최종 주소) |
| `REVALIDATE_SECRET` | U1 로컬 값 | U1 배포 값 |
| `NAVER_MAP_CLIENT_ID` | U2 Client ID | 같음 |
| `NAVER_MAP_CLIENT_SECRET` | U2 Client Secret | 같음 |

- 서버 반영: `sudo nano /opt/summit-api/.env` → 저장 → T3 코드 배포 → `sudo systemctl restart summit-api` → `sudo systemctl status summit-api` → `curl https://api.summit-concert.live/health`
- **순서 주의**: 서버 `.env`를 먼저 채우고 T3 코드를 배포한다. 반대로 하면 기동 실패로 재시작 루프에 빠진다

### U4. 관리자 프론트 환경변수

- **로컬**: `apps/admin/.env.local`에 `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=<U2 Client ID>`
- **Vercel**: 관리자 프로젝트 → Settings → Environment Variables에 같은 키·값 → 재배포해야 반영 (빌드 시점에 번들에 들어감)
- Client Secret은 절대 넣지 않는다

### U5. T2 마이그레이션 적용 (로컬 `apps/api`에서, `DATABASE_URL`이 프로덕션을 가리킴)

1. T2 PR의 SQL 검토 (Claude Code에 검토 요청 가능)
2. `cd apps/api && npx prisma migrate status` → `..._add_concert_content` **1개만** 미적용인지 확인. 다른 항목이 있으면 중단
3. `npx prisma migrate deploy` (**`migrate dev` 금지**)
4. `npx prisma migrate status` → `Database schema is up to date!`
5. Supabase SQL Editor에서 확인:
   ```sql
   select 'Venue', count(*) from "Venue" union all
   select 'Concert', count(*) from "Concert" union all
   select 'Ticket', count(*) from "Ticket" union all
   select 'PerformanceDay', count(*) from "PerformanceDay" union all
   select 'InfoSection', count(*) from "InfoSection";
   -- 기대값: 1, 1, 1, 2, 0

   select relname, relrowsecurity from pg_class
   where relname in ('Venue','Concert','Ticket','PerformanceDay','InfoSection','InfoItem');
   -- 기대값: 6개 모두 true

   select tablename, policyname, roles, cmd from pg_policies
   where tablename in ('Venue','Concert','Ticket','PerformanceDay','InfoSection','InfoItem');
   -- 기대값: 테이블마다 anon SELECT 1개
   ```
6. 문제가 있으면 롤백 SQL을 임의로 실행하지 않고 먼저 보고한다 (롤백 시 `_prisma_migrations` 이력도 함께 맞춰야 함 — REFACTOR_NOTES §9 "작업 중 발생한 이슈")
7. 확인 후 T2 PR 머지 → T3 착수
