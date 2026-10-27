---
spec_id: WORK05-T3A
revision: 1
---

# WORK05-T3A — 재검증 모듈 + 공연 콘텐츠 텍스트 관리 API

## 배경

- work05는 공개 사이트에 하드코딩된 공연 정보를 DB 한 곳에서 관리하도록 옮기는 작업이다 (`docs/specs/prd-construction.md`, `.claude/rules/work-05-construction.md`). T2(#73)에서 테이블 6개(`Venue`, `Concert`, `PerformanceDay`, `Ticket`, `InfoSection`, `InfoItem`)와 임시값 행을 프로덕션 DB에 적용했다
- 이 명세는 `docs/specs/work05-implementation.md`의 **T3를 둘로 나눈 앞부분**이다. 설계 결정 D4(재검증 호출)와 D6(관리 API 계약) 중 **텍스트·링크 저장**을 다룬다. 이미지 업로드와 Geocoding(D6 이미지 라우트, `POST /venue/geocode`, D7)은 이 명세가 머지된 뒤 **WORK05-T3B**로 진행한다. 두 문서가 다르면 **이 명세가 우선**한다
- 재사용할 기존 패턴 (`apps/api/src/` 기준)
  - 인증: 전역 Guard(`guards/global.guard.ts`). 새 라우트에 `@Public()`을 붙이지 않는다. 회귀 테스트는 `auth/public-routes.spec.ts`(AppModule 전수 검사)와 컨트롤러 스펙의 메타데이터 검사(`youtube/youtube-url.controller.spec.ts`)
  - DTO: class-validator + `common/trim.transform.ts`의 `TrimString`, 메시지는 한국어. 전역 `ValidationPipe`는 whitelist·forbidNonWhitelisted·transform·stopAtFirstError(`app.setup.ts`)
  - 응답 매퍼: BigInt를 문자열로 바꾸는 `teams/dto/team-response.ts` 방식
  - 트랜잭션·Prisma 에러: `teams/teams.service.ts`, `common/prisma-error.ts`
  - 외부 HTTP 호출: `album-cover/itunes.client.ts`(fetch + `AbortSignal.timeout` + `common/abort.ts`의 `isTimeoutError`)
  - 환경변수 기동 검사: `auth/auth.module.ts`(JWT_SECRET 길이), `storage/supabase-storage.client.ts`(생성자에서 `getOrThrow`)
  - 서비스 단위 테스트: `teams/teams.service.spec.ts`(PrismaService 대역 + `$transaction` 대역)
- 공개 사이트의 재검증 엔드포인트(`/api/revalidate`, D3)는 T5에서 만든다. 그 전까지 이 API의 재검증 호출은 실패(404 등)하고 `revalidated: false`를 돌려주는 것이 **정상 동작**이다

## 범위

**포함** (모두 `apps/api/` 아래)

- 신규 `src/revalidation/` — 태그 상수, `RevalidationService`, `RevalidationModule`
- 신규 `src/concert-content/` — 공연·공연장·일차·티켓·안내 섹션의 조회·저장 API (컨트롤러·서비스·DTO·응답 매퍼·상수·모듈)
- `src/app.module.ts`에 `ConcertContentModule` 등록
- `src/teams/` — 팀 등록·수정·재정렬 커밋 후 `lineup` 재검증 (`teams.module.ts`, `teams.service.ts`와 기존 스펙 수정)
- `src/auth/public-routes.spec.ts` — 발견 목록에 새 컨트롤러 추가 (공개 라우트 허용 목록은 바꾸지 않는다)
- `src/youtube/youtube.module.spec.ts` — `AppModule` 전체를 기동하는 유일한 기존 테스트다. `ConfigService` 대역이 `JWT_SECRET` 외의 필수 설정을 거부하므로(`예상하지 않은 필수 설정`), 새 필수 환경변수 때문에 기동이 실패한다 (r0 구현에서 확인). 설정 대역을 아래 "기존 테스트의 설정 대역" 규칙대로 고치고, 새 라우트의 미인증 요청 확인을 추가한다
- `.env.example` — `PUBLIC_SITE_URL`, `REVALIDATE_SECRET` 섹션 추가
- 위 모든 새 코드의 단위 테스트(`*.spec.ts`)

**제외**

- 이미지 업로드 라우트(`PUT /concert/images/:slot`, `PUT /performance-days/:dayKey/timetable-image`, `PUT /ticket/images/:side`), `POST /venue/geocode`, `NAVER_MAP_*` 환경변수 → **WORK05-T3B**
- 공개 사이트(`src/`), 관리자 프론트(`apps/admin/`) → T4·T5
- `apps/api/prisma/` (스키마·마이그레이션 변경 없음). **DB에 접속하는 Prisma 명령은 실행하지 않는다** (`migrate *`, `db *`). `npx prisma generate`는 허용
- `src/common/cors.ts` — 새 라우트는 `GET`·`PUT`과 `Authorization`·`Content-Type` 헤더만 써서 현재 허용 목록으로 충분하다. 바꾸지 않는다
- 일차(`PerformanceDay`)·공연장의 추가·삭제 API, `Concert`·`Ticket` 행 생성·삭제 API (PRD 범위 밖)
- 팀 카드 이미지 업로드·곡 API의 재검증 (예매하기 출연진은 팀명·일자·순서만 쓴다)
- 문서(`CLAUDE.md`, `work05-implementation.md`, `REFACTOR_NOTES.md`) 갱신 — 필요하면 머지 후 일반 브랜치 PR로 처리

## 설계 결정

### 1. 재검증 모듈 (`src/revalidation/`)

**태그** — `content-tags.ts`

```ts
export const CONTENT_TAGS = ['concert', 'venue', 'performance-days', 'ticket', 'info-sections', 'lineup'] as const;
export type ContentTag = (typeof CONTENT_TAGS)[number];
```

- 파일 주석에 "공개 사이트 `src/lib/content-tags.ts`(T5에서 생성)와 같은 값을 유지한다"를 적는다

**환경변수 검사** — `RevalidationService` 생성자에서 `ConfigService`로 읽는다. 하나라도 어기면 `Error`를 던져 **서버가 기동하지 않는다**. 오류 메시지에 입력 값을 넣지 않는다 (키 이름과 이유만)

| 키 | 규칙 |
| --- | --- |
| `PUBLIC_SITE_URL` | 필수, 앞뒤 공백 제거 후 `new URL()`로 해석 가능. 스킴은 `https:`, 또는 호스트가 `localhost`·`127.0.0.1`일 때만 `http:`. 사용자 정보(`user:pass@`)·경로(`/` 외)·쿼리·해시 금지, 끝 슬래시 금지 (입력 문자열이 `/`로 끝나면 거부) |
| `REVALIDATE_SECRET` | 필수, 앞뒤 공백 제거 후 32자 이상 (`auth.module.ts`의 `MIN_SECRET_LENGTH`와 같은 기준이지만 import하지 않고 이 모듈 상수로 둔다) |

**호출** — `revalidate(tags: readonly ContentTag[]): Promise<boolean>`

- `POST {PUBLIC_SITE_URL}/api/revalidate`, 헤더 `content-type: application/json`·`x-revalidate-secret: <시크릿>`, 본문 `{"tags": [...]}` (중복 태그 제거)
- `signal: AbortSignal.timeout(REVALIDATE_TIMEOUT_MS)` (= 5000), **`redirect: 'error'`** — 리다이렉트를 따라가면 시크릿 헤더가 다른 주소로 전달될 수 있어 따라가지 않는다 (`PUBLIC_SITE_URL`은 최종 주소여야 한다)
- 재시도하지 않는다
- 응답이 2xx면 `true`. 그 밖의 모든 경우(비 2xx, 네트워크 오류, 타임아웃, 리다이렉트)는 **예외를 던지지 않고** `Logger.warn` 한 줄을 남긴 뒤 `false`
  - 로그에는 태그 목록과 실패 종류(HTTP 상태코드 또는 `timeout`·`network`)만 남긴다. 시크릿·요청 헤더·응답 본문은 남기지 않는다
- 빈 배열이면 요청하지 않고 `true`

**기존 테스트의 설정 대역** (r1 추가)

- `youtube.module.spec.ts`의 설정 대역은 `PUBLIC_SITE_URL`에 `http://localhost:3000`, `REVALIDATE_SECRET`에 32자 이상의 테스트 전용 문자열(예: `'test-only-revalidate-'.repeat(3)`)을 돌려준다. `RevalidationService`가 `get`과 `getOrThrow` 중 무엇으로 읽든 같은 값이 나오도록 **두 메서드 모두** 이 두 키에 값을 준다. 그 밖의 키는 지금처럼 `get`은 `undefined`, `getOrThrow`는 예외다 (예상하지 않은 필수 설정을 계속 드러내기 위함)
- 이 테스트는 실제 네트워크에 접속하지 않는다. 미인증 요청은 Guard에서 막혀 재검증 호출까지 가지 않는다
- 기존 단언(유튜브 `PUT`·`DELETE` 401, DB 미접근, 옛 경로 404)은 지우거나 약하게 바꾸지 않는다. 테스트 이름의 "배치 키 설정 없이"도 유지한다
- 같은 테스트에 **`PUT /ticket` 미인증 요청이 401이고 Prisma 대역이 호출되지 않음**을 추가한다 (새 라우트가 실제 앱에서 인증을 요구하는지 확인)
- 다른 기존 스펙도 같은 이유로 기동이 실패하면 **설정 대역에 이 두 키를 추가하는 변경만** 허용한다. 기존 단언은 바꾸지 않고, 고친 파일 목록을 PR 본문에 적는다

**모듈** — `RevalidationModule`은 `RevalidationService`를 providers·exports에 둔다. `@Global`로 만들지 않고 쓰는 모듈(`TeamsModule`, `ConcertContentModule`)이 명시적으로 import한다 (`StorageModule`과 같은 이유)

**`.env.example`** — `Supabase Storage` 섹션 뒤에 `── 공개 사이트 재검증 (work05) ──` 섹션을 추가한다. 기존 주석 스타일(⚠️ 실제 값은 .env에만)로:
- `PUBLIC_SITE_URL=` — 형식 예 `https://summit-concert.live`(배포)·`http://localhost:3000`(로컬), 끝 슬래시 금지, 리다이렉트되지 않는 최종 주소여야 함
- `REVALIDATE_SECRET=` — 생성 명령은 `JWT_SECRET`과 같은 `node -e ...` 한 줄, 32자 이상, **공개 사이트의 같은 키와 같은 값**, 미설정·형식 오류 시 서버가 기동하지 않음

### 2. 저장 흐름과 응답 계약

- 모든 저장(`PUT`) 응답은 `{ data: <저장 후 조회 값>, revalidated: boolean }`이다. `data`의 모양은 같은 리소스의 `GET` 응답과 같다
- 순서: **DB 저장(트랜잭션이면 커밋까지) → 재검증 호출 → 응답**. 재검증은 `$transaction` 콜백 **밖**에서, 콜백이 반환된 뒤 호출한다
- 재검증이 `false`여도 저장은 성공이다. 롤백하지 않고 200으로 `revalidated: false`를 돌려준다
- 검증 실패(400)·대상 없음(404)·DB 오류로 저장이 실패하면 재검증을 호출하지 않는다
- **팀 API**: `TeamsService`의 `create`·`update`·`reorder`는 각 트랜잭션이 반환된 뒤 `revalidate(['lineup'])`을 `await`한다. 결과는 쓰지 않고(실패 시 로그는 `RevalidationService`가 남긴다) **기존 응답 형태를 바꾸지 않는다**. 입력 검증 실패 등으로 저장이 실패하면 호출하지 않는다

### 3. 라우트 (`src/concert-content/`)

모든 라우트는 인증 필요. 컨트롤러 5개: `ConcertController`(`concert`), `VenueController`(`venue`), `PerformanceDaysController`(`performance-days`), `TicketController`(`ticket`), `InfoSectionsController`(`info-sections`)

| 메서드·경로 | 동작 | 재검증 태그 |
| --- | --- | --- |
| `GET /concert` | `Concert` id=1 + 공연장 요약 | — |
| `PUT /concert` | id=1의 텍스트 필드 전체 교체 | `concert` |
| `GET /venue` | `Concert` id=1의 `venueId`가 가리키는 공연장 | — |
| `PUT /venue` | 그 공연장의 필드 전체 교체 | `venue` |
| `GET /performance-days` | 모든 일차 + 일차별 자동 출연진 | — |
| `PUT /performance-days/:dayKey` | 해당 일차의 필드 전체 교체 | `performance-days` |
| `GET /ticket` | `Ticket` id=1 | — |
| `PUT /ticket` | 설명 교체 | `ticket` |
| `GET /info-sections?category=ticket\|notice` | 해당 분류의 섹션·항목 | — |
| `PUT /info-sections?category=ticket\|notice` | 해당 분류의 섹션·항목 전체 교체 | `info-sections` |

- `PUT`은 **전체 교체**다. 필수 필드가 빠지면 400. 선택 필드는 생략·`null`·(trim 후) 빈 문자열을 모두 `NULL`로 저장한다
- `Concert` id=1·`Ticket` id=1이 없거나 `Concert`가 가리키는 공연장이 없으면 404 + "공연 콘텐츠 기본 행이 없습니다. 마이그레이션 적용 여부를 확인해 주세요." (`GET`·`PUT` 공통, 상수로 둔다)
- 없는 `dayKey`는 404 + "해당 공연 일차를 찾을 수 없습니다."
- `category`가 없거나 `ticket`·`notice`가 아니면 400 (쿼리 DTO + `@IsIn`)

### 4. 입력 규칙과 상한 (`concert-content.constants.ts`)

| 리소스 | 필드 | 필수 | 규칙 |
| --- | --- | --- | --- |
| Concert | `titleKo`, `titleEn` | ✔ | 문자열, 1~100자 |
| | `subtitle` | | 문자열 ≤ 200자 |
| | `startDate`, `endDate` | ✔ | `YYYY-MM-DD` 형식이고 실제 달력 날짜(예: `2026-02-30` 거부). `endDate` ≥ `startDate`가 아니면 400 |
| | `showTime` | ✔ | 문자열, 1~50자 |
| Venue | `name` | ✔ | 1~100자 |
| | `address` | ✔ | 1~200자 |
| | `addressDetail` | | ≤ 200자 |
| | `latitude` | ✔ | 숫자(문자열 불가), -90 ~ 90 |
| | `longitude` | ✔ | 숫자(문자열 불가), -180 ~ 180 |
| | `naverMapUrl`, `websiteUrl` | | 아래 URL 규칙 |
| PerformanceDay | `dayLabel` | ✔ | 1~50자 |
| | `dateLabel` | ✔ | 1~100자 |
| | `bookingUrl` | | 아래 URL 규칙 |
| | `lineupOverride` | | ≤ 1000자. `NULL`이면 자동 모드 |
| Ticket | `description` | | ≤ 2000자 |
| InfoSection 본문 | `sections` | ✔ | 배열, 0~20개 (0개 = 해당 분류 전체 삭제) |
| | `sections[].title` | ✔ | 1~100자 |
| | `sections[].items` | ✔ | 배열, 0~50개 |
| | `sections[].items[].content` | ✔ | 1~500자 |

- 모든 문자열은 `TrimString` 후 검사한다
- **URL 규칙**: ≤ 2048자, `new URL()`로 해석 가능, 스킴 `https:`만, 사용자 정보 금지. 메시지 "https로 시작하는 올바른 주소를 입력해 주세요."
- 좌표는 소수 6자리를 넘으면 DB(numeric(9,6))가 반올림한다. API에서 따로 거부하지 않는다
- 날짜는 `YYYY-MM-DD`를 UTC 자정 `Date`로 바꿔 저장하고, 응답에서는 다시 `YYYY-MM-DD` 문자열로 돌려준다
- 중첩 DTO는 `@ValidateNested({ each: true })` + `@Type()`으로 검증한다 (선언되지 않은 중첩 필드도 400)

### 5. 응답 모양

```ts
interface ConcertResponse {
  titleKo: string; titleEn: string; subtitle: string | null;
  startDate: string; endDate: string;            // YYYY-MM-DD
  showTime: string;
  posterImageUrl: string | null; titleImageUrl: string | null; subtitleImageUrl: string | null;
  venue: { id: string; name: string; address: string };
  updatedAt: string;                              // ISO 8601
}
interface VenueResponse {
  id: string; name: string; address: string; addressDetail: string | null;
  latitude: number; longitude: number;            // Decimal → number
  naverMapUrl: string | null; websiteUrl: string | null; updatedAt: string;
}
interface PerformanceDayResponse {
  dayKey: string; dayLabel: string; dateLabel: string;
  bookingUrl: string | null; lineupOverride: string | null; timetableImageUrl: string | null;
  autoLineup: string[];                           // 아래 규칙
  updatedAt: string;
}
interface TicketResponse {
  frontImageUrl: string | null; backImageUrl: string | null; description: string | null; updatedAt: string;
}
interface InfoSectionResponse { id: string; title: string; items: { id: string; content: string }[] }
```

- `GET /performance-days`는 `dayKey` 오름차순 배열. `autoLineup`은 `LineUp`에서 `day = dayKey`인 팀의 `teamName`을 `performanceOrder` 오름차순(NULL은 뒤)·`id` 오름차순으로 나열한다 (`teams.service.ts` `findAll`과 같은 정렬). `PUT` 응답의 `data`에도 같은 규칙으로 채운다
- `GET /info-sections`는 섹션을 `sortOrder` 오름차순, 각 섹션의 항목을 `sortOrder` 오름차순으로 돌려준다. `sortOrder` 값 자체는 응답에 넣지 않는다 (배열 순서가 곧 순서)
- `PUT /ticket` 응답의 이미지 URL은 DB 값을 그대로 돌려준다 (이 명세에서는 바꾸지 않는다)

### 6. 안내 섹션 전체 교체 (`PUT /info-sections`)

- 하나의 `$transaction` 안에서: ① 해당 `category`의 `InfoSection`을 `deleteMany`(항목은 FK `ON DELETE CASCADE`로 함께 삭제) ② 요청 배열 순서대로 섹션을 `sortOrder` = 1부터 만들고, 각 섹션의 항목도 배열 순서대로 `sortOrder` = 1부터 만든다 ③ 같은 트랜잭션에서 결과를 다시 읽어 응답 `data`를 만든다
- 다른 `category`의 행은 건드리지 않는다
- 저장할 때마다 섹션·항목 `id`가 새로 발급된다. 클라이언트는 `id`를 저장 간에 유지되는 식별자로 쓰지 않는다 (이 사실을 서비스 주석에 적는다)
- 중간 단계가 실패하면 트랜잭션 전체가 롤백되고 오류가 그대로 전파되며, 재검증을 호출하지 않는다

## 수용 기준

- AC-01 `src/revalidation/content-tags.ts`의 `CONTENT_TAGS`가 설계 결정 1의 6개 값과 순서까지 같고, `ContentTag` 타입이 그 배열에서 파생된다
- AC-02 `RevalidationService` 생성 시 `PUBLIC_SITE_URL`·`REVALIDATE_SECRET`이 설계 결정 1의 규칙을 어기면 예외가 나고, 예외 메시지에 입력 값이 들어 있지 않다. 테스트가 누락·빈 값·31자 시크릿·`http://example.com`·끝 슬래시·경로 포함·사용자 정보 포함을 각각 거부하고 `https://summit-concert.live`·`http://localhost:3000`을 허용함을 검증한다
- AC-03 `revalidate()`가 설계 결정 1의 주소·메서드·헤더·본문·`redirect: 'error'`·5초 타임아웃으로 요청하고, 2xx면 `true`, 비 2xx·네트워크 오류·타임아웃이면 예외 없이 `false`를 돌려준다. 테스트가 각 경우를 fetch 대역으로 검증하고, 실패 로그에 시크릿 값이 없음을 확인한다
- AC-04 `TeamsService`의 `create`·`update`·`reorder`가 트랜잭션 반환 뒤 `revalidate(['lineup'])`을 정확히 1번 호출하고, 재검증이 `false`여도 기존과 같은 응답을 돌려준다. 저장이 실패(400·404·409)하면 호출하지 않는다. 기존 `teams.service.spec.ts`의 다른 테스트는 그대로 통과한다
- AC-05 설계 결정 3의 10개 라우트가 해당 컨트롤러에 그 메서드·경로로 선언되어 있고, 5개 컨트롤러 모두 클래스·핸들러에 `@Public()`이 없으며, `public-routes.spec.ts`의 발견 목록에 5개 컨트롤러가 추가되고 공개 핸들러 허용 목록은 바뀌지 않는다
- AC-06 각 `PUT`이 설계 결정 4의 필수값·길이·형식(날짜 형식과 실제 날짜, 날짜 순서, 좌표 범위, https URL, 배열 개수, 선언되지 않은 필드) 위반을 400으로 거부한다. DTO 스펙(`plainToInstance` + `validate`, 또는 서비스에서 던지는 검증은 서비스 스펙)이 규칙마다 거부 1건 이상과 정상 입력 통과를 검증한다
- AC-07 `PUT /performance-days/:dayKey`의 없는 `dayKey`, 기본 행(`Concert`·`Ticket` id=1, 공연장)이 없을 때의 `GET`·`PUT`이 설계 결정 3의 문구로 404를 낸다 (서비스 스펙)
- AC-08 5개 리소스의 `PUT` 서비스가 저장 성공 후 해당 태그로 재검증을 1번 호출하고 `{ data, revalidated }`를 돌려주며, 재검증이 `false`면 저장 결과와 함께 `revalidated: false`를 돌려준다. 재검증 호출은 `$transaction` 콜백이 끝난 뒤에 일어난다 (서비스 스펙이 호출 순서를 검증)
- AC-09 `GET /performance-days`의 `autoLineup`이 설계 결정 5의 정렬 규칙을 따르고, `lineupOverride`가 있어도 `autoLineup`은 계산된다 (서비스 스펙)
- AC-10 `PUT /info-sections`가 한 트랜잭션에서 해당 `category`만 지우고 배열 순서대로 `sortOrder` 1..N을 부여해 다시 만든다. 트랜잭션 중간 실패 시 오류가 전파되고 재검증을 호출하지 않는다 (서비스 스펙)
- AC-11 응답 매퍼가 설계 결정 5의 모양을 따른다 — BigInt id는 문자열, 날짜는 `YYYY-MM-DD`, 좌표는 number, `updatedAt`은 ISO 문자열 (매퍼 스펙)
- AC-12 `.env.example`에 설계 결정 1의 `PUBLIC_SITE_URL`·`REVALIDATE_SECRET` 섹션이 값 없이 추가되어 있다
- AC-13 `apps/api`에서 `npm run build`·`npm run typecheck`·`npm run lint`·`npm test`가 통과한다
- AC-14 `origin/develop` 대비 변경 파일이 모두 `apps/api/` 아래이고, `apps/api/prisma/`와 `apps/api/src/common/cors.ts`는 바뀌지 않았다
- AC-15 [manual] 사용자가 로컬에서 API를 띄워(`apps/api`에서 `npm run start:dev`, 공개 사이트는 띄우지 않음) 로그인 토큰으로 `GET /concert`가 임시값을 돌려주고, `PUT /ticket`에 `{"description":"테스트"}`를 보내면 200과 `revalidated: false`(공개 사이트 재검증 엔드포인트가 아직 없으므로)를 받으며, 서버 로그에 재검증 실패 경고 한 줄이 시크릿 없이 남는 것을 확인한다. 확인 후 `PUT /ticket`에 `{"description":null}`로 되돌린다
- AC-16 `youtube.module.spec.ts`의 설정 대역이 "기존 테스트의 설정 대역" 규칙대로 두 키에 테스트용 유효값을 주고 그 밖의 필수 설정은 계속 거부하며, 기존 단언이 모두 남아 있고, `PUT /ticket` 미인증 401·Prisma 미호출 단언이 추가되어 있다

## 테스트 계획

**커밋하기 전에** 실행하고 명령과 결과를 PR 본문에 남긴다. 새 파일은 `git add`로 스테이지한 뒤 실행한다.

```bash
# 저장소 루트
git diff --cached --name-only origin/develop -- . ':!apps/api'                                   # 출력 없음 (AC-14)
git diff --cached --name-only origin/develop -- apps/api/prisma apps/api/src/common/cors.ts      # 출력 없음 (AC-14)
git status --short                                                                               # 스테이지되지 않은 변경 없음

# apps/api 폴더 (DB에 접속하지 않는 명령만)
npx prisma generate     # 생성 클라이언트 갱신 (DB 접속 없음)
npm run build           # 통과 (AC-13)
npm run typecheck       # 통과 (AC-13)
npm run lint            # 통과 (AC-13)
npm test                # 통과 (AC-13)
```

- **`npm test` 타임아웃 예외**: Windows 로컬에서 전체 실행 시 앱을 띄우는 테스트(`src/common/cors.spec.ts`, `src/app.setup.spec.ts` 등)가 부하로 `Test timed out in 5000ms`만 내고 실패하는 경우가 있다. 실패 사유가 **타임아웃뿐**이면 실패한 파일만 `npx vitest run <파일>`로 다시 실행하고, 통과하면 두 출력을 함께 보고한다. 타임아웃이 아닌 실패는 그대로 실패로 보고한다
- 테스트는 실제 네트워크·DB에 접속하지 않는다. fetch는 `vi.stubGlobal` 등으로 대역을 두고, Prisma는 `teams.service.spec.ts`처럼 대역을 쓴다

### 사용자 확인 절차 (AC-15) — PR 생성 후 사용자에게 요청할 내용

Codex는 PR을 만든 뒤 아래 절차를 사용자에게 그대로 안내하고 끝낸다 (실행하지 않는다). `apps/api/.env`의 `DATABASE_URL`은 프로덕션 DB를 가리키므로 `PUT /ticket`은 실제 `Ticket` 행을 바꾼다 — 마지막 단계에서 `NULL`로 되돌린다 (현재 값이 `NULL`인 임시값 행이다).

1. 공유 폴더에서 PR 브랜치를 체크아웃하고 `cd apps/api` → `npm run start:dev`. 기동 로그에 오류가 없는지 확인 (`PUBLIC_SITE_URL`·`REVALIDATE_SECRET`이 없거나 형식이 틀리면 여기서 실패한다)
2. 관리자 앱(`apps/admin`, `npm run dev`)에 로그인한 뒤 브라우저 개발자 도구 → Application → Local Storage에서 토큰을 확인하거나, `POST /auth/login`으로 토큰을 받는다
3. `GET http://localhost:3001/concert` (헤더 `Authorization: Bearer <토큰>`) → 200, `titleKo`가 `(입력 필요)`
4. `PUT http://localhost:3001/ticket` 본문 `{"description":"테스트"}` → 200, `data.description`이 `테스트`, `revalidated`가 `false`
5. API 터미널에 재검증 실패 경고가 한 줄 남고, 그 줄에 시크릿 값이 없음
6. `PUT http://localhost:3001/ticket` 본문 `{"description":null}` → 200, `data.description`이 `null`
7. 확인이 끝나면 PR 본문의 AC-15를 체크하고 머지한다. 배포 전 서버 `/opt/summit-api/.env`에 두 키를 **먼저** 넣는다 (`work05-implementation.md` U3)
