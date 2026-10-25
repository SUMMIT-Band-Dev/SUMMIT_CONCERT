---
spec_id: WORK05-T5A
revision: 1
---

# WORK05-T5A — 공개 사이트 공연 콘텐츠 조회 계층 + 재검증 엔드포인트

## 배경

- work05는 공개 사이트에 하드코딩된 공연 정보를 DB 한 곳에서 관리하도록 옮기는 작업이다 (`docs/specs/prd-construction.md`, `.claude/rules/work-05-construction.md`). 관리 API(T3A·T3B)와 관리자 화면(T4A·T4B)은 배포됐다. 공개 사이트는 아직 하드코딩 값을 쓴다
- 이 명세는 `docs/specs/work05-implementation.md` **T5의 앞부분**이다. D1(캐시 방식)·D2(태그)·D3(재검증 엔드포인트)의 **기반만** 만들고, **페이지는 바꾸지 않는다**. 포스터 10곳과 공개 페이지 전환(D10)은 다음 명세 WORK05-T5B에서 다룬다. 두 문서가 다르면 **이 명세가 우선**한다
- 이렇게 나누는 이유: 화면에 변화가 없으므로 T6(실제 데이터 입력) 전에도 머지·배포할 수 있다. 배포되면 관리자 저장 응답의 `revalidated`가 `true`가 되어 재검증 경로를 먼저 실제로 확인할 수 있다
- 호출하는 쪽 계약 (`apps/api/src/revalidation/`, 배포됨)
  - `RevalidationService.revalidate(tags)`는 `POST ${PUBLIC_SITE_URL}/api/revalidate`를 호출한다. 헤더 `content-type: application/json`, `x-revalidate-secret: <REVALIDATE_SECRET>`, 본문 `{ "tags": [...] }`(중복 제거, 빈 배열이면 호출하지 않음), `redirect: 'error'`, 타임아웃 5초. 2xx면 성공이다
  - 태그 목록 `content-tags.ts`: `concert`, `venue`, `performance-days`, `ticket`, `info-sections`, `lineup` (주석이 "공개 사이트 `src/lib/content-tags.ts`(T5에서 생성)와 같은 값"이라고 가리킨다)
- Next.js 16.2.4 문서 확인 (`node_modules/next/dist/docs/01-app/`)
  - `03-api-reference/04-functions/revalidateTag.md`: 시그니처 `revalidateTag(tag: string, profile: string | { expire?: number })`. Route Handler에서 호출할 수 있다. 인자 하나짜리 형태는 deprecated다. "외부 시스템이 Route Handler를 호출해 즉시 만료가 필요하면 `{ expire: 0 }`"을 쓴다. `"max"`는 stale-while-revalidate라 저장 직후 첫 방문자가 옛 값을 본다
  - `02-guides/caching-without-cache-components.md` "Tagging cached data": `fetch(url, { next: { tags } })`로 태그를 붙인다. `unstable_cache`는 새 코드에 쓰지 않는다 (D1)
- 공개 사이트 현황
  - `src/lib/supabase.ts`는 모든 요청을 `no-store`로 고정한다 (셋리스트용, **바꾸지 않는다**). `next.config.ts`에 `cacheComponents`가 없다 (D1 — 켜지 않는다)
  - 테이블·컬럼 (Prisma `apps/api/prisma/schema.prisma` 기준, PostgREST로 같은 이름이 보인다): `"Concert"`(`id`=1, `titleKo`·`titleEn`·`subtitle`·`startDate`·`endDate`(date)·`showTime`·`posterImageUrl`·`titleImageUrl`·`subtitleImageUrl`·`venueId`), `"Venue"`(`name`·`address`·`addressDetail`·`latitude`·`longitude`(numeric(9,6))·`naverMapUrl`·`websiteUrl`), `"PerformanceDay"`(`dayKey`·`dayLabel`·`dateLabel`·`bookingUrl`·`lineupOverride`·`timetableImageUrl`), `"Ticket"`(`id`=1, `frontImageUrl`·`backImageUrl`·`description`), `"InfoSection"`(`category`·`title`·`sortOrder`), `"InfoItem"`(`sectionId`·`content`·`sortOrder`), `"Line Up"`(`team_name`·`day`·`performanceOrder`). 새 6개 테이블은 anon SELECT 정책이 있다 (T2)
  - 루트 앱에는 테스트 러너가 없다(`package.json` scripts: dev·build·start·lint·typecheck). 루트 CI는 `npm run lint`·`npm run typecheck`만 실행한다. 순수 함수는 **Node 24의 TypeScript 실행(type stripping)**으로 확인한다. 별칭(`@/`)·다른 파일 import가 없는 `.ts` 모듈은 `node --input-type=module -e "await import('./src/lib/x.ts')"`로 직접 불러올 수 있다 (2026-10-25 로컬 Node v24.12.0에서 확인)
  - `REVALIDATE_SECRET`은 로컬 루트 `.env.local`과 공개 사이트 Vercel에 이미 들어 있다(U1 완료). API 쪽 `apps/api/.env`·서버 `.env`에도 같은 값이 있다

