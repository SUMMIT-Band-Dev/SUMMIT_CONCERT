---
spec_id: WORK05-T4B
revision: 0
---

# WORK05-T4B — 공연장 정보 관리 화면 (주소 검색 + 지도 위치 보정 + CSP 예외)

## 배경

- work05는 공개 사이트에 하드코딩된 공연 정보를 DB 한 곳에서 관리하도록 옮기는 작업이다 (`docs/specs/prd-construction.md`, `.claude/rules/work-05-construction.md`). WORK05-T4A(#80 명세, #82 구현)에서 관리자 앱에 "공연 콘텐츠" 메뉴와 페이지 4개를 만들었다
- 이 명세는 `docs/specs/work05-implementation.md` **T4의 뒷부분**이다. D8(관리자 지도 CSP 예외)과 D9 가운데 공연장 정보 페이지(`/venue`, PRD F016·F017·F018)를 다룬다. 두 문서가 다르면 **이 명세가 우선**한다
- 서버 계약 (`apps/api/src/concert-content/` 기준, 이미 배포됨)
  - `GET /venue` → `VenueResponse` = `{ id, name, address, addressDetail, latitude, longitude, naverMapUrl, websiteUrl, updatedAt }`. 좌표는 number, 선택 값은 `string | null` (`dto/content-response.ts`)
  - `PUT /venue` 본문 `{ name, address, addressDetail, latitude, longitude, naverMapUrl, websiteUrl }` → `{ data: VenueResponse, revalidated }` (`dto/update-concert-content.dto.ts`의 `UpdateVenueDto`). 선택 문자열은 trim한 뒤 빈 값을 NULL로 저장한다. DB 좌표 컬럼은 `numeric(9,6)`이다
  - `POST /venue/geocode` 본문 `{ address }` → 200 `{ latitude, longitude, roadAddress }`. **DB에 쓰지 않는다** (`venue.controller.ts`, `geocoding/geocoding.service.ts`). 결과 0건이면 404 "주소를 다시 확인하거나 지도에서 직접 위치를 지정해 주세요.", 타임아웃이면 504, 그 밖의 실패는 502 (`geocoding/geocoding.constants.ts`)
- 재사용할 관리자 앱 코드 (`apps/admin/src/` 기준, T4A 결과물)
  - `lib/api/concert-content.ts`(API 함수 패턴), `lib/api/types.ts`(`SaveResult<T>`, `Concert`), `lib/query-keys.ts`
  - `lib/concert-content/content-rules.ts`(`optionalHttpsUrl`), `lib/concert-content/public-page-url.ts`(`PUBLIC_PAGE_PATHS`, `buildPublicPageUrl`), `lib/concert-content/concert-schema.ts`(서버 문구를 옮긴 Zod 패턴)
  - `components/concert-content/concert-page-client.tsx`(조회 → 폼 → 저장 → `form.reset` + invalidate 흐름), `save-result-notice.tsx`, `components/layout/page-*.tsx`, `components/ui/*`
  - 메뉴: `lib/nav.ts`(`group` 필드), `components/layout/sidebar.tsx`(`NAV_ICONS`, 그룹 제목)
  - CSP: `lib/csp.ts`(`buildContentSecurityPolicy`, 고정 오리진 상수 `ALBUM_COVER_IMAGE_ORIGIN` 패턴), `lib/csp.test.ts`, `next.config.ts`(모든 경로에 같은 CSP 헤더)
  - 지도 로딩 참고: 공개 사이트 `src/components/common/naver-map.tsx`(`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=<Client ID>`를 `<script>`로 한 번만 붙이고 `onload`에서 초기화)
- 확인한 사실
  - **네이버 지도가 요청하는 외부 오리진을 실측했다** (2026-10-25, Playwright로 `https://summit-concert.live/location` 모바일 뷰 접속 후 `performance.getEntriesByType("resource")` 집계. 공개 사이트에는 CSP가 없어 차단 없이 전부 기록됨)

| 오리진 | 요청 종류 | 경로 예 | CSP 지시어 |
| --- | --- | --- | --- |
| `https://oapi.map.naver.com` | script | `/openapi/v3/maps.js`, `/v3/auth` | `script-src` |
| `https://nrbe.pstatic.net` | script | `/styles/basic@2x.json` 등 (JSONP) | `script-src` |
| `https://nrbe.pstatic.net` | img | `/styles/basic/.../17/111745/50764@2x.png` (지도 타일) | `img-src` |
| `https://ssl.pstatic.net` | img (CSS의 cursor 포함) | `/static/maps/mantle/2x/marker-default.png`, `openhand.cur`, `new-naver-logo-normal.png` | `img-src` |
| `https://kr-col-ext.nelo.navercorp.com` | xmlhttprequest | `/_store` (네이버 지도 로그 수집) | `connect-src` |

  - 스타일시트(`<link rel=stylesheet>`)·폰트·프레임은 요청하지 않았다. 지도가 넣는 인라인 스타일은 기존 `style-src 'self' 'unsafe-inline'`로 허용된다
  - **CSP는 경로별로 나눌 수 없다.** 관리자 앱은 클라이언트 측 이동을 하므로 문서의 CSP는 처음 연 페이지의 것이 계속 적용된다. `/teams`로 들어와 `/venue`로 이동하면 `/venue` 전용 CSP는 적용되지 않는다. 그래서 네이버 오리진은 `next.config.ts`의 전역 CSP에 추가하고, 지도 스크립트를 실제로 로드하는 곳만 `/venue` 페이지로 제한한다
  - 사용자 작업 완료: NCP Maps Application에 Geocoding 체크, Web 서비스 URL에 `http://localhost:3010`과 어드민 배포 도메인 등록(U2), 로컬 `apps/admin/.env.local`의 `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID`(U4-로컬), 서버 `.env`와 T3 배포(U3·U6)
  - 새 라우트 없이 기존 `GET`·`PUT`·`POST`만 쓴다. CORS 변경이 필요 없다
  - 관리자 앱 테스트는 vitest `environment: "node"`, `src/**/*.test.ts`만 실행한다. 지도 컴포넌트는 브라우저가 필요하므로 [manual] 기준으로 확인하고, 로직은 순수 함수로 빼서 테스트한다

## 범위

**포함** (모두 `apps/admin/` 아래)

- 메뉴: `src/lib/nav.ts`, `src/lib/nav.test.ts`, `src/components/layout/sidebar.tsx`
- CSP: `src/lib/csp.ts`, `src/lib/csp.test.ts` (`next.config.ts`는 바꾸지 않는다 — `buildContentSecurityPolicy`가 오리진을 넣으므로)
- API: `src/lib/api/concert-content.ts`·`concert-content.test.ts`에 공연장 함수 3개, `src/lib/api/types.ts`에 `Venue`·`GeocodeResult`, `src/lib/query-keys.ts`에 `venue`
- 규칙·변환: 신규 `src/lib/concert-content/venue-schema.ts`·`venue-schema.test.ts`, `src/lib/concert-content/public-page-url.ts`(`PUBLIC_PAGE_PATHS.venue`)·`public-page-url.test.ts`
- 지도 스크립트 로더: 신규 `src/lib/concert-content/naver-map-script.ts`·`naver-map-script.test.ts`
- 컴포넌트·페이지: 신규 `src/components/concert-content/venue-map-picker.tsx`, `src/components/concert-content/venue-page-client.tsx`, `src/app/(admin)/venue/page.tsx`
- 환경변수 문서: `.env.example`에 `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` 섹션

**제외**

- `apps/api/` (API 변경 없음), 공개 사이트 `src/` (T5 — 공개 사이트 지도의 좌표·말풍선 교체는 T5 D10)
- `package.json`·`package-lock.json` (지도 SDK npm 패키지·타입 패키지를 추가하지 않는다. 필요한 타입은 이 앱 안에 최소한으로 선언한다)
- T4A 페이지 4개(`concert`·`performance-days`·`ticket`·`notice`)와 공용 컴포넌트(`save-result-notice.tsx`, `concert-image-field.tsx`, `info-sections-editor.tsx`) 변경
- 지도 말풍선(InfoWindow)·장소 검색·로드뷰 — 관리자 화면에서는 마커만 쓴다
- 경로별 CSP, nonce 방식 CSP (위 "확인한 사실" — 클라이언트 측 이동 때문에 효과가 없다)
- 네이버 지도 장소 링크(`naverMapUrl`)를 주소에서 자동으로 만드는 기능 (PRD 확정 #2 — 직접 붙여넣기)
- 문서(`CLAUDE.md`, `work05-implementation.md`) 갱신 — 필요하면 머지 후 일반 브랜치 PR로 처리

## 설계 결정

### 1. 메뉴

- `NAV_ITEMS`에서 `/concert` **바로 뒤**에 `{ href: "/venue", label: "공연장 정보", group: "공연 콘텐츠" }`를 넣는다. 결과 순서: 팀 관리, 곡 관리, 유튜브 연결 관리, 공연 기본 정보, **공연장 정보**, 일차별 공연, 티켓 안내, 관람 유의사항
- `sidebar.tsx`의 `NAV_ICONS`에 `"/venue": MapPin`(lucide-react)을 추가한다. 그룹 제목 로직은 바꾸지 않는다
- `nav.ts` 첫 줄 주석의 메뉴 설명에 공연장 정보를 넣는다

### 2. CSP 예외 (`src/lib/csp.ts`)

- 고정 오리진 상수를 추가한다. 환경변수로 빼지 않는다 (`ALBUM_COVER_IMAGE_ORIGIN`과 같은 이유 — 배포 환경마다 달라질 값이 아니고, 잘못 넣으면 CSP가 넓어진다)

```ts
export const NAVER_MAP_ORIGINS = {
  script: ["https://oapi.map.naver.com", "https://nrbe.pstatic.net"],
  img: ["https://nrbe.pstatic.net", "https://ssl.pstatic.net"],
  connect: ["https://kr-col-ext.nelo.navercorp.com"],
} as const;
```

- `buildContentSecurityPolicy`는 설정값과 관계없이 항상 `script-src`에 `NAVER_MAP_ORIGINS.script`, `img-src`에 `.img`, `connect-src`에 `.connect`를 추가한다. 다른 지시어(`default-src`, `style-src`, `font-src`, `frame-ancestors` 등)는 바꾸지 않는다. 와일드카드(`*.pstatic.net`, `*.naver.com`, `*.navercorp.com`)를 쓰지 않는다
- 상수 위 주석에 다음을 적는다
  - 실측 근거: 2026-10-25 공개 사이트 `/location`에서 `performance.getEntriesByType("resource")`로 확인한 오리진·요청 종류 (위 표 요약)
  - 다시 확인하는 방법: 관리자 `/venue`를 열고 지도를 이동·확대한 뒤 브라우저 콘솔의 `Content-Security-Policy` 위반 메시지를 확인한다. 위반이 보이면 **그 오리진만** 추가하고 근거를 이 주석에 남긴다
  - 전역에 넣는 이유: 클라이언트 측 이동 때문에 경로별 CSP가 효과가 없다. 그래서 "외부 스크립트 0" 원칙의 첫 예외이고, 스크립트를 로드하는 곳은 `/venue` 페이지뿐이다
  - `connect-src`의 nelo 오리진은 네이버 지도 SDK의 로그 수집 주소다. 응답을 공격자가 읽을 수 없는 네이버 수집 서버라 유출 통로로서의 위험이 낮다. 막으면 매번 콘솔에 위반이 남아 실제 문제를 가린다
- 파일 맨 위 설명 주석의 "서드파티 스크립트 0" 문장을 "서드파티 스크립트는 네이버 지도(공연장 정보 페이지)만"으로 고친다

### 3. API (`src/lib/api/concert-content.ts`)

| 함수 | 호출 |
| --- | --- |
| `getVenue()` | `GET /venue` → `Venue` |
| `updateVenue(input)` | `PUT /venue`, 본문 `{ name, address, addressDetail, latitude, longitude, naverMapUrl, websiteUrl }` → `SaveResult<Venue>` |
| `geocodeAddress(address)` | `POST /venue/geocode`, 본문 `{ address }` → `GeocodeResult` |

- 기존 함수와 같이 마지막 인자로 `options: Pick<ApiRequestOptions, "signal"> = {}`를 받는다. `UpdateVenueInput`은 `Pick<Venue, ...>`로 둔다
- `types.ts`에 `Venue`(서버 `VenueResponse`와 같은 필드·nullable)와 `GeocodeResult = { latitude: number; longitude: number; roadAddress: string }`를 추가하고 미러링 주석을 단다
- `query-keys.ts`에 `venue: ["venue"]`를 추가한다

### 4. 폼 규칙 (`src/lib/concert-content/venue-schema.ts`)

서버 `UpdateVenueDto`와 같은 규칙·문구로 쓴다. 첫 주석에 서버 파일을 적는다.

| 필드 | 규칙 | 문구 |
| --- | --- | --- |
| `name` | trim 후 1~100자 | 공연장 이름은 1~100자로 입력해 주세요. |
| `address` | trim 후 1~200자 | 주소는 1~200자로 입력해 주세요. |
| `addressDetail` | trim 후 0~200자 | 상세 주소는 200자 이내로 입력해 주세요. |
| `latitude` | 유한한 number, -90 이상 90 이하 | 숫자가 아니면 "위도를 숫자로 입력해 주세요.", 범위 밖이면 "위도는 -90 이상이어야 합니다." / "위도는 90 이하여야 합니다." |
| `longitude` | 유한한 number, -180 이상 180 이하 | "경도를 숫자로 입력해 주세요." / "경도는 -180 이상이어야 합니다." / "경도는 180 이하여야 합니다." |
| `naverMapUrl`·`websiteUrl` | `optionalHttpsUrl` 재사용 | https로 시작하는 올바른 주소를 입력해 주세요. |

- 좌표 입력은 `<input type="number" step="0.000001">` + RHF `valueAsNumber`다. 빈 입력은 `NaN`이 되므로 "숫자로 입력" 문구로 거부한다
- `roundCoordinate(value)`: 소수점 6자리로 반올림한 number를 돌려준다 (DB `numeric(9,6)`과 같은 정밀도 — 화면에 보이는 값과 저장되는 값을 맞춘다). 지도·주소 검색에서 받은 좌표는 이 함수를 거쳐 폼에 넣는다
- `toVenueFormValues(venue)`: 선택 문자열의 `null`을 `""`로 바꾼다. `toVenuePayload(values)`: 문자열을 trim하고 좌표를 `roundCoordinate`로 보낸다. 빈 선택 문자열은 `""` 그대로 보낸다 (서버가 NULL로 저장)

### 5. 지도 스크립트 로더 (`src/lib/concert-content/naver-map-script.ts`)

- `buildNaverMapScriptUrl(clientId)`: trim한 값이 비면 `null`이다. 아니면 `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=<encodeURIComponent(clientId)>`를 돌려준다. 주소는 상수 `NAVER_MAP_SCRIPT_BASE_URL`로 두고, 오리진이 `NAVER_MAP_ORIGINS.script[0]`과 같다는 것을 주석과 테스트로 묶는다
- `loadNaverMapScript(clientId): Promise<NaverMapsNamespace>` (브라우저 전용)
  - 이미 `window.naver?.maps`가 있으면 즉시 resolve한다
  - 같은 `id`(`"naver-map-script"`)의 스크립트가 있으면 새로 붙이지 않고, 진행 중인 하나의 Promise를 공유한다 (모듈 변수에 보관). 실패하면 보관한 Promise를 비워 다시 시도할 수 있게 한다
  - URL이 `null`이면 `NaverMapConfigError`로 reject한다 (메시지에 값을 넣지 않는다)
  - `script.onerror`이면 reject한다
  - 인증 실패는 네이버 지도 v3의 전역 콜백 `window.navermap_authFailure`로 알려진다. 로더가 이 콜백을 등록하고, 호출되면 reject한다. 정확한 이름·동작은 구현 시 공식 문서(`https://navermaps.github.io/maps.js.ncp/docs/`)로 확인한다
- 지도 SDK 타입은 이 파일에 **쓰는 것만** 최소 인터페이스로 선언한다(`LatLng`, `Map`, `Marker`, `Event.addListener`, 좌표의 `lat()`·`lng()`). `any`를 쓰지 않는다. `declare global`로 `Window`에 `naver?`·`navermap_authFailure?`를 추가한다
- `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID`는 호출부(`venue-map-picker.tsx`)에서 **문자 그대로의 표현**으로 읽어 넘긴다 (`lib/teams/card-image.ts`와 같은 이유)

### 6. 지도 위치 보정 컴포넌트 (`src/components/concert-content/venue-map-picker.tsx`)

- `VenueMapPicker({ latitude, longitude, onChange })`, `"use client"`. 지도 높이는 고정(예: `h-80`)이다
- 마운트하면 `loadNaverMapScript`로 지도를 만든다: 중심 `(latitude, longitude)`, 확대 16, `draggable: true` 마커 하나. 지도 옵션은 공개 사이트처럼 지도 유형·축척·데이터 컨트롤을 끈다
- 사용자가 **지도를 클릭**하면 마커를 그 위치로 옮기고, **마커를 끌어 놓으면**(`dragend`) 그 위치로 정한다. 두 경우 모두 `onChange(roundCoordinate(lat), roundCoordinate(lng))`를 부른다. 이벤트 이름과 좌표 값의 모양은 구현 시 공식 문서로 확인한다
- props의 좌표가 바뀌면(주소 검색 결과나 숫자 직접 입력) 마커 위치와 지도 중심을 옮긴다. 좌표가 유한하지 않으면(입력 중 빈 값) 옮기지 않는다
- 언마운트하면 등록한 이벤트 리스너를 해제하고 지도를 정리한다(`destroy`가 있으면 호출). 스크립트 태그는 남겨 둔다(다음 방문 때 재사용)
- 상태 표시
  - 로딩 중: "지도를 불러오는 중입니다…"
  - Client ID가 없을 때: "지도 키(NEXT_PUBLIC_NAVER_MAP_CLIENT_ID)가 설정되지 않아 지도를 표시할 수 없습니다. 위도·경도를 직접 입력하거나 '위치 찾기'를 사용해 주세요."
  - 로드·인증 실패: "지도를 불러오지 못했습니다. 네이버 클라우드 콘솔에 이 사이트 주소가 등록됐는지 확인해 주세요. 위도·경도는 직접 입력할 수 있습니다." + "다시 시도" 버튼
  - 지도가 없어도 폼(좌표 숫자 입력 포함)은 그대로 쓸 수 있어야 한다
- **InfoWindow나 HTML 문자열 content를 쓰지 않는다.** 서버 문자열(장소명·주소)을 지도에 넘기지 않으므로 HTML 주입 경로가 없다
- 지도 사용 안내 문구: "지도를 클릭하거나 마커를 끌어 위치를 보정할 수 있습니다."

### 7. 공연장 정보 페이지 (`/venue`)

- `src/app/(admin)/venue/page.tsx`: 다른 페이지와 같이 `metadata.title = "공연장 정보 · SUMMIT 관리자"`만 정의하고 `VenuePageClient`를 렌더링한다 (`"use client"` 없음)
- `venue-page-client.tsx`: `PageHeader`(제목 "공연장 정보", 설명 "공연장 이름·주소와 지도 위치, 외부 링크를 관리합니다.") → `useQuery(queryKeys.venue, getVenue)` → `LoadingState`/`ErrorState`/폼. 구조는 `concert-page-client.tsx`를 따른다
- 폼 하나와 저장 버튼 하나다. 카드 구성:
  1. **기본 정보**: 공연장 이름, 주소 + "위치 찾기" 버튼, 상세 주소(placeholder "예: 지하 1층")
  2. **지도 위치**: `VenueMapPicker`, 그 아래 위도·경도 숫자 입력. 지도의 `onChange`는 `setValue("latitude"|"longitude", v, { shouldDirty: true, shouldValidate: true })`로 폼에 반영한다. 지도는 `watch`한 좌표를 받는다
  3. **외부 링크**: 공연장 홈페이지(`websiteUrl`, 안내 "Stage Info 카드가 연결하는 주소"), 네이버 지도 장소 링크(`naverMapUrl`, 안내 "네이버 지도에서 장소를 검색해 '공유' 링크를 붙여넣어 주세요. 주소에서 자동으로 만들지 않습니다.")
- **"위치 찾기"** (`useMutation`, `geocodeAddress`)
  - 현재 주소 입력값을 trim한다. 비었거나 200자를 넘으면 요청하지 않고 `address` 필드에 폼 오류를 띄운다 (`trigger("address")`)
  - 성공하면 좌표를 `roundCoordinate`해서 폼에 넣고(위와 같은 `setValue` 옵션) 지도가 그 위치로 이동한다. 결과 안내 "검색된 위치: {roadAddress} — 지도에서 위치를 확인한 뒤 저장해 주세요."를 보여 준다
  - `roadAddress`가 현재 주소 입력값과 다르면 "검색된 도로명 주소로 바꾸기" 버튼을 함께 보여 준다. 누르면 `address`에 `roadAddress`를 넣는다 (자동으로 바꾸지 않는다)
  - 실패하면 `ApiError.messages`를 Alert로 보여 준다 (404면 서버 문구 "주소를 다시 확인하거나 지도에서 직접 위치를 지정해 주세요."가 그대로 나온다). 좌표는 바꾸지 않는다
  - 버튼 옆 안내: "위치 찾기는 저장하지 않습니다."
- **저장**: `updateVenue(toVenuePayload(values))` → 성공하면 `form.reset(toVenueFormValues(data))`, `queryKeys.venue`와 `queryKeys.concert`를 invalidate(공연 기본 정보 응답에 공연장 요약이 들어 있으므로)하고 `SaveResultNotice`(`publicPath = PUBLIC_PAGE_PATHS.venue`)를 보여 준다. 오류는 `ErrorState`를 쓴다 (T4A 페이지와 같다). 낙관적 업데이트는 하지 않는다
- `PUBLIC_PAGE_PATHS`에 `venue: "/location"`을 추가한다 (공개 사이트 "오시는 길" 페이지)
- 서버 문자열은 텍스트로만 렌더링한다. `dangerouslySetInnerHTML`을 쓰지 않는다

### 8. 환경변수 (`apps/admin/.env.example`)

기존 주석 스타일로 맨 끝에 섹션을 추가한다:

- `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=` — 네이버 클라우드 Maps Application의 Client ID(공개 사이트 지도와 같은 값). 공연장 정보 페이지 지도에 쓴다. 공개 값이라 번들에 들어가도 되지만, **Client Secret은 절대 넣지 않는다**(Geocoding은 API 서버가 Secret으로 호출한다). NCP 콘솔의 Web 서비스 URL에 관리자 오리진(로컬 `http://localhost:3010`, 배포 도메인)이 등록돼 있어야 지도가 뜬다. 비어 있으면 지도 없이 좌표 직접 입력만 가능하다. 값이 바뀌면 다시 빌드해야 한다

## 수용 기준

- AC-01 `NAV_ITEMS`의 라벨 순서가 `팀 관리, 곡 관리, 유튜브 연결 관리, 공연 기본 정보, 공연장 정보, 일차별 공연, 티켓 안내, 관람 유의사항`이고, `/venue` 항목의 `group`이 `"공연 콘텐츠"`다. `findNavItem("/venue")`가 "공연장 정보"를 돌려준다 (`src/lib/nav.test.ts`). `sidebar.tsx`의 `NAV_ICONS`에 `"/venue": MapPin`이 있다
- AC-02 `csp.ts`에 설계 결정 2의 `NAVER_MAP_ORIGINS`가 그 값 그대로 있다. `buildContentSecurityPolicy` 결과에서 script 오리진 2개는 `script-src`에만, img 오리진 2개는 `img-src`에, nelo 오리진은 `connect-src`에만 들어 있다. 설정값이 비거나 잘못돼도(`apiBaseUrl: "garbage"`) 들어 있고, `oapi.map.naver.com`·`ssl.pstatic.net`이 `connect-src`에 없다 (`src/lib/csp.test.ts`)
- AC-03 CSP 문자열에 `*.pstatic.net`·`*.naver.com`·`*.navercorp.com` 같은 와일드카드가 없다. `style-src`·`font-src`·`default-src`·`frame-ancestors`·`object-src` 값이 변경 전과 같다. 기존 `csp.test.ts` 테스트의 단언은 지우거나 약하게 바꾸지 않는다 (네이버 오리진 추가로 기대 배열을 늘리는 수정만 허용) (`src/lib/csp.test.ts`)
- AC-04 `getVenue`·`updateVenue`·`geocodeAddress`가 설계 결정 3의 메서드·경로·본문으로 `apiRequest`를 호출한다 (`src/lib/api/concert-content.test.ts`, `vi.mock("./client")`). `types.ts`의 `Venue`가 서버 `VenueResponse`와 필드 이름·nullable이 같다
- AC-05 `venueSchema`가 설계 결정 4의 표대로 통과·거부하고 문구가 같다. 특히 위도 `90.000001`·`-90.1`·`NaN`, 경도 `180.5`를 거부하고 위도 `37.552555`·경도 `126.91899`·경계값 `90`·`-180`을 통과시키며, `http://` 링크를 거부하고 빈 링크를 통과시킨다 (`src/lib/concert-content/venue-schema.test.ts`)
- AC-06 `roundCoordinate(37.5525554)`가 `37.552555`, `roundCoordinate(126.9189999)`가 `126.919`다. `toVenueFormValues`는 `null` 선택 값을 `""`로 바꾸고, `toVenuePayload`는 문자열을 trim하고 좌표를 6자리로 반올림한다 (`venue-schema.test.ts`)
- AC-07 `buildNaverMapScriptUrl`이 `"abc 1"` → `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=abc%201`을, `""`·`"  "`·`undefined` → `null`을 돌려주고, 결과 URL의 오리진이 `NAVER_MAP_ORIGINS.script`에 들어 있다 (`src/lib/concert-content/naver-map-script.test.ts`)
- AC-08 `buildPublicPageUrl(PUBLIC_PAGE_PATHS.venue, "https://summit-concert.live")`가 `https://summit-concert.live/location`이다 (`public-page-url.test.ts`)
- AC-09 `src/app/(admin)/venue/page.tsx`가 있고, `metadata.title`만 정의하고 `VenuePageClient`를 렌더링하며 `"use client"`가 없다. 네이버 지도 스크립트 주소(`oapi.map.naver.com`)를 쓰는 곳이 `naver-map-script.ts`와 `csp.ts`뿐이고, `loadNaverMapScript`를 부르는 곳은 `venue-map-picker.tsx`뿐이다
- AC-10 `apps/admin/src`에 `dangerouslySetInnerHTML` 속성 사용(`dangerouslySetInnerHTML=`)이 없다. `venue-map-picker.tsx`에 `InfoWindow`가 없다. 새 파일에 `any` 타입·`eslint-disable`이 없다
- AC-11 `.env.example`에 설계 결정 8의 `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=` 섹션이 값 없이 추가되어 있다
- AC-12 `apps/admin`에서 `npm run lint`·`npm run build`·`npm run typecheck`·`npm test`가 통과한다
- AC-13 `origin/develop` 대비 변경 파일이 모두 `apps/admin/` 아래이고 `package.json`·`package-lock.json`·`next.config.ts`·T4A 페이지 클라이언트 4개(`concert-page-client.tsx`, `performance-days-page-client.tsx`, `ticket-page-client.tsx`, `notice-page-client.tsx`)·`save-result-notice.tsx`·`concert-image-field.tsx`·`info-sections-editor.tsx`는 바뀌지 않았다
- AC-14 [manual] 로컬 API + 관리자 앱에서 `/venue`의 지도가 저장된 좌표에 마커와 함께 뜬다. 지도를 이동·확대하고 마커를 끌어 놓아도 브라우저 콘솔에 `Content-Security-Policy` 위반 메시지가 없다. `/teams`에서 사이드바로 `/venue`로 이동한 경우에도 지도가 뜬다 (클라이언트 측 이동)
- AC-15 [manual] 주소 `서울특별시 마포구 양화로 100-10`으로 "위치 찾기"를 누르면 좌표 입력값과 지도 마커가 그 위치로 바뀌고 검색된 도로명 주소가 안내된다. `없는주소테스트12345`는 서버 문구로 실패를 알리고 좌표는 그대로다. 지도 클릭·마커 끌기로 좌표가 바뀐 뒤 저장하면 "사이트 반영이 지연될 수 있습니다" 경고(로컬은 `revalidated: false`)가 뜨고, 새로고침해도 같은 좌표와 같은 마커 위치가 보인다
- AC-16 [manual] `apps/admin/.env.local`의 `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID`를 잠시 비우고 개발 서버를 다시 띄우면, 지도 자리에 설계 결정 6의 키 미설정 안내가 보이고 위도·경도를 직접 입력해 저장할 수 있다 (확인 후 값을 되돌린다)

## 테스트 계획

**커밋하기 전에** 실행하고 명령과 결과를 PR 본문에 남긴다. 새 파일은 `git add`로 스테이지한 뒤 실행한다.

```bash
# 저장소 루트
git diff --cached --name-only origin/develop -- . ':!apps/admin'      # 출력 없음 (AC-13)
git diff --cached --name-only origin/develop -- apps/admin/package.json apps/admin/package-lock.json apps/admin/next.config.ts apps/admin/src/components/concert-content/concert-page-client.tsx apps/admin/src/components/concert-content/performance-days-page-client.tsx apps/admin/src/components/concert-content/ticket-page-client.tsx apps/admin/src/components/concert-content/notice-page-client.tsx apps/admin/src/components/concert-content/save-result-notice.tsx apps/admin/src/components/concert-content/concert-image-field.tsx apps/admin/src/components/concert-content/info-sections-editor.tsx   # 출력 없음 (AC-13)
git grep -nE --cached "dangerouslySetInnerHTML\s*=" -- apps/admin/src          # 출력 없음 (AC-10)
git grep -n --cached "InfoWindow" -- apps/admin/src                             # 출력 없음 (AC-10)
git grep -n --cached "oapi.map.naver.com" -- apps/admin/src                     # csp.ts, csp.test.ts, naver-map-script.ts, naver-map-script.test.ts만 (AC-09)
git grep -n --cached "loadNaverMapScript(" -- apps/admin/src                    # naver-map-script.ts(정의·테스트)와 venue-map-picker.tsx만 (AC-09)
git status --short                                                    # 스테이지되지 않은 변경 없음

# apps/admin 폴더
npm run lint        # 통과 (AC-12)
npm run typecheck   # 통과 (AC-12)
npm test            # 통과 (AC-12)
npm run build       # 통과 (AC-12)
```

- 테스트는 실제 네트워크·지도 SDK에 접속하지 않는다. `loadNaverMapScript`의 DOM 동작은 node 환경에서 테스트하지 않고(AC-14~16으로 확인), 순수 함수 `buildNaverMapScriptUrl`만 테스트한다
- `next dev`가 `apps/admin/AGENTS.md`를 다시 쓰면 그 변경은 커밋하지 않는다
- 사용자 확인(AC-14) 중 **새 네이버 오리진의 CSP 위반이 보이면** Codex는 임의로 오리진을 추가하지 않는다. 위반 메시지(지시어·차단된 URL의 오리진)를 받아 설계 결정 2의 근거 주석과 함께 추가하는 수정을 사용자에게 제안하고, 사용자가 승인하면 같은 브랜치에 추가 커밋한다. 와일드카드가 필요해 보이면 멈추고 보고한다

### 사용자 확인 절차 (AC-14~AC-16) — PR 생성 후 사용자에게 요청할 내용

Codex는 PR을 만든 뒤 아래 절차를 사용자에게 그대로 안내하고 끝낸다 (실행하지 않는다). 로컬 `apps/api/.env`는 프로덕션 DB를 가리킨다. 그래서 저장하면 `Venue` 행이 실제로 바뀐다. **실제 공연장 정보를 넣어도 된다** — 주소 불일치("마포구 양화로 100-10" vs "관악구 남부순환로 1937")의 정답을 이때 정해 입력한다(T6). 공개 사이트는 T5 머지 전까지 이 값을 읽지 않는다.

1. 공유 폴더에서 PR 브랜치를 체크아웃하고, `apps/api`에서 `npm run start:dev`, `apps/admin`에서 `npm run dev`를 실행한다 (admin `.env.local`에 `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID`가 있어야 한다)
2. `http://localhost:3010` 로그인 → `/teams`를 연 뒤 사이드바의 "공연장 정보"로 이동한다 → 지도와 마커가 보이는지 확인한다. 개발자 도구 콘솔을 열어 둔다
3. (AC-14) 지도를 끌어 이동하고 확대·축소하고, 마커를 끌어 놓는다 → 콘솔에 `Content-Security-Policy` 위반이 없는지 확인한다. 위반이 있으면 메시지 전체를 복사해 Codex에 전달한다
4. (AC-15) 주소에 `서울특별시 마포구 양화로 100-10` → "위치 찾기" → 좌표와 마커 이동, 도로명 안내를 확인한다. `없는주소테스트12345` → 오류 문구가 뜨고 좌표가 그대로인지 확인한다. 실제 공연장 주소로 위치를 찾고 지도로 보정한 뒤 저장 → 지연 경고를 확인한다 → 새로고침 후 좌표·마커가 같은지 확인한다
5. (AC-16) `apps/admin/.env.local`의 `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` 줄을 주석 처리하고 `npm run dev`를 다시 시작한다 → 키 미설정 안내가 보이고 좌표 직접 입력·저장이 되는지 확인한다 → 값을 되돌리고 다시 시작한다
6. 확인이 끝나면 PR 본문의 AC-14~AC-16을 체크하고 머지한다. 머지 후 **U4-Vercel**: 관리자 Vercel 프로젝트 → Settings → Environment Variables에 `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID`(Client ID만, Secret 금지)를 넣고 재배포한다 (빌드 시점에 번들에 들어간다). 배포 도메인에서 `/venue` 지도가 뜨는지, 콘솔에 CSP 위반이 없는지 한 번 더 확인한다
