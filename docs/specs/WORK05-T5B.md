---
spec_id: WORK05-T5B
revision: 0
---

# WORK05-T5B — 공개 사이트 공연 정보 DB 조회 전환 (포스터·페이지·헤더·지도)

## 배경

- work05의 목표는 공개 사이트에 하드코딩된 공연 정보를 DB 한 곳에서 관리하는 것이다 (`docs/specs/prd-construction.md`, `.claude/rules/work-05-construction.md`). WORK05-T5A(#88)로 조회 계층과 재검증 엔드포인트가 머지됐고, 공개 페이지는 아직 하드코딩 값을 쓴다
- 이 명세는 `docs/specs/work05-implementation.md` **T5의 뒷부분(D10)** 이다. 두 문서가 다르면 **이 명세가 우선**한다. D10 목록에 없던 **공용 헤더의 예매 링크·공연장 URL**도 사용자 결정(2026-10-26)으로 이 명세에 포함한다
- 이미 있는 것 (T5A, 바꾸지 않고 그대로 쓴다)
  - `src/lib/concert-content.ts`: `getConcert()`, `getVenue()`, `getPerformanceDays()`(dayKey 숫자순), `getTicket()`, `getInfoSections(category)`(`"ticket" | "notice"`, 섹션·항목 sortOrder순), `getLineupByDay()`(`Record<dayKey, 팀명[]>`, 공연 순서). 모두 `server-only` + React `cache` + 태그 캐시(`force-cache`, 1시간 안전망). 실패하면 `ConcertContentError`를 던진다
  - `src/types/concert-content.ts`: 선택 값은 `string | null` (빈 문자열은 `null`로 정규화됨), 좌표는 `number`
  - `src/lib/concert-content-format.ts`: `formatHomeDateRange`, `formatTicketDateRange`, `formatBookingLineup` (순수 함수, import 없음)
- 현재 하드코딩 위치 (2026-10-26 `origin/develop` 기준으로 직접 확인)
  - 포스터 `/concert-poster-latest.png` **10곳**: `src/app/{page,book,desktop-404,location,notice,ticket-info,time-table}/page.tsx`(7), `src/app/{setlist,event-goods}/layout.tsx`(2), `src/components/ui/setlist-detail-modal.tsx`(1개 파일 안에 모바일·데스크탑 2개)
  - Home(`src/app/page.tsx`): 타이틀 이미지 `/hero-hanja.png`·`/hero-subtitle.png`, 제목 "2026년 SUMMIT 여름공연", 장소 "플렉스라운지 (서울특별시 마포구 양화로 100-10)", 날짜 "2026-06-25 ~ 2026-06-26"
  - Stage Info: `src/components/sections/facility-service-section.tsx`의 `serviceCardHrefById.StageInfoCard`
  - Time Table(`src/app/time-table/page.tsx`): **페이지 전체가 `"use client"`** 이고 이미지 경로 2개가 고정
  - Ticket Info(`src/app/ticket-info/page.tsx`): 티켓 앞/뒤 이미지, 티켓 설명, 요금 안내 2개 섹션, 공연 기본 정보(공연명·일시·장소·부제)
  - Contact Us(`src/app/location/page.tsx`): 네이버 지도 링크 상수, 주소 텍스트. `src/components/common/naver-map.tsx`: 좌표 상수 `VENUE_LAT`·`VENUE_LNG`, 말풍선 HTML의 장소명·주소(현재 "관악구 남부순환로 1937"로 다른 페이지와 불일치)
  - 관람 유의사항(`src/app/notice/page.tsx`): 섹션 2개(관객 안전 안내·주차 안내) 항목 배열
  - 예매하기(`src/app/book/page.tsx`): `bookDayCards` (일차 라벨·날짜 라벨·출연진 줄·예매 링크)
  - 공용 헤더(`src/components/layout/site-header.tsx`, `"use client"`, 9개 파일에서 `<SiteHeader />`로 사용): `mobileMenuHrefByItem`의 "1일차 공연"·"2일차 공연"(forms.gle)과 "공연장 안내"(공연장 URL). 사용처 9곳 중 클라이언트 파일은 `time-table/page.tsx`뿐이다
- 셋리스트 상세 모달은 `src/app/setlist/page.tsx`(서버) → `src/components/sections/setlist-view.tsx`(클라이언트) → `setlist-detail-modal.tsx`(클라이언트) 순서로 렌더링된다
- 현재 빌드 라우트 표 (#88 PR 본문): `/`·`/book`·`/desktop-404`·`/location`·`/notice`·`/ticket-info`·`/time-table`은 ○(Static), `/setlist`·`/event-goods`·`/api/revalidate`는 ƒ(Dynamic). 공연 콘텐츠 조회는 `force-cache` 태그 fetch라 페이지를 동적으로 만들지 않아야 한다 (work01 성능 성과 유지)
- 프로덕션 DB에는 T2 마이그레이션의 임시값(`'(입력 필요)'`, 날짜 `2000-01-01`, 이미지 NULL)이 들어 있다. 실제 값은 T6(사용자 입력)에서 채운다 → **이 PR은 T6 완료 전에 머지하지 않는다** (머지하면 임시값이 공개 사이트에 노출된다)
- 루트 CI는 `npm run lint`·`npm run typecheck`만 실행하고 루트 `npm run build`는 실행하지 않는다. 그래서 빌드 결과는 `[manual]` 기준으로 둔다 (T5A r1과 같음). 루트에는 테스트 러너가 없으므로 순수 함수는 Node 24 type stripping으로 직접 불러 확인한다 (T5A와 같은 방식)

## 범위

**포함** (모두 저장소 루트의 공개 사이트)

- 수정: `src/app/page.tsx`, `src/app/book/page.tsx`, `src/app/desktop-404/page.tsx`, `src/app/location/page.tsx`, `src/app/notice/page.tsx`, `src/app/ticket-info/page.tsx`, `src/app/time-table/page.tsx`, `src/app/setlist/layout.tsx`, `src/app/setlist/page.tsx`, `src/app/event-goods/layout.tsx`
- 수정: `src/components/common/naver-map.tsx`, `src/components/sections/facility-service-section.tsx`, `src/components/sections/setlist-view.tsx`, `src/components/ui/setlist-detail-modal.tsx`, `src/components/layout/site-header.tsx`, `src/lib/concert-content-format.ts`(함수 1개 추가)
- 신규: `src/components/layout/site-header-nav.tsx`, `src/components/sections/time-table-view.tsx`, `src/lib/escape-html.ts`
- 신규(선택): `src/components/common/poster-background.tsx` — 포스터 배경 마크업을 묶고 싶을 때만 (설계 결정 1)

**제외**

- `src/lib/concert-content.ts`, `src/lib/supabase-content.ts`, `src/lib/content-tags.ts`, `src/types/concert-content.ts`, `src/app/api/revalidate/route.ts` (T5A 결과물, 그대로 사용)
- `src/lib/supabase.ts`, `src/lib/fetch-line-up-and-setlist.ts`, `src/app/event-goods/page.tsx`, `src/app/setlist/page.tsx`의 셋리스트 조회 방식, `next.config.ts` (셋리스트 no-store 유지, `remotePatterns`는 이미 `**.supabase.co` 허용)
- `public/`의 이전 이미지 파일 삭제 (`concert-poster-latest.png`, `hero-*.png`, `ticket-*.png`, `time-table-day*.png`) — 배포 안정화 후 정리 작업으로 처리
- `src/app/layout.tsx`의 `metadata`("Create Next App") — D10 범위가 아니다
- 홈 카드 캐러셀·셋리스트 팀 카드 이미지(`day{1,2}-team*.png` 대체 카드) — 팀 데이터는 기존 Line Up 경로
- `apps/api/`, `apps/admin/`
- `CLAUDE.md` "알려진 이슈"의 하드코딩 항목 상태 갱신, `.claude/rules/work-05-construction.md` 하드코딩 표에 헤더 추가, `work05-implementation.md` 갱신 — 정책 경로·명세 문서라 **머지 후 일반 브랜치 PR로 처리** (Claude가 맡는다)

## 설계 결정

### 1. 포스터 10곳 (`concert.posterImageUrl`)

- 10곳 모두 `getConcert()`의 `posterImageUrl`을 `src`로 쓴다. **`null`이면 포스터 `Image`만 렌더링하지 않고**, 같은 배경 컨테이너 안의 오버레이 `div`(어두운 배경·그라데이션)는 그대로 둔다
- `Image`의 `alt`·`fill`·`width`/`height`·`priority`·`sizes`·`className`은 **기존 값을 그대로** 유지한다 (Home은 `width={835} height={1024}`, 모달은 `alt=""`·`sizes="100vw"`/`"395px"`, 모달은 `priority` 없음)
- 페이지·레이아웃(서버)은 `getConcert()`를 직접 부른다. 모달은 클라이언트라서 `src/app/setlist/page.tsx`가 `getConcert()`로 받은 `posterImageUrl`을 `SetlistView`의 새 prop `posterImageUrl: string | null` → `SetlistDetailModal`의 새 prop `posterImageUrl: string | null`로 넘긴다
- 공용 컴포넌트 `src/components/common/poster-background.tsx`로 묶는 것은 허용하되 필수가 아니다. 묶는다면 `src`가 `null`이면 `null`을 반환하고, 나머지 `Image` 속성은 호출하는 곳이 그대로 넘긴다

### 2. Home (`src/app/page.tsx`)

- `Promise.all([getConcert(), getVenue()])`로 조회한다. 컴포넌트는 `async` 서버 컴포넌트가 된다
- 제목 `h1` = `concert.titleKo`
- 장소 줄 = `` `${venue.name} (${venue.address})` `` (상세 주소는 Home에 쓰지 않는다 — 현재 표기와 같음)
- 날짜 줄 = `formatHomeDateRange(concert.startDate, concert.endDate)`
- 타이틀 이미지: `titleImageUrl`이 있으면 `alt={concert.titleKo}`, `subtitleImageUrl`이 있으면 `alt={concert.subtitle ?? ""}`로 렌더링한다. 각각 `null`이면 그 `FadeInUp` 블록째 렌더링하지 않는다. `width`·`height`·`className`은 기존 값 유지
- `<FacilityServiceSection stageInfoUrl={venue.websiteUrl} />` — 설계 결정 3

### 3. Stage Info (`src/components/sections/facility-service-section.tsx`)

- 서버 컴포넌트를 유지하고 prop `stageInfoUrl: string | null`을 받는다
- `serviceCardHrefById`에서 `StageInfoCard` 항목을 지우고, 렌더링할 때 `StageInfoCard`의 `href`는 `stageInfoUrl ?? undefined`로 준다. `undefined`면 기존 `ServiceCard`의 href 없음 분기(`aria-disabled` 버튼)를 그대로 탄다

### 4. 공용 헤더 (`site-header.tsx` → 서버 래퍼 + `site-header-nav.tsx`)

- 기존 `site-header.tsx`의 내용 전체를 새 파일 `src/components/layout/site-header-nav.tsx`(`"use client"`, `export default function SiteHeaderNav`)로 옮긴다
- `site-header.tsx`는 `"use client"`를 지우고 `export default async function SiteHeader()`로 바꾼다. **사용하는 9곳의 import·`<SiteHeader />` 호출은 바꾸지 않는다**
  - `Promise.all([getPerformanceDays(), getVenue()])`로 조회한다
  - `bookingItems = days.map((day) => ({ label: formatTimetableTabLabel(day.dayKey, day.dayLabel), href: day.bookingUrl }))`
  - `<SiteHeaderNav bookingItems={bookingItems} stageInfoUrl={venue.websiteUrl} />`
- `SiteHeaderNav` props: `bookingItems: { label: string; href: string | null }[]`, `stageInfoUrl: string | null`
  - 모바일 메뉴 "예매하기" 섹션의 `items`는 `bookingItems`의 `label`들이다 (고정 `["1일차 공연", "2일차 공연"]`을 쓰지 않는다)
  - 항목의 href: 예매 항목은 해당 `bookingItems[i].href`, "공연장 안내"는 `stageInfoUrl`. 나머지 내부 경로("/time-table" 등)는 기존 값 그대로
  - href가 `null`이면 기존의 href 없음 분기(`button`)로 렌더링한다. 외부 URL(`http`로 시작)은 기존처럼 `<a target="_blank" rel="noopener noreferrer">`
  - forms.gle·공연장 URL 문자열을 이 파일에 남기지 않는다. 마크업·스타일·애니메이션은 바꾸지 않는다

### 5. 타임 테이블 (`src/app/time-table/page.tsx` → 서버 + `time-table-view.tsx`)

- `page.tsx`에서 `"use client"`를 지우고 `async` 서버 컴포넌트로 바꾼다. `Promise.all([getConcert(), getPerformanceDays()])`로 조회하고, `SiteHeader`·`main`·포스터 배경(설계 결정 1)을 렌더링한 뒤 `main` 안에 `<TimeTableView days={...} />`를 둔다
- `days` = `getPerformanceDays()` 결과를 `{ dayKey, label: formatTimetableTabLabel(dayKey, dayLabel), imageUrl: timetableImageUrl }[]`로 바꾼 것
- `src/components/sections/time-table-view.tsx` (`"use client"`): 기존 `section`(제목·탭·이미지)과 확대 오버레이, `Escape` 키 처리를 옮긴다
  - 선택 상태는 `dayKey` 문자열이다. 초기값은 `days[0]?.dayKey`. 탭은 `days`를 순서대로 만들고 문구는 `label`, 기존 버튼 클래스 유지
  - 선택한 일차의 `imageUrl`이 있으면 `Image`(`key={dayKey}`, `alt={`${label} 타임 테이블`}`, 확대 이미지는 `alt={`${label} 타임 테이블 확대 이미지`}`, 기존 `width`·`height`·`sizes`·`unoptimized`·`className` 유지)를 렌더링하고, `null`이면 이미지와 확대 기능을 렌더링하지 않는다
  - `days`가 비어 있으면 탭과 이미지 없이 제목만 남는다
- `formatTimetableTabLabel(dayKey, dayLabel)`를 `src/lib/concert-content-format.ts`에 추가한다 (사용자 결정: 지금 표기 유지)
  - `dayKey`가 `/^day(\d+)$/`이면 `` `${Number(숫자)}일차 공연` `` (`day1` → "1일차 공연", `day02` → "2일차 공연")
  - 아니면 `dayLabel`을 그대로 돌려준다
  - 이 파일은 계속 **아무것도 import하지 않는다**

### 6. 티켓 안내 (`src/app/ticket-info/page.tsx`)

- `Promise.all([getConcert(), getVenue(), getTicket(), getInfoSections("ticket")])`로 조회한다
- 티켓 이미지: 앞면은 `frontImageUrl`, 뒷면은 `backImageUrl`. 각 칸(테두리 `div`)은 URL이 있을 때만 렌더링한다. **둘 다 `null`이면 이미지 그리드 `div` 전체를 렌더링하지 않는다.** `alt`("티켓 앞면"/"티켓 뒷면")·`width`·`height`·`sizes`·`className` 유지
- 티켓 설명: 기존 문구 자리의 `p`에 `ticket.description`을 넣고 `whitespace-pre-line`을 추가한다. `null`이면 그 `p`를 렌더링하지 않는다 ("티켓 앞면 / 뒷면" 제목은 유지)
- 요금 안내: `getInfoSections("ticket")`의 섹션마다 기존 `section` + `h3`(섹션 제목) + `ul`을 만든다. 항목은 **기존 "여분 티켓 안내"의 마크업**(`li.flex.gap-1.5` 안에 `-` `span`과 내용 `span`)으로 통일한다. 항목 내용에 `-`를 덧붙이지 않는다(데이터에는 대시 없이 입력한다). 섹션이 0개면 요금 안내 섹션 목록이 비고, "공연 기본 정보" 섹션은 그대로 남는다
- 공연 기본 정보: 공연명 = `concert.titleEn`, 일시 = `formatTicketDateRange(concert.startDate, concert.endDate, concert.showTime)`, 장소 = `venue.name`, 부제 = `concert.subtitle` (`null`이면 부제 항목 `div`를 렌더링하지 않는다)
- React `key`는 같은 문구가 겹쳐도 안전하도록 인덱스를 포함한다 (섹션 `${index}-${title}`, 항목 `${index}`)

### 7. 오시는 길 + 지도 (`location/page.tsx`, `naver-map.tsx`, `escape-html.ts`)

- `location/page.tsx`: `Promise.all([getConcert(), getVenue()])`로 조회한다
  - 지도: `<NaverMap latitude={venue.latitude} longitude={venue.longitude} name={venue.name} address={venue.address} />`
  - 주소 텍스트 = `venue.addressDetail ? `${venue.address} ${venue.addressDetail}` : venue.address`
  - "네이버 지도에서 보기" 링크는 `venue.naverMapUrl`이 있을 때만 렌더링한다. `NAVER_MAP_URL` 상수를 지운다
- `naver-map.tsx`: `VENUE_LAT`·`VENUE_LNG` 상수를 지우고 props `{ latitude: number; longitude: number; name: string; address: string }`을 받는다. `useEffect` 의존성 배열에 네 값을 넣는다
  - 말풍선 `content`에 넣는 `name`·`address`는 **반드시 `escapeHtml`을 거친다** (DB 값이 HTML로 해석되면 XSS). 마크업·스타일은 기존 그대로
- 신규 `src/lib/escape-html.ts`: `export function escapeHtml(value: string): string` — `&`→`&amp;`, `<`→`&lt;`, `>`→`&gt;`, `"`→`&quot;`, `'`→`&#39;`. 한 번의 `replace`로 처리해 `&`가 두 번 바뀌지 않게 한다. **아무것도 import하지 않는다**

### 8. 관람 유의사항 (`src/app/notice/page.tsx`)

- `Promise.all([getConcert(), getInfoSections("notice")])`로 조회한다. `safetyNoticeItems`·`parkingNoticeItems` 배열과 고정 섹션 제목을 지운다
- 섹션마다 기존 `FadeInUp` + `article`(제목 `h2`, 번호 붙은 `ul`) 마크업을 그대로 쓴다. `FadeInUp`의 `delay`는 `0.1 + index * 0.06` (기존 0.1·0.16과 같다). 번호는 섹션 안에서 1부터
- 섹션이 0개면 제목(`h1`)만 남는다. `key`는 설계 결정 6과 같은 규칙

### 9. 예매하기 (`src/app/book/page.tsx`)

- `Promise.all([getConcert(), getPerformanceDays(), getLineupByDay()])`로 조회한다. `BookDayCard` 타입과 `bookDayCards` 배열을 지운다
- 카드는 `getPerformanceDays()` 순서대로 만들고 `key={day.dayKey}`. 제목 = `dayLabel`, 날짜 줄 = `dateLabel`
- 출연진: `formatBookingLineup(day.lineupOverride, lineupByDay[day.dayKey] ?? [])`를 기존 출연진 `div`(클래스 유지) 안의 `p` 하나에 넣고 `whitespace-pre-line`을 붙인다 (직접 수정값은 줄바꿈 그대로, 자동 모드는 `, `로 이어 한 문단으로 줄바꿈된다)
- "사전 예매하기" 링크는 `bookingUrl`이 있을 때만 렌더링한다 (`target="_blank"`·`rel`·클래스 유지)

### 10. 렌더링 방식과 오류

- 모든 조회는 서버 컴포넌트에서 T5A의 함수로 한다. 클라이언트 컴포넌트(`SiteHeaderNav`, `TimeTableView`, `SetlistView`, `SetlistDetailModal`, `NaverMap`)에는 직렬화 가능한 값만 props로 넘긴다
- `export const dynamic`, `export const revalidate`, `cookies()`·`headers()` 같은 동적 API를 추가하지 않는다. 지금 ○(Static)인 페이지는 변경 후에도 ○(Static, 재검증 주기 표시는 허용)여야 한다
- `ConcertContentError`를 잡아 기본값으로 바꾸지 않는다 (T5A 설계: 빈 값을 캐시하지 않고, 재검증 실패 시 직전 정상 페이지를 유지)

## 수용 기준

- AC-01 테스트 계획의 하드코딩 검색 명령(`git grep -n -E "concert-poster-latest|hero-hanja|..." -- src`)이 아무것도 찾지 않는다 (종료 코드 1). 즉 `src/` 아래에 포스터·타이틀·티켓·타임 테이블 정적 경로, forms.gle·공연장·네이버 지도 URL, 좌표 상수, 주소·날짜·공연명 문자열이 남아 있지 않다
- AC-02 설계 결정 1의 포스터 10곳이 모두 `posterImageUrl`을 `src`로 쓰고, 값이 `null`이면 포스터 `Image`를 렌더링하지 않으며 오버레이 `div`는 남는다. 각 포스터 `Image`의 `alt`·`fill`(또는 Home의 `width`·`height`)·`priority`·`sizes`·`className`이 변경 전과 같다
- AC-03 `SetlistView`와 `SetlistDetailModal`이 `posterImageUrl: string | null` prop을 받고, `src/app/setlist/page.tsx`가 `getConcert()`로 그 값을 넘긴다. 셋리스트 조회(`fetchLineUpRows`·`fetchSetlistRows`)는 바뀌지 않았다
- AC-04 Home이 설계 결정 2대로 `titleKo`, `` `${venue.name} (${venue.address})` ``, `formatHomeDateRange`, 타이틀 이미지(alt `titleKo`·`subtitle ?? ""`, URL이 `null`이면 그 블록 없음)를 쓰고, `FacilityServiceSection`에 `stageInfoUrl={venue.websiteUrl}`를 넘긴다. `FacilityServiceSection`은 `stageInfoUrl`이 `null`이면 Stage Info 카드를 href 없는 버튼으로 렌더링한다
- AC-05 `site-header.tsx`에 `"use client"`가 없고 `async` 함수로 `getPerformanceDays`·`getVenue`를 조회해 `SiteHeaderNav`에 `bookingItems`·`stageInfoUrl`을 넘긴다. `site-header-nav.tsx`는 `"use client"`이며 예매 항목 문구·링크와 "공연장 안내" 링크를 props에서 만들고, href가 `null`이면 버튼으로 렌더링한다. `<SiteHeader />`를 쓰는 9개 파일의 import 경로는 바뀌지 않았다
- AC-06 `src/app/time-table/page.tsx`에 `"use client"`가 없고 서버에서 `getConcert`·`getPerformanceDays`를 조회해 `TimeTableView`에 `days`를 넘긴다. `time-table-view.tsx`는 탭을 `days`로 만들고, 선택한 일차의 `imageUrl`이 `null`이면 이미지와 확대 기능을 렌더링하지 않는다. 이미지의 `unoptimized`·`width`·`height`·`sizes`는 유지된다
- AC-07 Ticket Info가 설계 결정 6대로 티켓 이미지(각 칸은 URL이 있을 때만, 둘 다 `null`이면 그리드 없음), 설명(`whitespace-pre-line`, `null`이면 `p` 없음), `getInfoSections("ticket")` 섹션·항목, 공연명 `titleEn`·일시 `formatTicketDateRange`·장소 `venue.name`·부제 `subtitle`(`null`이면 항목 없음)을 렌더링한다
- AC-08 `naver-map.tsx`가 `latitude`·`longitude`·`name`·`address` props를 받고 좌표 상수가 없으며, 말풍선 HTML에 넣는 `name`·`address`가 모두 `escapeHtml`을 거친다. `location/page.tsx`는 그 props와 주소 텍스트(상세 주소 포함)를 venue에서 만들고, `naverMapUrl`이 `null`이면 "네이버 지도에서 보기" 링크를 렌더링하지 않는다
- AC-09 `escapeHtml`이 테스트 계획의 Node 확인 명령에서 `&lt;b&gt;test&lt;/b&gt; | a &amp; b | &quot;x&quot; | it&#39;s | 플렉스라운지 | &amp;lt;`를 출력한다. `src/lib/escape-html.ts`에 `import`가 없다
- AC-10 `formatTimetableTabLabel`이 테스트 계획의 Node 확인 명령에서 `1일차 공연 | 2일차 공연 | 특별 공연`을 출력하고, T5A의 기존 표기 함수 확인 명령도 T5A 명세의 기대값을 그대로 출력한다. `src/lib/concert-content-format.ts`에 `import`와 `new Date`가 없다
- AC-11 관람 유의사항이 `getInfoSections("notice")`의 섹션마다 기존 `article` 마크업을 만들고(`delay` `0.1 + index * 0.06`), 고정 항목 배열이 없다. 예매하기가 `getPerformanceDays()` 순서로 카드를 만들고, 출연진은 `formatBookingLineup(lineupOverride, lineupByDay[dayKey] ?? [])`를 `whitespace-pre-line`으로, 예매 링크는 `bookingUrl`이 있을 때만 렌더링한다
- AC-12 변경된 파일에 `export const dynamic`·`export const revalidate`·`cookies(`·`headers(`가 추가되지 않았고, `ConcertContentError`를 `catch`해 기본값으로 바꾸는 코드가 없다
- AC-13 `origin/develop` 대비 변경 파일이 범위 "포함"의 파일뿐이다. `src/lib/concert-content.ts`·`src/lib/supabase-content.ts`·`src/lib/supabase.ts`·`src/lib/fetch-line-up-and-setlist.ts`·`src/app/event-goods/page.tsx`·`src/app/api/`·`next.config.ts`·`public/`·`apps/`·`package.json`은 바뀌지 않았다
- AC-14 루트에서 `npm run lint`·`npm run typecheck`가 통과한다
- AC-15 [manual] 루트 `npm run build`가 성공하고, 라우트 표에서 `/`·`/book`·`/desktop-404`·`/location`·`/notice`·`/ticket-info`·`/time-table`이 변경 전처럼 ○(Static)이며(재검증 주기 표시는 허용) ƒ(Dynamic)로 바뀐 페이지가 없다. Codex는 변경 전·후 두 빌드의 라우트 표를 PR 본문에 붙이고, **사용자가 두 표를 비교한다**
- AC-16 [manual] 로컬 프로덕션 실행에서 9개 공개 화면(Home, 예매하기, 타임 테이블, 티켓 안내, 오시는 길, 관람 유의사항, 셋리스트·상세 모달, 셋리스트 전체 보기, 모바일 메뉴)이 DB 값으로 표시되고, 관리자에서 값을 저장한 뒤 새로고침하면 바뀐 값이 보이며, 공연장 이름에 `<b>test</b>`를 저장해도 지도 말풍선에 글자 그대로 보인다
- AC-17 [manual] 사용자가 T6(실제 공연 데이터 입력)을 끝낸 뒤에만 이 PR을 머지한다

## 테스트 계획

**커밋하기 전에** 실행하고 명령과 결과를 PR 본문에 남긴다. 새 파일은 `git add`로 스테이지한 뒤 실행한다.

```bash
# 변경 전 (작업 시작 직후, origin/develop 상태) — 라우트 표 저장 (AC-15)
npm run build

# 저장소 루트 — 하드코딩 제거 (AC-01): 출력 없음, 종료 코드 1
git grep -n -E "concert-poster-latest|hero-hanja|hero-subtitle|ticket-(front|back)\.png|time-table-day|forms\.gle|flexlounge|VENUE_LAT|VENUE_LNG|양화로|관악구|map\.naver\.com/p/|2026-06-2|2026\.06\.25|SUMMIT Summer Festival|여름공연" -- src; echo "exit=$?"

# 포스터 사용처 (AC-02): 아래 10개 파일 각각 1 이상 (모달은 2)
git grep -c "posterImageUrl" -- src/app src/components

# 동적 API·오류 삼키기 없음 (AC-12): 출력 없음
git diff --cached origin/develop -- src | grep -E "^\+.*(export const (dynamic|revalidate)|cookies\(|headers\(|catch)"

# 변경 범위 (AC-13)
git diff --cached --name-only origin/develop                          # 범위 "포함" 파일만
git diff --cached --name-only origin/develop -- src/lib/concert-content.ts src/lib/supabase-content.ts src/lib/supabase.ts src/lib/fetch-line-up-and-setlist.ts src/app/event-goods/page.tsx src/app/api next.config.ts public apps package.json   # 출력 없음
git status --short                                                    # 스테이지되지 않은 변경 없음

# 순수 함수 확인 (Node 24 type stripping, 저장소 루트에서)
node --input-type=module -e "const { escapeHtml: e } = await import('./src/lib/escape-html.ts'); console.log([e('<b>test</b>'), e('a & b'), e('\"x\"'), e(\"it's\"), e('플렉스라운지'), e('&lt;')].join(' | '))"
# 기대 (AC-09): &lt;b&gt;test&lt;/b&gt; | a &amp; b | &quot;x&quot; | it&#39;s | 플렉스라운지 | &amp;lt;

node --input-type=module -e "const f = await import('./src/lib/concert-content-format.ts'); console.log([f.formatTimetableTabLabel('day1','Day 1'), f.formatTimetableTabLabel('day02','x'), f.formatTimetableTabLabel('special','특별 공연')].join(' | '))"
# 기대 (AC-10): 1일차 공연 | 2일차 공연 | 특별 공연

node --input-type=module -e "const f = await import('./src/lib/concert-content-format.ts'); console.log([f.formatHomeDateRange('2026-06-25','2026-06-26'), f.formatHomeDateRange('2026-06-25','2026-06-25'), f.formatTicketDateRange('2026-06-25','2026-06-26','18:00 ~ 21:00'), f.formatTicketDateRange('2026-12-31','2027-01-01','18:00'), f.formatTicketDateRange('2026-06-25','2026-06-25',' '), JSON.stringify(f.formatBookingLineup('A, B\nC', ['x'])), f.formatBookingLineup(null, ['팀1','팀2']), f.formatBookingLineup('  ', ['팀1'])].join(' | '))"
# 기대 (AC-10, T5A 회귀): 2026-06-25 ~ 2026-06-26 | 2026-06-25 | 2026.06.25 ~ 06.26 / 18:00 ~ 21:00 | 2026.12.31 ~ 2027.01.01 / 18:00 | 2026.06.25 | "A, B\nC" | 팀1, 팀2 | 팀1

# 저장소 루트 — CI와 빌드
npm run lint        # 통과 (AC-14)
npm run typecheck   # 통과 (AC-14)
npm run build       # 성공, 변경 후 라우트 표를 PR 본문에 붙인다 (AC-15, [manual])
```

- 명령은 **Git Bash** 기준 따옴표다. Node 확인 명령에서 `[MODULE_TYPELESS_PACKAGE_JSON] Warning`이 함께 나오는 것은 정상이며, `package.json`에 `"type": "module"`을 넣지 않는다 (T5A와 같음). 2026-10-26 `escapeHtml`·`formatTimetableTabLabel`을 설계 결정 그대로의 시제품 모듈로 실행해 위 기대값이 나오는 것을 확인했다. 하드코딩 검색 명령은 변경 전 `origin/develop`에서 13개 파일을 찾는 것을 확인했다. 지도 SDK 주소(`oapi.map.naver.com`)는 남아야 하므로 패턴은 장소 링크 `map.naver.com/p/`만 잡는다
- PowerShell 실행 정책 때문에 `npm`이 막히면 `npm.cmd`로 실행한다 (사용자 허가됨, T5A와 같음)
- `npm run build`는 루트 `.env.local`의 Supabase 값으로 **프로덕션 DB를 읽는다**. T6 전이면 화면 값이 임시값(`(입력 필요)`)이고 이미지가 없는 것이 정상이다. 빌드가 `ConcertContentError`로 실패하면 우회하지 말고 오류 메시지와 함께 멈춰서 보고한다

### 사용자 확인 절차 (AC-15·AC-16·AC-17) — PR 생성 후 사용자에게 요청할 내용

Codex는 PR을 만든 뒤 아래 절차를 사용자에게 그대로 안내하고 끝낸다 (실행하지 않는다).

1. (AC-15) PR 본문의 "변경 전 / 변경 후" 라우트 표를 비교한다. 7개 정적 페이지가 계속 ○이고(오른쪽에 `1h` 같은 재검증 주기가 붙는 것은 정상), ƒ로 바뀐 페이지가 없어야 한다
2. (AC-16) 공유 폴더에서 PR 브랜치를 체크아웃하고 루트에서 `npm install` → `npm run build` → `npm start`(3000). `apps/api`(`PUBLIC_SITE_URL=http://localhost:3000`)는 `npm run start:dev`, `apps/admin`은 `npm run dev`
   - 9개 화면이 DB 값으로 보이는지 확인한다 (T6 전이면 `(입력 필요)`와 이미지 없는 배경이 보이는 것이 정상). 모바일 폭에서 헤더 메뉴의 예매 항목·공연장 안내 링크도 확인한다
   - 관리자에서 공연 기본 정보의 국문 제목을 바꿔 저장 → "저장했습니다." 확인 → 공개 사이트 Home을 새로고침해 새 제목이 보이는지 확인한다
   - 관리자 공연장 정보에서 공연장 이름을 `<b>test</b>`로 저장 → `/location` 지도 말풍선에 `<b>test</b>`가 글자 그대로 보이는지(굵게 되지 않는지) 확인한 뒤 원래 값으로 되돌린다
3. (AC-17) 이 PR은 **T6(실제 데이터 입력)이 끝난 뒤** 머지한다. 머지·배포 후 `/perf-check`로 Home·셋리스트 LCP를 재측정한다 (포스터가 Supabase Storage로 바뀌므로 work01 기준선과 비교 필요)