## 범위

**포함** (모두 저장소 루트의 공개 사이트)

- 의존성: `package.json`·`package-lock.json`에 `server-only` 추가 (`npm install server-only`, D1에서 승인됨). 다른 의존성은 추가하지 않는다
- 신규 `src/lib/content-tags.ts` — 태그 상수·타입·요청 본문 검사 (순수, import 없음)
- 신규 `src/lib/revalidate-secret.ts` — 시크릿 비교 (순수, `node:crypto`만 import)
- 신규 `src/lib/concert-content-format.ts` — 날짜·출연진 표기 함수 (순수, import 없음)
- 신규 `src/lib/supabase-content.ts` — 태그 캐시 클라이언트 (`server-only`)
- 신규 `src/lib/concert-content.ts` — 조회 함수 (`server-only`)
- 신규 `src/types/concert-content.ts` — 조회 결과 타입
- 신규 `src/app/api/revalidate/route.ts` — 재검증 Route Handler

**제외**

- 페이지·레이아웃·컴포넌트 변경(`src/app/**/page.tsx`, `layout.tsx`, `src/components/**`), 포스터·지도 교체 → WORK05-T5B
- `src/lib/supabase.ts`, `src/lib/fetch-line-up-and-setlist.ts`, `next.config.ts` (셋리스트 no-store 유지, `cacheComponents` 켜지 않음)
- `apps/api/`, `apps/admin/`
- 테스트 러너(vitest 등) 추가 — 순수 함수는 테스트 계획의 Node 명령으로 확인한다
- `CLAUDE.md` "환경설정"에 `REVALIDATE_SECRET` 설명 추가(D3), `work05-implementation.md` 갱신 — 정책 경로·명세 문서라 **머지 후 일반 브랜치 PR로 처리**한다 (Claude가 맡는다)

## 설계 결정

### 1. 태그 (`src/lib/content-tags.ts`)

- `export const CONTENT_TAGS = ["concert", "venue", "performance-days", "ticket", "info-sections", "lineup"] as const;`, `export type ContentTag = (typeof CONTENT_TAGS)[number];` — API `apps/api/src/revalidation/content-tags.ts`와 **같은 값·같은 순서**다. 첫 주석에 서로를 가리키는 경로를 적는다
- `parseRevalidateTags(body: unknown): ContentTag[] | null`
  - `body`가 객체이고 `tags`가 배열이며, 길이가 1 이상 `CONTENT_TAGS.length` 이하이고, 모든 원소가 `CONTENT_TAGS`에 있는 문자열이면 **중복을 제거한** 배열을 돌려준다(처음 나온 순서 유지)
  - 그 밖(배열 아님, 빈 배열, 모르는 태그, 문자열 아닌 원소, 너무 김, `null`)은 `null`이다. 대소문자를 바꾸거나 공백을 지우지 않는다(정확히 같은 값만 허용)
- 이 파일은 **아무것도 import하지 않는다** (Node 직접 실행 확인용)

### 2. 시크릿 비교 (`src/lib/revalidate-secret.ts`)

