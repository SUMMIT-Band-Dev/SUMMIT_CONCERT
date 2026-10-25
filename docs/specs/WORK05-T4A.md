---
spec_id: WORK05-T4A
revision: 0
---

# WORK05-T4A — 공연 콘텐츠 관리 화면 (공연 기본 정보 · 일차별 공연 · 티켓 안내 · 관람 유의사항)

## 배경

- work05는 공개 사이트에 하드코딩된 공연 정보를 DB 한 곳에서 관리하도록 옮기는 작업이다 (`docs/specs/prd-construction.md`, `.claude/rules/work-05-construction.md`). T2(#73)에서 테이블을 만들었고, WORK05-T3A(#77)·WORK05-T3B(#79)에서 관리 API를 만들어 서버에 배포했다. 이 API를 쓰는 관리자 화면은 아직 없다
- 이 명세는 `docs/specs/work05-implementation.md` **T4의 앞부분**이다. D9(관리자 화면) 가운데 공연장 정보(`/venue`)를 뺀 4개 페이지와 메뉴를 다룬다. `/venue` 페이지, 네이버 지도, CSP 예외(D8)는 다음 명세 WORK05-T4B에서 다룬다. 두 문서가 다르면 **이 명세가 우선**한다
- 서버 계약 (`apps/api/src/concert-content/` 기준, 이 화면이 그대로 맞춰야 하는 값)
  - 응답 모양: `dto/content-response.ts` — `ConcertResponse`·`PerformanceDayResponse`·`TicketResponse`·`InfoSectionResponse`. 날짜는 `YYYY-MM-DD` 문자열이고 id는 문자열이다
  - 저장·업로드 응답은 `{ data, revalidated }`이다. GET은 값을 그대로 돌려준다. `GET /performance-days`·`GET /info-sections`는 배열을 돌려준다
  - 검증 규칙과 한국어 문구: `dto/update-concert-content.dto.ts`, `dto/content-validation.ts`, `concert-content.constants.ts`
  - 선택 문자열(`subtitle`·`bookingUrl`·`lineupOverride`·`description`)은 서버가 trim한 뒤 빈 값을 NULL로 저장한다 (`concert-content.service.ts`의 `optionalText`). 선택 URL은 빈 문자열이면 검증을 통과한다
  - `PUT /performance-days/:dayKey`는 `dayLabel`·`dateLabel`이 필수인 전체 교체다. `lineupOverride`가 빈 값·NULL이면 자동 모드가 된다
  - `PUT /info-sections?category=`는 해당 분류의 섹션·항목 전체를 교체한다. **저장할 때마다 id가 새로 발급된다**
  - 이미지 교체: `PUT /concert/images/:slot`(`poster`·`title`·`subtitle`), `PUT /performance-days/:dayKey/timetable-image`, `PUT /ticket/images/:side`(`front`·`back`). multipart 필드는 `file` 하나뿐이고, JPEG·PNG·WebP 2MB 이하만 받는다 (`CONCERT_IMAGE_TOO_LARGE_MESSAGE` = "이미지 크기는 2MB를 넘을 수 없습니다.")
- 재사용할 관리자 앱 코드 (`apps/admin/src/` 기준)
  - API 호출: `lib/api/client.ts`(`apiRequest`, FormData면 Content-Type을 붙이지 않음), `lib/api/teams.ts`(업로드 함수 패턴, `CARD_IMAGE_FIELD_NAME`), `lib/api/youtube.test.ts`(`vi.mock("./client")`로 호출 인자를 단언하는 테스트 패턴)
  - 이미지: `components/teams/team-card-image-field.tsx`(파일 선택 → 미리보기 → 버튼으로 업로드, blob URL 해제), `components/teams/card-image-thumb.tsx`, `lib/teams/card-image.ts`(`detectImageFormat`, `CARD_IMAGE_MESSAGES`, `CARD_IMAGE_ACCEPT`, `CARD_IMAGE_SIGNATURE_BYTES`)
  - 폼: `lib/teams/team-schema.ts`(서버 DTO 규칙·문구를 그대로 옮긴 Zod 스키마 패턴), RHF + `@hookform/resolvers`
  - 화면: `app/(admin)/teams/page.tsx`(메타데이터만 맡는 서버 컴포넌트) + `components/teams/teams-page-client.tsx`, `components/layout/page-header.tsx`, `components/layout/page-states.tsx`(`LoadingState`·`ErrorState`), `components/ui/*`(alert·badge·button·card·dialog·input·label·table, textarea 없음)
  - 메뉴: `lib/nav.ts`(`NAV_ITEMS`, 사이드바·상단 바가 함께 쓰는 유일한 출처), `components/layout/sidebar.tsx`(`NAV_ICONS`로 href와 아이콘을 짝지음), `lib/nav.test.ts`
- 확인한 사실
  - 업로드 이미지 URL은 Supabase Storage 절대 URL이다. CSP `img-src`는 이미 `NEXT_PUBLIC_SUPABASE_STORAGE_ORIGIN`을 허용하므로(`lib/csp.ts`) 이 명세에서 CSP를 바꿀 필요가 없다
  - 관리자 앱 테스트는 vitest `environment: "node"`이고 `src/**/*.test.ts`만 실행한다(`vitest.config.mts`). 그래서 컴포넌트 렌더링 테스트 대신 순수 함수(스키마·변환·검사·API 호출 인자)를 테스트한다
  - 새 라우트 없이 기존 API만 호출한다(`GET`·`PUT`, 헤더 `Authorization`·`Content-Type`). 현재 CORS 허용 목록으로 충분하다
  - 공개 사이트는 T5 전까지 이 데이터를 읽지 않는다. 로컬 API의 `PUBLIC_SITE_URL`이 가리키는 공개 사이트에는 재검증 엔드포인트가 아직 없어서 저장 응답의 `revalidated`가 `false`로 온다

## 범위

**포함** (모두 `apps/admin/` 아래)

- 메뉴: `src/lib/nav.ts`, `src/lib/nav.test.ts`, `src/components/layout/sidebar.tsx`
- API: 신규 `src/lib/api/concert-content.ts`·`concert-content.test.ts`, `src/lib/api/types.ts`에 타입 추가, `src/lib/query-keys.ts`에 키 추가
- 규칙·변환(순수 함수): 신규 `src/lib/concert-content/` — `content-rules.ts`(공통 URL 규칙), `concert-schema.ts`, `performance-day-schema.ts`, `ticket-schema.ts`, `info-sections-schema.ts`, `concert-image.ts`, `public-page-url.ts`와 각 `*.test.ts`
- 컴포넌트: 신규 `src/components/ui/textarea.tsx`(shadcn/ui 표준 Textarea, 의존성 추가 없음), 신규 `src/components/concert-content/` — `save-result-notice.tsx`, `concert-image-field.tsx`, `info-sections-editor.tsx`, `concert-page-client.tsx`, `performance-days-page-client.tsx`, `ticket-page-client.tsx`, `notice-page-client.tsx`
- 페이지: 신규 `src/app/(admin)/concert/page.tsx`, `performance-days/page.tsx`, `ticket/page.tsx`, `notice/page.tsx`

**제외**

- 공연장 정보 `/venue` 페이지, 네이버 지도, `src/lib/csp.ts`·`csp.test.ts` 변경, `.env.example`의 `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` → WORK05-T4B
- `apps/api/` (API 변경 없음), 공개 사이트 `src/` (T5)
- `apps/admin/package.json`·`package-lock.json` 변경 (새 의존성 없이 기존 RHF·Zod·TanStack Query·lucide-react·radix-ui로 만든다)
- 팀 화면 코드 변경: `src/lib/teams/card-image.ts`, `src/components/teams/*` (읽어서 재사용만 한다. 1MB 팀 업로드 규칙은 그대로 둔다)
- 드래그 정렬: 순서 변경은 위/아래 버튼으로 한다 (`@dnd-kit`을 쓰지 않는다)
- 저장하지 않고 페이지를 떠날 때 경고, 이미지 삭제 (서버에 삭제 API가 없다)
- 문서(`CLAUDE.md`, `work05-implementation.md`) 갱신 — 필요하면 머지 후 일반 브랜치 PR로 처리

## 설계 결정

### 1. 메뉴

- `NavItem`에 선택 필드 `group?: string`를 추가한다. 기존 3개 항목은 그대로 두고(그룹 없음), 그 뒤에 `group: "공연 콘텐츠"`인 항목 4개를 아래 순서로 붙인다

| href | label | 아이콘(lucide-react) |
| --- | --- | --- |
| `/concert` | 공연 기본 정보 | `Info` |
| `/performance-days` | 일차별 공연 | `CalendarDays` |
| `/ticket` | 티켓 안내 | `Ticket` |
| `/notice` | 관람 유의사항 | `TriangleAlert` |

- 사이드바는 `group`이 앞 항목과 달라지는 지점에 그룹 제목(텍스트, `aria-hidden` 아님)을 한 번 그린다. 아이콘은 기존처럼 `NAV_ICONS`에 href로 짝짓는다. 모바일 서랍도 `SidebarContent`를 쓰므로 따로 고치지 않는다
- `nav.ts` 첫 줄 주석의 메뉴 구조 설명을 새 구성에 맞게 고친다. `/venue`(공연장 정보)는 WORK05-T4B에서 `/concert` 바로 뒤에 넣는다

### 2. API 모듈 (`src/lib/api/concert-content.ts`)

파일 첫 줄에 미러링 대상(`apps/api/src/concert-content/*.controller.ts`)을 적는다. 모든 함수는 마지막 인자로 `options: Pick<ApiRequestOptions, "signal"> = {}`를 받아 `apiRequest`에 그대로 넘긴다 (업로드는 `"signal" | "timeoutMs"`).

| 함수 | 호출 |
| --- | --- |
| `getConcert()` | `GET /concert` → `Concert` |
| `updateConcert(input)` | `PUT /concert`, 본문 `{ titleKo, titleEn, subtitle, startDate, endDate, showTime }` → `SaveResult<Concert>` |
| `listPerformanceDays()` | `GET /performance-days` → `PerformanceDay[]` |
| `updatePerformanceDay(dayKey, input)` | `PUT /performance-days/<dayKey>`, 본문 `{ dayLabel, dateLabel, bookingUrl, lineupOverride }` → `SaveResult<PerformanceDay>` |
| `getTicket()` | `GET /ticket` → `Ticket` |
| `updateTicket(input)` | `PUT /ticket`, 본문 `{ description }` → `SaveResult<Ticket>` |
| `listInfoSections(category)` | `GET /info-sections?category=<category>` → `InfoSection[]` |
| `updateInfoSections(category, input)` | `PUT /info-sections?category=<category>`, 본문 `{ sections: [{ title, items: [{ content }] }] }` → `SaveResult<InfoSection[]>` |
| `uploadConcertImage(slot, file)` | `PUT /concert/images/<slot>` → `SaveResult<Concert>` |
| `uploadTimetableImage(dayKey, file)` | `PUT /performance-days/<dayKey>/timetable-image` → `SaveResult<PerformanceDay>` |
| `uploadTicketImage(side, file)` | `PUT /ticket/images/<side>` → `SaveResult<Ticket>` |

- 경로에 들어가는 `dayKey`·`slot`·`side`·`category`는 `encodeURIComponent`로 감싼다
- 업로드 본문은 `FormData` 하나에 `CARD_IMAGE_FIELD_NAME`(`"file"`) 필드만 넣는다. 업로드 함수의 기본 `timeoutMs`는 `CONCERT_IMAGE_UPLOAD_TIMEOUT_MS = 30_000`이다 (팀 업로드 필드의 `UPLOAD_TIMEOUT_MS`와 같은 근거)
- 허용 값은 상수 배열 `CONCERT_IMAGE_SLOTS = ["poster", "title", "subtitle"]`, `TICKET_IMAGE_SIDES = ["front", "back"]`, `INFO_CATEGORIES = ["ticket", "notice"]`로 두고 타입을 거기서 뽑는다 (서버 `concert-content.constants.ts`와 같은 값)
- `src/lib/api/types.ts`에 `Concert`·`PerformanceDay`·`Ticket`·`InfoSection`·`SaveResult<T> = { data: T; revalidated: boolean }`를 서버 응답과 **같은 필드·같은 nullable**로 추가한다. 주석에 `apps/api/src/concert-content/dto/content-response.ts`를 적는다
- `src/lib/query-keys.ts`에 `concert: ["concert"]`, `performanceDays: ["performance-days"]`, `ticket: ["ticket"]`, `infoSections: (category) => ["info-sections", category]`를 추가한다

### 3. 저장 흐름과 저장 결과 알림

- 조회는 `useQuery`, 저장·업로드는 `useMutation`이다. **낙관적 업데이트는 하지 않는다**(`onMutate`·`setQueryData` 금지). 성공하면 해당 리소스의 query key를 invalidate한다. 재시도 정책은 기존 `query-client.ts`를 그대로 따른다
- 저장 중에는 저장 버튼을 비활성화하고 "저장 중…"으로 표시한다. 오류는 팀 화면처럼 `ApiError.messages`를 `Alert variant="destructive"`에 줄마다 보여 준다
- `components/concert-content/save-result-notice.tsx`의 `SaveResultNotice({ revalidated, publicPath })`는 텍스트 저장과 이미지 업로드가 함께 쓴다
  - `revalidated === true`: "저장했습니다."
  - `revalidated === false`: 경고 Alert "저장됨 — 사이트 반영이 지연될 수 있습니다(최대 1시간)."
  - 두 경우 모두 `buildPublicPageUrl(publicPath, origin)`이 값을 돌려주면 "공개 페이지에서 확인" 링크를 새 탭(`target="_blank"`, `rel="noopener noreferrer"`)으로 단다. `null`이면 링크를 그리지 않는다
- `src/lib/concert-content/public-page-url.ts`
  - `buildPublicPageUrl(path, origin)`: `origin`이 비었거나 http(s) URL이 아니면 `null`. 끝 슬래시를 떼고 `path`(반드시 `/`로 시작)를 붙인다
  - 화면용 래퍼는 `process.env.NEXT_PUBLIC_PUBLIC_SITE_ORIGIN`을 **문자 그대로의 표현**으로 읽는다 (`lib/teams/card-image.ts`와 같은 이유)
  - 페이지별 공개 경로 상수 `PUBLIC_PAGE_PATHS`: `concert: "/"`, `performanceDays: "/time-table"`, `ticket: "/ticket-info"`, `notice: "/notice"`

### 4. 공연 이미지 필드

- `components/concert-content/concert-image-field.tsx`의 `ConcertImageField({ label, imageUrl, alt, upload, onUploaded, publicPath })`
  - `upload: (file: File) => Promise<SaveResult<unknown>>`는 호출부가 슬롯에 맞는 업로드 함수를 넘긴다
  - UX는 `team-card-image-field.tsx`와 같다: 파일 선택 → 클라이언트 검사 → 미리보기 → **"이미지 업로드" 버튼을 눌러야** 올린다, "선택 취소", blob URL 해제, 업로드 중 비활성화. 텍스트 저장과 별개이고 즉시 반영된다는 안내 문구를 둔다 ("JPEG · PNG · WebP, 2MB 이하")
  - 썸네일은 `CardImageThumb`를 재사용한다. `imageUrl`이 NULL이면 빈 썸네일과 "등록된 이미지 없음"을 보여 준다
  - 성공하면 `onUploaded`(호출부에서 invalidate)를 부르고 `SaveResultNotice`로 결과를 보여 준다
- `src/lib/concert-content/concert-image.ts`
  - `CONCERT_IMAGE_MAX_BYTES = 2 * 1024 * 1024`, `CONCERT_IMAGE_TOO_LARGE_MESSAGE = "이미지 크기는 2MB를 넘을 수 없습니다."` (주석에 서버 `apps/api/src/concert-content/concert-content.constants.ts`와 같은 값이라고 적는다)
  - `checkConcertImageFile(file)`: `checkCardImageFile`과 같은 순서로 검사한다. 0바이트면 `CARD_IMAGE_MESSAGES.required`, 2MB 초과면 위 문구, 읽기 실패면 `CARD_IMAGE_MESSAGES.unreadable`, 형식 판별(`detectImageFormat`) 실패면 `CARD_IMAGE_MESSAGES.unsupported`. `card-image.ts`는 고치지 않고 import만 한다

### 5. 폼 규칙 (Zod)

서버 DTO와 **같은 규칙, 같은 문구**로 쓴다. 문자열은 `.trim()` 후 검사한다. 각 파일 첫 주석에 대응하는 서버 파일을 적는다(`team-schema.ts` 주석 형식).

- `content-rules.ts` — `optionalHttpsUrl`: 빈 문자열 허용, 그 밖에는 `new URL()`로 해석되고 `https:`이고 사용자·비밀번호가 없고 2048자 이하일 것. 위반 문구 "https로 시작하는 올바른 주소를 입력해 주세요."
- `concert-schema.ts` (`UpdateConcertDto`)

| 필드 | 규칙 | 문구 |
| --- | --- | --- |
| `titleKo` | 1~100자 | 국문 제목은 1~100자로 입력해 주세요. |
| `titleEn` | 1~100자 | 영문 제목은 1~100자로 입력해 주세요. |
| `subtitle` | 0~200자 | 부제는 200자 이내로 입력해 주세요. |
| `startDate`·`endDate` | `YYYY-MM-DD`이고 실제 날짜(존재하지 않는 날짜 거부, 서버 `IsCalendarDate`와 같은 판정) | 날짜는 YYYY-MM-DD 형식의 실제 날짜로 입력해 주세요. |
| (객체) | `endDate < startDate`이면 `endDate`에 오류 | 종료일은 시작일보다 빠를 수 없습니다. |
| `showTime` | 1~50자 | 공연 시간은 1~50자로 입력해 주세요. |

- `performance-day-schema.ts` (`UpdatePerformanceDayDto`)
  - `dayLabel` 1~50자 "일차 라벨은 1~50자로 입력해 주세요.", `dateLabel` 1~100자 "날짜 라벨은 1~100자로 입력해 주세요.", `bookingUrl`은 `optionalHttpsUrl`
  - 출연진은 폼에서 `lineupMode: "auto" | "manual"`과 `lineupText`로 나눈다. `manual`이면 `lineupText`는 1~1000자다. 비면 "출연진 문구를 입력하거나 '자동으로 되돌리기'를 눌러 주세요.", 길면 "출연진 문구는 1000자 이내로 입력해 주세요."를 쓴다. `auto`면 `lineupText`를 검사하지 않는다
  - `toPerformanceDayFormValues(day)`: `lineupOverride === null`이면 `lineupMode: "auto"`, `lineupText: day.autoLineup.join(", ")`. 아니면 `"manual"`, `lineupText: lineupOverride`
  - `toPerformanceDayPayload(values)`: `{ dayLabel, dateLabel, bookingUrl, lineupOverride }`. `auto`면 `lineupOverride: null`, `manual`이면 trim한 `lineupText`
- `ticket-schema.ts` (`UpdateTicketDto`) — `description` 0~2000자 "티켓 설명은 2000자 이내로 입력해 주세요."
- `info-sections-schema.ts` (`UpdateInfoSectionsDto`)
  - 섹션 최대 20개 "안내 섹션은 20개 이하여야 합니다.", 섹션 제목 1~100자 "섹션 제목은 1~100자로 입력해 주세요.", 섹션당 항목 최대 50개 "안내 항목은 50개 이하여야 합니다.", 항목 문장 1~500자 "안내 문장은 1~500자로 입력해 주세요.". 항목이 0개인 섹션은 허용한다(서버와 같음)
  - `toInfoSectionsFormValues(sections)`: 서버 배열 → `{ sections: [{ title, items: [{ content }] }] }`. 순서를 유지하고 서버 id는 폼 값에 넣지 않는다 (RHF `useFieldArray`가 자체 key를 만든다)
  - `toInfoSectionsPayload(values)`: 폼 값 → `{ sections: [{ title, items: [{ content }] }] }`. 순서를 유지하고 문자열을 trim한다. id 같은 다른 필드는 넣지 않는다

### 6. 페이지

모든 페이지는 `app/(admin)/teams/page.tsx` 구조를 따른다: 서버 컴포넌트는 `metadata`(`"<메뉴 라벨> · SUMMIT 관리자"`)만 맡고, `*-page-client.tsx`(클라이언트)를 렌더링한다. 조회 중에는 `LoadingState`, 실패하면 `ErrorState`(다시 시도)를 쓴다. 제목은 `PageHeader`에 메뉴 라벨과 한 줄 설명을 넣는다.

- **`/concert` (공연 기본 정보, F014·F015)** — `concert-page-client.tsx`
  - 텍스트 폼: 국문 제목, 영문 제목, 부제, 시작일·종료일(`<input type="date">`), 공연 시간(placeholder `18:00 ~ 21:00`). 저장 시 `updateConcert`를 호출한다. 성공하면 응답 `data`로 `form.reset`하고 invalidate한다
  - 이미지 3칸: 포스터(메인 배경), 제목 이미지, 부제 이미지 → 각각 `ConcertImageField` + `uploadConcertImage(slot)`. alt는 포스터는 "공연 포스터", 제목 이미지는 `titleKo`, 부제 이미지는 `subtitle ?? titleKo`
  - 공개 경로 `PUBLIC_PAGE_PATHS.concert`
- **`/performance-days` (일차별 공연, F019·F020)** — `performance-days-page-client.tsx`
  - `listPerformanceDays()` 결과를 순서대로 일차 카드(`Card`)로 보여 준다. 카드마다 독립된 폼·저장 버튼과 타임 테이블 `ConcertImageField`(`uploadTimetableImage(dayKey)`, alt `"<dayLabel> 타임 테이블"`)를 둔다. 카드 제목은 `dayLabel (dayKey)`
  - 폼: 일차 라벨, 날짜 라벨(placeholder `6.25 (목) 18:00`), 예매 링크, 출연진
  - 출연진 자동 모드: `autoLineup.join(", ")`을 읽기 전용 텍스트로 보여 준다(비면 "팀 관리에 이 일차 팀이 없습니다."). "팀 관리 순서대로 자동 표시됩니다" 안내와 "직접 수정" 버튼을 둔다
  - "직접 수정"을 누르면 `lineupMode`를 `manual`로 바꾼다. `lineupText`가 비어 있으면 자동 문구로 채운 `Textarea`를 보여 준다. 경고 "직접 수정 중에는 팀 관리 변경이 자동 반영되지 않습니다."와 "자동으로 되돌리기" 버튼을 둔다
  - "자동으로 되돌리기"는 폼의 `lineupMode`만 `auto`로 바꾼다. **저장 버튼을 눌러야 반영된다**(`toPerformanceDayPayload`가 `lineupOverride: null`을 보낸다)
  - 저장하면 `updatePerformanceDay(dayKey, toPerformanceDayPayload(values))`를 호출하고, 성공하면 응답 `data`로 그 카드 폼을 리셋하고 invalidate한다. 공개 경로 `PUBLIC_PAGE_PATHS.performanceDays`
- **`/ticket` (티켓 안내, F021·F022)** — `ticket-page-client.tsx`
  - 티켓 앞면·뒷면 `ConcertImageField`(`uploadTicketImage(side)`, alt "티켓 앞면"·"티켓 뒷면")
  - 티켓 설명 폼(`Textarea`) → `updateTicket`
  - 요금 안내 편집기: `InfoSectionsEditor category="ticket"`. 제목 "요금 안내", 섹션 예시 placeholder "입장 요금 안내"
  - 공개 경로 `PUBLIC_PAGE_PATHS.ticket`
- **`/notice` (관람 유의사항, F023)** — `notice-page-client.tsx`
  - `InfoSectionsEditor category="notice"`. 섹션 예시 placeholder "관객 안전 안내". 공개 경로 `PUBLIC_PAGE_PATHS.notice`

### 7. 안내 섹션 편집기 (`components/concert-content/info-sections-editor.tsx`)

- `InfoSectionsEditor({ category, title, sectionPlaceholder, publicPath })`: 자체적으로 `listInfoSections(category)`를 조회하고(`queryKeys.infoSections(category)`), RHF + `zodResolver(infoSectionsSchema)` + `useFieldArray`로 편집한다
- 섹션: 추가(맨 뒤), 제목 수정, 삭제, 위로·아래로(첫·마지막에서는 비활성). 항목: 섹션 안에서 추가(맨 뒤), 문장 수정(`Textarea`), 삭제, 위로·아래로. 섹션 20개·항목 50개에 도달하면 추가 버튼을 비활성화한다
- 삭제는 저장 전까지 폼에서만 일어나므로 확인 대화상자를 두지 않는다. 대신 "저장해야 사이트에 반영됩니다" 안내를 둔다. 섹션이 0개면 "등록된 안내가 없습니다. '섹션 추가'로 시작하세요."를 보여 준다
- "저장"은 `updateInfoSections(category, toInfoSectionsPayload(values))`를 호출한다. 성공하면 **응답 `data`로 `form.reset(toInfoSectionsFormValues(data))`**(서버가 id를 새로 발급하므로)하고 invalidate한 뒤 `SaveResultNotice`를 보여 준다. 섹션이 0개인 저장도 허용한다(해당 분류 전체 삭제)
- 아이콘 버튼에는 `aria-label`을 단다 (예: "섹션 위로 이동", "항목 삭제")

### 8. 공통 원칙

- 서버 문자열(제목·안내 문장·출연진 등)은 텍스트로만 렌더링한다. `dangerouslySetInnerHTML`을 쓰지 않는다
- 매핑(슬롯→라벨, 메뉴→아이콘 등)은 `switch` 대신 `Record` 객체로 둔다 (`.claude/rules/code-style.md`)
- 새 파일의 주석은 한국어, 기존 파일의 주석 밀도·스타일을 따른다

## 수용 기준

- AC-01 `NAV_ITEMS`의 라벨 순서가 `팀 관리, 곡 관리, 유튜브 연결 관리, 공연 기본 정보, 일차별 공연, 티켓 안내, 관람 유의사항`이고, 뒤 4개만 `group`이 `"공연 콘텐츠"`이며 href가 설계 결정 1의 표와 같다. `findNavItem("/performance-days")`가 "일차별 공연"을 돌려준다 (`src/lib/nav.test.ts`)
- AC-02 `sidebar.tsx`의 `NAV_ICONS`에 새 href 4개가 설계 결정 1의 아이콘으로 있고, 그룹 제목 "공연 콘텐츠"를 그리는 코드가 있다
- AC-03 `concert-content.ts`의 함수 11개가 설계 결정 2의 표대로 `apiRequest`를 호출한다: 메서드, 경로(`encodeURIComponent` 적용, 예: `dayKey`가 `"day 1"`이면 `/performance-days/day%201`), JSON 본문. 업로드 3종은 본문이 `file` 필드 하나뿐인 `FormData`이고 `timeoutMs` 기본값이 30000이다 (`src/lib/api/concert-content.test.ts`, `vi.mock("./client")`)
- AC-04 `src/lib/api/types.ts`의 `Concert`·`PerformanceDay`·`Ticket`·`InfoSection`이 서버 `content-response.ts`의 응답 인터페이스와 필드 이름·nullable이 같고, `SaveResult<T>`가 `{ data: T; revalidated: boolean }`이다
- AC-05 `concertSchema`가 설계 결정 5의 표대로 통과·거부하고 문구가 같다. 특히 `2026-02-30` 거부, `endDate`가 `startDate`보다 빠르면 `endDate` 경로에 "종료일은 시작일보다 빠를 수 없습니다.", 같은 날짜는 통과한다 (`src/lib/concert-content/concert-schema.test.ts`)
- AC-06 `optionalHttpsUrl`이 빈 문자열과 `https://forms.gle/abc`를 통과시키고, `http://…`·`javascript:alert(1)`·`https://user:pw@example.com`·2049자 URL을 "https로 시작하는 올바른 주소를 입력해 주세요."로 거부한다 (`src/lib/concert-content/content-rules.test.ts`)
- AC-07 `performanceDaySchema`가 `manual` 모드의 빈 `lineupText`를 설계 결정 5의 문구로 거부하고 `auto` 모드에서는 `lineupText`를 검사하지 않는다. `toPerformanceDayFormValues`는 `lineupOverride === null`이면 `auto` + `autoLineup.join(", ")`이고, `toPerformanceDayPayload`는 `auto`면 `lineupOverride: null`, `manual`이면 trim한 문구를 돌려준다 (`src/lib/concert-content/performance-day-schema.test.ts`)
- AC-08 `ticketSchema`가 2001자 설명을 거부하고 빈 설명을 통과시킨다. `infoSectionsSchema`가 섹션 21개·항목 51개·빈 제목·501자 문장을 설계 결정 5의 문구로 거부하고 항목 0개 섹션을 통과시킨다 (`ticket-schema.test.ts`, `info-sections-schema.test.ts`)
- AC-09 `toInfoSectionsFormValues`·`toInfoSectionsPayload`가 섹션·항목 순서를 유지하고, 결과에 `id` 키가 없으며, 페이로드 문자열이 trim되어 있다 (`info-sections-schema.test.ts`)
- AC-10 `checkConcertImageFile`이 0바이트 → `CARD_IMAGE_MESSAGES.required`, 2MB+1바이트 → "이미지 크기는 2MB를 넘을 수 없습니다.", 1.5MB PNG 시그니처 → 통과, 텍스트 바이트 → `CARD_IMAGE_MESSAGES.unsupported`를 돌려준다 (`src/lib/concert-content/concert-image.test.ts`)
- AC-11 `buildPublicPageUrl`이 `("/notice", "https://summit-concert.live/")` → `"https://summit-concert.live/notice"`, `("/", "https://summit-concert.live")` → `"https://summit-concert.live/"`, 오리진이 `undefined`·빈 값·`javascript:alert(1)`이면 `null`을 돌려준다 (`src/lib/concert-content/public-page-url.test.ts`)
- AC-12 `apps/admin/src`에 `dangerouslySetInnerHTML` 속성 사용(`dangerouslySetInnerHTML=`)이 없고 (기존 주석의 금지 문구는 해당 없음), `src/components/concert-content/`에 `onMutate`·`setQueryData`가 없다
- AC-13 설계 결정 6의 페이지 파일 4개가 있고, 각 `page.tsx`가 `metadata.title`만 정의하고 해당 `*-page-client.tsx`를 렌더링하며 `"use client"`가 없다
- AC-14 `apps/admin`에서 `npm run lint`·`npm run build`·`npm run typecheck`·`npm test`가 통과한다
- AC-15 `origin/develop` 대비 변경 파일이 모두 `apps/admin/` 아래이고 `src/lib/csp.ts`·`src/lib/csp.test.ts`·`.env.example`·`package.json`·`package-lock.json`·`src/lib/teams/card-image.ts`·`src/components/teams/`는 바뀌지 않았다
- AC-16 [manual] 로컬 API + 관리자 앱에서 `/concert`·`/performance-days`·`/ticket`·`/notice`의 텍스트 저장이 각각 성공하고, 새로고침 후에도 값이 유지된다. 저장 직후 "사이트 반영이 지연될 수 있습니다(최대 1시간)" 경고가 보인다 (로컬 공개 사이트에 재검증 엔드포인트가 아직 없어 `revalidated: false`). 종료일을 시작일보다 앞으로 넣으면 요청 없이 폼 오류가 뜬다
- AC-17 [manual] `/concert` 포스터와 `/performance-days` 1일차 타임 테이블에 2MB 이하 이미지를 올리면 썸네일이 새 이미지로 바뀐다. 2MB 초과 파일과 `.txt` 파일은 업로드 버튼이 활성화되기 전에 설계 결정 4의 문구로 거부된다. 브라우저 콘솔에 CSP 위반 메시지가 없다
- AC-18 [manual] `/performance-days`에서 출연진 "직접 수정"으로 문구를 바꿔 저장한 뒤 새로고침하면 직접 수정 모드로 열린다. "자동으로 되돌리기" 후 저장하고 새로고침하면 자동 모드로 열리고 팀 관리 순서의 팀명이 보인다. `/notice`에서 섹션 2개(각 항목 2개)를 만들고 순서를 바꿔 저장하고 새로고침하면 바꾼 순서 그대로 보인다

## 테스트 계획

**커밋하기 전에** 실행하고 명령과 결과를 PR 본문에 남긴다. 새 파일은 `git add`로 스테이지한 뒤 실행한다.

```bash
# 저장소 루트
git diff --cached --name-only origin/develop -- . ':!apps/admin'      # 출력 없음 (AC-15)
git diff --cached --name-only origin/develop -- apps/admin/src/lib/csp.ts apps/admin/src/lib/csp.test.ts apps/admin/.env.example apps/admin/package.json apps/admin/package-lock.json apps/admin/src/lib/teams/card-image.ts apps/admin/src/components/teams   # 출력 없음 (AC-15)
git grep -nE --cached "dangerouslySetInnerHTML\s*=" -- apps/admin/src          # 출력 없음 (AC-12)
git grep -nE --cached "onMutate|setQueryData" -- apps/admin/src/components/concert-content   # 출력 없음 (AC-12)
git status --short                                                    # 스테이지되지 않은 변경 없음

# apps/admin 폴더
npm run lint        # 통과 (AC-14)
npm run typecheck   # 통과 (AC-14)
npm test            # 통과 (AC-14)
npm run build       # 통과 (AC-14)
```

- 테스트는 실제 네트워크·API에 접속하지 않는다. API 모듈은 `lib/api/youtube.test.ts`처럼 `vi.mock("./client")`로 `apiRequest` 호출 인자만 단언한다. `File`·`FormData`는 Node 20 전역을 쓴다
- `next dev`가 `apps/admin/AGENTS.md`를 다시 쓰면(파일 안 주석 참조) 그 변경은 커밋하지 않는다 — AC-15 범위 밖 변경이 생기지 않게 한다

### 사용자 확인 절차 (AC-16~AC-18) — PR 생성 후 사용자에게 요청할 내용

Codex는 PR을 만든 뒤 아래 절차를 사용자에게 그대로 안내하고 끝낸다 (실행하지 않는다). 로컬 `apps/api/.env`는 프로덕션 DB·Storage를 가리킨다. 그래서 이 확인은 마이그레이션이 넣은 임시값 행(`"(입력 필요)"`)을 실제로 바꾼다. **실제 공연 정보를 넣어도 된다** — T6(실제 데이터 입력)을 미리 하는 셈이고, 공개 사이트는 T5 머지 전까지 이 값을 읽지 않는다. 올린 이미지 객체는 기존 정책대로 지우지 않는다.

1. 공유 폴더에서 PR 브랜치를 체크아웃하고, `apps/api`에서 `npm run start:dev`, `apps/admin`에서 `npm run dev`를 실행한다 (admin `.env.local`의 `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001`, API `.env`의 `CORS_ALLOWED_ORIGINS`에 `http://localhost:3010`)
2. `http://localhost:3010`에 로그인한다 → 사이드바에 "공연 콘텐츠" 제목 아래 메뉴 4개가 보이는지 확인한다
3. (AC-16) `/concert`: 제목·날짜·시간을 입력하고 저장한다 → 지연 경고가 표시되는지, 새로고침 후 값이 유지되는지 확인한다. 종료일을 시작일보다 앞으로 넣으면 폼 오류가 뜨는지 확인한다. `/ticket` 설명, `/performance-days` 1일차 라벨·예매 링크, `/notice`도 같은 방식으로 확인한다
4. (AC-17) `/concert` 포스터에 2MB 이하 PNG/JPEG를 선택 → 미리보기 → "이미지 업로드" → 썸네일이 바뀌는지 확인한다. 2MB 초과 파일과 `.txt`는 선택 즉시 오류 문구가 뜨는지 확인한다. `/performance-days` 1일차 타임 테이블도 한 번 올린다. 개발자 도구 콘솔에 `Content-Security-Policy` 위반이 없는지 확인한다
   - 썸네일이 깨지면 admin `.env.local`의 `NEXT_PUBLIC_SUPABASE_STORAGE_ORIGIN`이 설정됐는지 먼저 확인한다
5. (AC-18) `/performance-days` 1일차: "직접 수정" → 문구 수정 → 저장 → 새로고침 → 직접 수정 모드인지 확인한다. "자동으로 되돌리기" → 저장 → 새로고침 → 자동 모드와 팀명 목록을 확인한다. `/notice`에서 섹션 2개·항목 각 2개 → 순서 변경 → 저장 → 새로고침 → 순서를 확인한다
6. 확인이 끝나면 PR 본문의 AC-16~AC-18을 체크하고 머지한다. 관리자 앱 Vercel 배포는 머지 후 자동으로 된다 (이 명세는 새 환경변수가 없다)