- `isValidRevalidateSecret(provided: string | null | undefined, expected: string | undefined): boolean`
  - `expected`를 trim한 값이 비어 있으면 **항상 `false`** (환경변수 미설정 시 fail-closed)
  - `provided`가 문자열이 아니거나 비어 있으면 `false`
  - 두 값을 각각 `createHash("sha256")`으로 해시한 32바이트끼리 `timingSafeEqual`로 비교한다 (길이가 달라도 예외 없이 같은 시간에 비교)
- import는 `node:crypto`뿐이다. 시크릿 값은 어디에도 로그로 남기지 않는다

### 3. 재검증 Route Handler (`src/app/api/revalidate/route.ts`)

- `import "server-only"`. `export async function POST(request: Request)`만 내보낸다 (다른 메서드는 Next가 405로 응답)
- 처리 순서
  1. `isValidRevalidateSecret(request.headers.get("x-revalidate-secret"), process.env.REVALIDATE_SECRET)`가 거짓이면 **401** `{ "revalidated": false }` (이유를 본문에 쓰지 않는다)
  2. `await request.json()`이 실패하면 **400** `{ "revalidated": false }`
  3. `parseRevalidateTags(body)`가 `null`이면 **400** `{ "revalidated": false }`
  4. 각 태그에 `revalidateTag(tag, { expire: 0 })` — **`"max"`를 쓰지 않는 이유**를 주석으로 남긴다 (위 "배경"의 문서 근거: 외부 시스템 호출 + 저장 직후 첫 방문자가 새 값을 봐야 함. `updateTag`는 Server Action 전용)
  5. **200** `{ "revalidated": true, "tags": [...] }`
- 시크릿 검사를 본문 해석보다 먼저 한다 (인증 안 된 요청의 본문을 읽지 않는다)
- 로그를 남기지 않는다(`console.*` 없음). 응답에 환경변수 값·요청 헤더를 넣지 않는다
- `REVALIDATE_SECRET`은 서버 전용이다 — `NEXT_PUBLIC_` 접두어를 쓰지 않는다

### 4. 태그 캐시 클라이언트 (`src/lib/supabase-content.ts`)

- `import "server-only"`. `CONTENT_REVALIDATE_SECONDS = 3600`을 export한다 — 재검증 호출이 실패했을 때의 안전망(최대 1시간 뒤 자동 갱신)이라는 주석을 단다
- `createContentClient(tags: readonly ContentTag[])`: 기존 `supabase.ts`와 같은 `NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_ANON_KEY`로 `createClient`를 만든다. `global.fetch`를 다음으로 감싼다

```ts
fetch: (input, init = {}) =>
  fetch(input, {
    ...init,
    cache: "force-cache",
    next: { tags: [...tags], revalidate: CONTENT_REVALIDATE_SECONDS },
  }),
```

- 세션을 쓰지 않으므로 `auth: { persistSession: false, autoRefreshToken: false }`를 준다. `supabase.ts`처럼 `cache-control: no-cache` 헤더를 넣지 **않는다**(캐시를 쓰는 클라이언트다)
- 주석에 `supabase.ts`(no-store, 셋리스트용)와 무엇이 다른지 한 줄로 적는다

### 5. 조회 함수 (`src/lib/concert-content.ts`, 타입은 `src/types/concert-content.ts`)

`import "server-only"`. 모든 함수는 React `cache`로 감싸 같은 렌더링 안의 중복 호출을 합친다. 각 함수는 **자신이 읽는 테이블의 태그**로 `createContentClient`를 만든다.

| 함수 | 태그 | 조회 | 반환 |
| --- | --- | --- | --- |
| `getConcert()` | `concert` | `"Concert"` `id = 1`, 컬럼 `titleKo, titleEn, subtitle, startDate, endDate, showTime, posterImageUrl, titleImageUrl, subtitleImageUrl` | `ConcertContent` |
| `getVenue()` | `concert`, `venue` | `"Concert"` `id = 1`의 `venueId`가 가리키는 `"Venue"` 한 행. 컬럼 `name, address, addressDetail, latitude, longitude, naverMapUrl, websiteUrl` (임베드 `venue:Venue(...)` 또는 두 번 조회 중 구현자가 고른다) | `VenueContent` |
| `getPerformanceDays()` | `performance-days` | `"PerformanceDay"` 전체, 컬럼 `dayKey, dayLabel, dateLabel, bookingUrl, lineupOverride, timetableImageUrl` | `PerformanceDayContent[]` — `dayKey`의 숫자(`day2` → 2) 오름차순. `dayN` 형식이 아니면 뒤로 보내고 그 안에서는 문자열 순 |
| `getTicket()` | `ticket` | `"Ticket"` `id = 1`, 컬럼 `frontImageUrl, backImageUrl, description` | `TicketContent` |
| `getInfoSections(category)` | `info-sections` | `"InfoSection"` `category = <category>`, 항목 `"InfoItem"` 임베드 | `InfoSectionContent[]` = `{ title, items: string[] }[]` — 섹션은 `sortOrder` 오름차순, 항목도 `sortOrder` 오름차순(**JS에서 정렬**해 임베드 정렬 옵션 차이에 기대지 않는다) |
| `getLineupByDay()` | `lineup` | `"Line Up"`에서 `team_name, day, performanceOrder, id` | `Record<string, string[]>` — `day`가 `dayN` 형식인 행만, day별로 `performanceOrder` 오름차순(NULL은 뒤) → `id` 오름차순 정렬한 팀명(trim, 빈 값 제외). API `ConcertContentService.autoLineup`과 같은 정렬 |

- `category` 타입은 `"ticket" | "notice"`이고 상수 `INFO_CATEGORIES`로 둔다
- 타입은 `src/types/concert-content.ts`에 둔다 (`code-style.md` — 타입 정의는 `types/`). 선택 컬럼은 `string | null`, 날짜는 `"YYYY-MM-DD"` 문자열, 좌표는 `number`
- 응답 검증: PostgREST 응답을 그대로 단언(`as`)하지 않는다. 행을 하나씩 읽어 필수 문자열이 문자열인지 확인하고, 좌표는 `Number()` 후 유한수인지 확인한다. 선택 문자열은 `null`이거나 빈 값이면 `null`로 정규화한다
- 오류 처리
  - Supabase `error`가 있거나, 단일 행(`Concert`·`Ticket`·`Venue`)이 없거나, 필수 값 형식이 틀리면 `ConcertContentError`(이 파일에 정의, `Error` 상속)를 던진다. 메시지는 한국어로 "공연 콘텐츠를 불러오지 못했습니다: <조회 이름>"만 쓴다 — Supabase 오류 객체·URL·키를 메시지에 넣지 않는다
  - 던지는 이유를 주석으로 남긴다: 캐시된 페이지는 재검증 중 오류가 나면 직전 정상 결과를 유지하고, 첫 빌드에서는 실패가 드러나야 한다. 빈 값으로 대체해 잘못된 화면을 캐시하지 않는다
  - `getPerformanceDays`·`getInfoSections`·`getLineupByDay`의 0행은 오류가 아니다(빈 결과)
- 이 명세에서는 **어떤 페이지도 이 함수들을 호출하지 않는다** (T5B에서 연결)

### 6. 표기 함수 (`src/lib/concert-content-format.ts`)

현재 하드코딩된 표기 형식을 유지하는 순수 함수다. `Date` 객체·시간대를 쓰지 않고 `"YYYY-MM-DD"` 문자열을 잘라서 만든다. **아무것도 import하지 않는다.**

- `formatHomeDateRange(start, end)` — Home 표기
  - `("2026-06-25", "2026-06-26")` → `"2026-06-25 ~ 2026-06-26"`
  - 같은 날이면 `"2026-06-25"`
- `formatTicketDateRange(start, end, showTime)` — Ticket Info "일시" 표기
  - `("2026-06-25", "2026-06-26", "18:00 ~ 21:00")` → `"2026.06.25 ~ 06.26 / 18:00 ~ 21:00"` (같은 해면 종료일의 연도를 생략)
  - 해가 다르면 `"2026.12.31 ~ 2027.01.01 / …"`, 같은 날이면 `"2026.06.25 / …"`
  - `showTime`이 trim 후 비면 `" / "` 뒤를 생략한다
- `formatBookingLineup(lineupOverride, autoLineup)` — 예매하기 출연진 (D10)
  - `lineupOverride`가 trim 후 비어 있지 않으면 **원문 그대로**(줄바꿈 유지) 돌려준다
  - 아니면 `autoLineup.join(", ")`
- 날짜 인자가 `YYYY-MM-DD` 형식이 아니면 받은 문자열을 그대로 쓴다(예외를 던지지 않는다 — 표기 함수가 페이지를 깨뜨리지 않게)

## 수용 기준

- AC-01 루트 `package.json`의 `dependencies`에 `server-only`가 추가되어 있고, 그 밖의 의존성 추가·버전 변경이 없다 (`package-lock.json`은 이 변경만 반영)
- AC-02 `src/lib/content-tags.ts`의 `CONTENT_TAGS`가 `apps/api/src/revalidation/content-tags.ts`의 `CONTENT_TAGS`와 같은 값·같은 순서이고, 두 파일 주석이 서로를 가리킨다 (API 파일은 바꾸지 않는다 — 이미 가리키고 있다). 이 파일에 `import`가 없다
- AC-03 `parseRevalidateTags`가 테스트 계획의 Node 확인 명령에서 기대값을 출력한다: `{tags:["concert"]}` → `["concert"]`, `{tags:["venue","venue","lineup"]}` → `["venue","lineup"]`, `{tags:[]}`·`{tags:["Concert"]}`·`{tags:["unknown"]}`·`{tags:"concert"}`·`{tags:[1]}`·`null`·`{}` → `null`
- AC-04 `isValidRevalidateSecret`가 테스트 계획의 Node 확인 명령에서 기대값을 출력한다: 같은 값 → `true`, 다른 값·길이가 다른 값·`null`·`""` → `false`, `expected`가 `undefined`·`""`·공백뿐이면 `provided`와 무관하게 `false`. 구현이 `createHash("sha256")`과 `timingSafeEqual`을 쓴다
- AC-05 `src/app/api/revalidate/route.ts`가 `POST`만 export하고, 시크릿 검사 → JSON 해석 → `parseRevalidateTags` → 태그마다 `revalidateTag(tag, { expire: 0 })` 순서로 처리하며, 401·400 응답 본문이 `{ revalidated: false }`뿐이다. `"max"`를 쓰지 않는 이유가 주석에 있고 `console.`이 없다
- AC-06 `src/lib/supabase-content.ts`가 `import "server-only"`로 시작하고, fetch를 `cache: "force-cache"`와 `next: { tags, revalidate: CONTENT_REVALIDATE_SECONDS }`로 감싸며 `CONTENT_REVALIDATE_SECONDS === 3600`이다. `src/lib/supabase.ts`는 바뀌지 않았다
- AC-07 `src/lib/concert-content.ts`가 `import "server-only"`로 시작하고, 설계 결정 5 표의 함수 6개를 표의 태그로 `createContentClient`를 불러 구현하며, 각 함수가 React `cache`로 감싸져 있다. 응답을 통째로 `as` 단언하지 않고 행 단위로 검사한다
- AC-08 `getLineupByDay`의 정렬이 `performanceOrder` 오름차순(NULL 뒤) → `id` 오름차순이고 `dayN` 형식이 아닌 `day`를 제외한다. `getInfoSections`는 섹션·항목을 `sortOrder`로 JS에서 정렬한다. `getPerformanceDays`는 `dayKey`의 숫자 오름차순이다
- AC-09 조회 실패·단일 행 없음·필수 값 형식 오류에서 `ConcertContentError`를 던지고, 메시지에 Supabase 오류 객체·URL·키를 넣지 않는다
- AC-10 `formatHomeDateRange`·`formatTicketDateRange`·`formatBookingLineup`이 테스트 계획의 Node 확인 명령에서 설계 결정 6의 예시와 같은 값을 출력한다. 이 파일에 `import`와 `new Date`가 없다
- AC-11 루트에서 `npm run lint`·`npm run typecheck`가 통과한다
- AC-12 [manual] 루트에서 `npm run build`가 성공하고, 출력의 라우트 표에 `/api/revalidate`가 동적(ƒ) 라우트로 있으며, 다른 페이지의 렌더링 방식 표시는 변경 전 빌드와 같다. CI는 루트 빌드를 실행하지 않고 읽기 전용 리뷰는 PR 본문을 보지 못하므로, Codex는 변경 전·후 두 빌드의 라우트 표를 PR 본문에 붙이고 **사용자가 그 두 표를 비교하고 로컬 빌드 결과를 확인한다**
- AC-13 `origin/develop` 대비 변경 파일이 범위 "포함"의 파일뿐이다. `src/app/` 아래에서 바뀐 것은 `src/app/api/revalidate/route.ts` 추가뿐이고, `src/components/`·`src/lib/supabase.ts`·`next.config.ts`·`apps/`는 바뀌지 않았다
- AC-14 [manual] 로컬 프로덕션 실행(`npm run build && npm start`)에서 `/api/revalidate`가 올바른 시크릿 + `{"tags":["concert"]}`에 200 `{"revalidated":true,"tags":["concert"]}`, 틀린 시크릿에 401, 시크릿 없음에 401, `{"tags":["nope"]}`에 400, `GET`에 405로 응답한다
- AC-15 [manual] 로컬 공개 사이트(3000)·API(3001, `PUBLIC_SITE_URL=http://localhost:3000`)·관리자(3010)를 띄우고 관리자 `/ticket`에서 티켓 설명을 저장하면, 지연 경고 대신 "저장했습니다."가 뜬다 (`revalidated: true`)

## 테스트 계획

**커밋하기 전에** 실행하고 명령과 결과를 PR 본문에 남긴다. 새 파일은 `git add`로 스테이지한 뒤 실행한다.

```bash
# 저장소 루트 — 변경 범위 (AC-13)
git diff --cached --name-only origin/develop                          # 범위 "포함" 파일만
git diff --cached --name-only origin/develop -- src/components src/lib/supabase.ts src/lib/fetch-line-up-and-setlist.ts next.config.ts apps   # 출력 없음
git diff --cached --name-only --diff-filter=AM origin/develop -- src/app   # src/app/api/revalidate/route.ts 하나
git status --short                                                    # 스테이지되지 않은 변경 없음

# 순수 함수 확인 (Node 24 type stripping, 저장소 루트에서)
node --input-type=module -e "const m = await import('./src/lib/content-tags.ts'); for (const b of [{tags:['concert']},{tags:['venue','venue','lineup']},{tags:[]},{tags:['Concert']},{tags:['unknown']},{tags:'concert'},{tags:[1]},null,{}]) console.log(JSON.stringify(b), '=>', JSON.stringify(m.parseRevalidateTags(b)))"
# 기대 (AC-03): ["concert"], ["venue","lineup"], 그 밖은 모두 null

node --input-type=module -e "const { isValidRevalidateSecret: v } = await import('./src/lib/revalidate-secret.ts'); const s = 'x'.repeat(40); console.log([v(s, s), v('y'.repeat(40), s), v('x', s), v(null, s), v('', s), v(s, undefined), v(s, ''), v(s, '   ')].join(','))"
# 기대 (AC-04): true,false,false,false,false,false,false,false

node --input-type=module -e "const f = await import('./src/lib/concert-content-format.ts'); console.log([f.formatHomeDateRange('2026-06-25','2026-06-26'), f.formatHomeDateRange('2026-06-25','2026-06-25'), f.formatTicketDateRange('2026-06-25','2026-06-26','18:00 ~ 21:00'), f.formatTicketDateRange('2026-12-31','2027-01-01','18:00'), f.formatTicketDateRange('2026-06-25','2026-06-25',' '), JSON.stringify(f.formatBookingLineup('A, B\nC', ['x'])), f.formatBookingLineup(null, ['팀1','팀2']), f.formatBookingLineup('  ', ['팀1'])].join(' | '))"
# 기대 (AC-10): 2026-06-25 ~ 2026-06-26 | 2026-06-25 | 2026.06.25 ~ 06.26 / 18:00 ~ 21:00 | 2026.12.31 ~ 2027.01.01 / 18:00 | 2026.06.25 | "A, B\nC" | 팀1, 팀2 | 팀1

# 저장소 루트 — CI와 빌드
npm run lint        # 통과 (AC-11)
npm run typecheck   # 통과 (AC-11)
npm run build       # 성공, 변경 후 라우트 표를 PR 본문에 붙인다 (AC-12, [manual])
```

- Node 확인 명령은 **Git Bash** 기준 따옴표다. 실행하면 `[MODULE_TYPELESS_PACKAGE_JSON] Warning`이 함께 나오는데 정상이다(루트 `package.json`에 `type`이 없어 ESM으로 다시 해석한다는 안내). **경고를 없애려고 `package.json`에 `"type": "module"`을 넣지 않는다** — 빌드 설정 전체에 영향을 준다. 2026-10-25 같은 명령을 설계 결정 그대로의 시제품 모듈로 실행해 위 기대값이 나오는 것을 확인했다
- 기준 AC-12 [manual]의 "변경 전 빌드"는 작업 시작 전에 `origin/develop` 상태에서 `npm run build`를 한 번 실행해 라우트 표를 저장해 둔다. PR 본문에 "변경 전 / 변경 후" 라우트 표 두 개를 붙인다 (사용자 확인 절차 0번에서 사용자가 비교한다)
- `npm run build`는 루트 `.env.local`의 Supabase 값을 쓴다. 이 명세의 조회 함수는 어떤 페이지도 부르지 않으므로 빌드 중 새 테이블을 조회하지 않는다

### 사용자 확인 절차 (AC-12·AC-14·AC-15) — PR 생성 후 사용자에게 요청할 내용

Codex는 PR을 만든 뒤 아래 절차를 사용자에게 그대로 안내하고 끝낸다 (실행하지 않는다). 시크릿 값을 채팅·PR에 붙여넣지 않는다.

1. 공유 폴더에서 PR 브랜치를 체크아웃하고 루트에서 `npm install` → `npm run build` → `npm start` (포트 3000)
0. (AC-12) PR 본문의 "변경 전 / 변경 후" 라우트 표 두 개를 비교한다: 변경 후에만 `/api/revalidate`(ƒ)가 추가되고 나머지 라우트의 렌더링 방식 표시(○·ƒ 등)는 같아야 한다. 가능하면 로컬 `npm run build` 성공도 직접 확인한다
2. (AC-14) 새 터미널(Git Bash)에서 시크릿을 화면에 출력하지 않고 변수로 읽는다: `S=$(grep '^REVALIDATE_SECRET=' .env.local | cut -d= -f2-)`
   - `curl -s -X POST localhost:3000/api/revalidate -H "x-revalidate-secret: $S" -H 'content-type: application/json' -d '{"tags":["concert"]}'` → `{"revalidated":true,"tags":["concert"]}`
   - 같은 요청에 `-H "x-revalidate-secret: wrong"` → HTTP 401 (`-o /dev/null -w '%{http_code}\n'`로 상태만 확인)
   - 시크릿 헤더 없이 → 401
   - 올바른 시크릿 + `-d '{"tags":["nope"]}'` → 400
   - `curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/api/revalidate` (GET) → 405
3. (AC-15) `apps/api/.env`의 `PUBLIC_SITE_URL`이 `http://localhost:3000`인지 확인하고 `apps/api`에서 `npm run start:dev`, `apps/admin`에서 `npm run dev`를 실행한다 → 관리자 `/ticket`에서 티켓 설명을 저장 → "저장했습니다."가 뜨는지(지연 경고가 아닌지) 확인한다
4. 확인이 끝나면 PR 본문의 AC-12·AC-14·AC-15를 체크하고 머지한다. 이 PR은 화면을 바꾸지 않으므로 T6 전에 머지해도 된다. 머지 후 Vercel 배포가 끝나면 운영 관리자에서 저장했을 때도 "저장했습니다."가 뜬다 (서버 API의 `PUBLIC_SITE_URL`이 `https://summit-concert.live`이고, `redirect: 'error'`이므로 리다이렉트 없는 최종 주소여야 한다 — 지연 경고가 계속 뜨면 이 값부터 확인한다)
