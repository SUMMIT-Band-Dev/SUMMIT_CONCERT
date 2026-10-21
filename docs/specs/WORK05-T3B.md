---
spec_id: WORK05-T3B
revision: 0
---

# WORK05-T3B — 공연 콘텐츠 이미지 업로드 + 주소 좌표 검색 API

## 배경

- work05는 공개 사이트에 하드코딩된 공연 정보를 DB 한 곳에서 관리하도록 옮기는 작업이다 (`docs/specs/prd-construction.md`, `.claude/rules/work-05-construction.md`). T2(#73)에서 테이블을, WORK05-T3A(#77)에서 재검증 모듈과 텍스트·링크 저장 API를 만들었다
- 이 명세는 `docs/specs/work05-implementation.md` **T3의 뒷부분**이다. D6의 이미지 업로드 라우트 3개와 `POST /venue/geocode`, D7(Geocoding)을 다룬다. 두 문서가 다르면 **이 명세가 우선**한다
- 재사용할 기존 코드 (`apps/api/src/` 기준)
  - 업로드 흐름: `teams/team-card-image.service.ts` — 검증 → 대상 존재 확인 → 새 경로 업로드 → DB 반영 → 실패 시 보상 삭제(`compensate`·`safeRemove`). 업로드 타임아웃은 504, 그 밖의 저장소 실패는 502
  - multipart 파서: `teams/card-image-upload.interceptor.ts`(`toUploadException`, multer 직접 감싸기). 상한이 `CARD_IMAGE_MAX_BYTES`(1MB)로 고정돼 있어 그대로 쓸 수 없다 → 설계 결정 2
  - 저장소: `storage/storage.client.ts`(`STORAGE_CLIENT`, `StorageTimeoutError`), `storage/image-type.ts`(`detectImageFormat`, JPEG·PNG·WebP만), `storage/storage.constants.ts`(메시지·`CARD_IMAGE_CACHE_CONTROL_SECONDS`), `StorageModule`
  - T3A 코드: `concert-content/concert-content.service.ts`(`readConcert`·`autoLineup` 규칙), `concert-content/dto/content-response.ts`(응답 매퍼), `concert-content/concert-content.constants.ts`(404 문구), `revalidation/revalidation.service.ts`(외부 fetch + `AbortSignal.timeout` + `isTimeoutError`, 생성자 환경변수 검사)
- 확인한 사실
  - 버킷 `team-cards`의 실제 설정(2026-10-21 Supabase 조회): public, `file_size_limit` 2097152(2MB), `allowed_mime_types` = `image/jpeg`·`image/png`·`image/webp`
  - NCP Maps Geocoding 공식 문서(`https://api.ncloud-docs.com/docs/ko/application-maps-geocoding`, 2026-10-21 확인): `GET https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=<주소>`, 헤더 `x-ncp-apigw-api-key-id`(Client ID)·`x-ncp-apigw-api-key`(Client Secret)·`Accept: application/json`. 응답 `{ status, meta: { totalCount, page, count }, addresses: [{ roadAddress, jibunAddress, x, y, ... }], errorMessage }` — `x`(경도)·`y`(위도)는 **문자열**. 선택 파라미터 `count`(1~100)
  - 로컬 `apps/api/.env`에 `NAVER_MAP_CLIENT_ID`·`NAVER_MAP_CLIENT_SECRET`이 채워져 있다 (U2·U3-로컬 완료)
  - CORS: 새 라우트는 `PUT`(multipart)·`POST`(JSON)와 `Authorization`·`Content-Type` 헤더만 써서 현재 허용 목록으로 충분하다

## 범위

**포함** (모두 `apps/api/` 아래)

- `src/concert-content/` — 이미지 교체 서비스(`concert-image.service.ts`), 공연 이미지용 multipart 인터셉터(`concert-image-upload.interceptor.ts`), 상수 추가, 기존 컨트롤러 4개(`concert`·`venue`·`performance-days`·`ticket`)에 라우트 추가, 모듈 등록
- 신규 `src/geocoding/` — `GeocodingService`, 상수, `GeocodingModule`
- `src/teams/card-image-upload.interceptor.ts` — `toUploadException`에 선택 인자 하나 추가 (설계 결정 2). 팀 업로드 동작은 바꾸지 않는다
- `src/youtube/youtube.module.spec.ts` — 설정 대역에 새 필수 키 추가 + 새 라우트 미인증 확인 (설계 결정 4)
- `.env.example` — `NAVER_MAP_CLIENT_ID`·`NAVER_MAP_CLIENT_SECRET` 섹션 추가
- 위 모든 새 코드의 단위 테스트(`*.spec.ts`)

**제외**

- 관리자 프론트(`apps/admin/`)·공개 사이트(`src/`) → T4·T5
- `apps/api/prisma/` (스키마·마이그레이션 변경 없음). **DB에 접속하는 Prisma 명령은 실행하지 않는다** (`migrate *`, `db *`). `npx prisma generate`는 허용
- `src/common/cors.ts`, `src/auth/public-routes.spec.ts` — 새 컨트롤러를 만들지 않고 기존 컨트롤러에 라우트를 추가하므로 바꾸지 않는다
- `src/teams/team-card-image.service.ts`·`team-card-image.controller.ts` — 팀 업로드 흐름은 리팩터링하지 않는다 (공통 함수로 뽑지 않고 공연 이미지 서비스에 같은 흐름을 따로 둔다. 대상이 표 6개라 분기가 다르다)
- 이미지 삭제 API, 옛 객체 삭제 (기존 정책: 교체로만 대응, 옛 객체는 지우지 않는다)
- Geocoding 결과의 DB 저장 (좌표는 관리자가 확인 후 `PUT /venue`로 저장한다)
- 문서(`CLAUDE.md`, `work05-implementation.md`) 갱신 — 필요하면 머지 후 일반 브랜치 PR로 처리

## 설계 결정

### 1. 이미지 교체 라우트와 대상

모든 라우트는 인증 필요(전역 Guard, `@Public()` 금지). 파일 필드명은 팀 업로드와 같은 `file`, 다른 필드 금지.

| 메서드·경로 | 컨트롤러 | 경로 인자 | 대상 행 | 컬럼 | 객체 경로 | 재검증 태그 | 응답 `data` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `PUT /concert/images/:slot` | `ConcertController` | `slot` = `poster` | `Concert` id=1 | `posterImageUrl` | `concert/poster/<uuid>.<ext>` | `concert` | `ConcertResponse` |
| | | `slot` = `title` | 〃 | `titleImageUrl` | `concert/title/<uuid>.<ext>` | 〃 | 〃 |
| | | `slot` = `subtitle` | 〃 | `subtitleImageUrl` | `concert/subtitle/<uuid>.<ext>` | 〃 | 〃 |
| `PUT /performance-days/:dayKey/timetable-image` | `PerformanceDaysController` | `dayKey` | `PerformanceDay` where `dayKey` | `timetableImageUrl` | `concert/timetable/<dayKey>/<uuid>.<ext>` | `performance-days` | `PerformanceDayResponse` |
| `PUT /ticket/images/:side` | `TicketController` | `side` = `front` | `Ticket` id=1 | `frontImageUrl` | `concert/ticket/front/<uuid>.<ext>` | `ticket` | `TicketResponse` |
| | | `side` = `back` | 〃 | `backImageUrl` | `concert/ticket/back/<uuid>.<ext>` | 〃 | 〃 |

- `<uuid>`는 `randomUUID()`, `<ext>`는 `detectImageFormat` 결과(`jpg`·`png`·`webp`). 업로드 `contentType`도 판별 결과로만 정한다. 캐시 수명은 `CARD_IMAGE_CACHE_CONTROL_SECONDS`를 그대로 쓴다
- 응답은 T3A와 같은 `{ data, revalidated }`. `data`는 같은 리소스의 `GET`/`PUT` 응답 모양(T3A 매퍼 재사용). `ConcertResponse`는 공연장 요약을 포함하고, `PerformanceDayResponse`의 `autoLineup`은 T3A와 같은 정렬 규칙으로 채운다
- `slot`·`side`·`dayKey` 허용 값은 상수 배열로 둔다 (`CONCERT_IMAGE_SLOTS`, `TICKET_IMAGE_SIDES`). 컬럼·경로 매핑은 `switch` 대신 `Record` 객체로 둔다 (`.claude/rules/code-style.md`)

### 2. 처리 순서와 업로드 파서

**처리 순서** (팀 업로드와 같은 원칙, 외부 I/O 동안 DB 트랜잭션·잠금을 잡지 않는다)

1. 경로 인자 검사 — `slot`·`side`가 허용 값이 아니면 400 "지원하지 않는 이미지 위치입니다." `dayKey`가 `teams/teams.constants.ts`의 `DAY_PATTERN`에 맞지 않으면 404 `PERFORMANCE_DAY_NOT_FOUND` (경로에 들어가는 값이므로 형식부터 막는다)
2. 파일 검사 — 없거나 0바이트면 400 `CARD_IMAGE_REQUIRED_MESSAGE`, 형식 판별 실패면 400 `CARD_IMAGE_UNSUPPORTED_MESSAGE`
3. 대상 행 존재 확인 — 없으면 404 (`Concert`·`Ticket`은 `CONTENT_BASE_ROW_NOT_FOUND`, 일차는 `PERFORMANCE_DAY_NOT_FOUND`). **업로드 전에** 확인한다
4. 업로드 — 타임아웃이면 504 `STORAGE_TIMEOUT_MESSAGE`(보상 삭제 안 함, 경로만 `logger.error`), 그 밖의 실패는 502 `STORAGE_FAILED_MESSAGE`
5. DB 반영 — 해당 컬럼 하나만 `update`. 실패하면 `team-card-image.service.ts`의 `compensate` 규칙을 그대로 따른다: `P2025`면 객체 삭제 후 404, 그 밖의 오류는 해당 컬럼을 다시 읽어 방금 올린 URL이면 객체 유지, 다른 값·행 없음이면 삭제, 재조회 실패면 삭제하지 않음. 보상 삭제 실패는 로그만 남기고 원래 오류를 전파한다
6. DB 반영 성공 후 재검증 — 해당 태그로 `revalidate`를 1번 호출하고 `{ data, revalidated }`를 돌려준다. 1~5 중 하나라도 실패하면 재검증을 호출하지 않는다

**업로드 파서**

- `concert-content/concert-image-upload.interceptor.ts`에 `ConcertImageUploadInterceptor`를 만든다. `CardImageUploadInterceptor`와 같은 방식(multer 직접 감싸기, `memoryStorage`, `.single('file')`)이고 limits는 `fileSize: CONCERT_IMAGE_MAX_BYTES`, `files: 1`, `parts: 1`, `fields: 0`, `fieldSize: 1024`
- `CONCERT_IMAGE_MAX_BYTES = 2 * 1024 * 1024` (버킷 `file_size_limit`과 같음), 메시지 `CONCERT_IMAGE_TOO_LARGE_MESSAGE = '이미지 크기는 2MB를 넘을 수 없습니다.'` — `concert-content.constants.ts`에 둔다. 상수 주석에 "버킷 상한과 같다, 공개 사이트는 `next/image`로 최적화해 내려보낸다(T5)"를 적는다
- `toUploadException(error, tooLargeMessage = CARD_IMAGE_TOO_LARGE_MESSAGE)`로 선택 인자를 추가하고 `LIMIT_FILE_SIZE`일 때만 그 메시지를 쓴다. 공연 인터셉터는 `CONCERT_IMAGE_TOO_LARGE_MESSAGE`를 넘긴다. 팀 인터셉터 호출부와 기존 테스트는 바꾸지 않는다

### 3. 주소 → 좌표 (`POST /venue/geocode`)

**라우트** — `VenueController`에 `@Post('geocode')` + `@HttpCode(HttpStatus.OK)` (DB에 아무것도 만들지 않으므로 201이 아닌 200)

- 본문 DTO `GeocodeAddressDto { address }` — `TrimString` 후 필수, 1~`ADDRESS_MAX_LENGTH`(200)자. 선언되지 않은 필드는 전역 `ValidationPipe`가 400
- 응답 `{ latitude: number, longitude: number, roadAddress: string }` (재검증 없음, `{ data, revalidated }` 형태가 아님). **DB에 접근하지 않는다**

**`GeocodingService`** (`src/geocoding/`)

- 생성자에서 `ConfigService`로 `NAVER_MAP_CLIENT_ID`·`NAVER_MAP_CLIENT_SECRET`을 읽어 앞뒤 공백을 제거한다. 없거나 빈 값이면 `Error`를 던져 **서버가 기동하지 않는다**. 메시지에는 키 이름만 넣고 값은 넣지 않는다
- `geocode(address: string): Promise<{ latitude; longitude; roadAddress }>`
  - 요청: `GET https://maps.apigw.ntruss.com/map-geocode/v2/geocode` + 쿼리 `query=<address>`·`count=1` (`URL.searchParams`로 인코딩), 헤더 `x-ncp-apigw-api-key-id`·`x-ncp-apigw-api-key`·`accept: application/json`, `signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS)`(= 5000), `redirect: 'error'`. 엔드포인트는 상수 `NAVER_GEOCODE_ENDPOINT`로 두고 주석에 공식 문서 URL을 적는다. 재시도하지 않는다
  - 결과 해석: HTTP 2xx이고 본문 JSON의 `status === 'OK'`일 때만 성공 경로. `addresses`가 길이 0인 배열이면 404 `GEOCODE_NOT_FOUND_MESSAGE`(배열이 아니면 아래의 502) = "주소를 다시 확인하거나 지도에서 직접 위치를 지정해 주세요."
  - 첫 번째 결과의 `y`→`latitude`, `x`→`longitude`를 `Number()`로 바꾼다. 유한수가 아니거나 범위(위도 -90~90, 경도 -180~180)를 벗어나면 502. `roadAddress`가 빈 문자열이면 `jibunAddress`를 쓰고, 둘 다 비어 있으면 요청 `address`를 그대로 쓴다
  - 실패 매핑: 타임아웃 → 504 `GEOCODE_TIMEOUT_MESSAGE` = "주소 검색 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요." / 네트워크 오류·비 2xx(400·401·403·429·5xx 포함)·JSON 해석 실패·`status !== 'OK'`·좌표 이상 → 502 `GEOCODE_FAILED_MESSAGE` = "주소 검색 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요."
  - 실패 시 `Logger.warn` 한 줄에 실패 종류(HTTP 상태코드 또는 `timeout`·`network`·`invalid-response`)만 남긴다. Client ID·Secret·요청 헤더·응답 본문·입력 주소는 로그와 예외 메시지에 넣지 않는다
- `GeocodingModule`은 `GeocodingService`를 providers·exports에 둔다 (`@Global` 아님). `ConcertContentModule`이 import한다

**`.env.example`** — `── 공개 사이트 재검증 (work05) ──` 섹션 뒤에 `── 네이버 지도 Geocoding (work05) ──` 섹션을 기존 주석 스타일(⚠️ 실제 값은 .env에만)로 추가한다

- `NAVER_MAP_CLIENT_ID=` — NCP 콘솔 Maps Application의 Client ID, 공개 사이트 지도와 같은 Application(Geocoding API 체크 필요)
- `NAVER_MAP_CLIENT_SECRET=` — 같은 Application의 Client Secret, **서버 전용(브라우저·관리자 프론트에 넣지 않는다)**, 미설정 시 서버가 기동하지 않음

### 4. 기존 테스트의 설정 대역

- `youtube.module.spec.ts`의 설정 대역은 `get`·`getOrThrow` **두 메서드 모두** `NAVER_MAP_CLIENT_ID`·`NAVER_MAP_CLIENT_SECRET`에 테스트 전용 문자열을 돌려준다. 그 밖의 키는 지금처럼 `get`은 `undefined`, `getOrThrow`는 예외
- 이 테스트는 실제 네트워크에 접속하지 않는다. `fetch`를 `vi.fn()`으로 바꿔 두고(`vi.stubGlobal`, 테스트 뒤 복구) 아래 미인증 요청들이 **모두 401이고 fetch·Prisma 대역이 호출되지 않음**을 추가로 단언한다
  - `PUT /concert/images/poster` (작은 PNG 바이트를 `file` 필드로 첨부)
  - `POST /venue/geocode` 본문 `{"address":"서울특별시 마포구 양화로 100-10"}`
- 기존 단언(유튜브 `PUT`·`DELETE` 401, `PUT /ticket` 401, Prisma 미호출, 옛 경로 404)과 테스트 이름은 지우거나 약하게 바꾸지 않는다
- 다른 기존 스펙도 같은 이유로 기동이 실패하면 **설정 대역에 이 두 키를 추가하는 변경만** 허용한다. 고친 파일 목록을 PR 본문에 적는다

## 수용 기준

- AC-01 설계 결정 1의 라우트 3개가 해당 컨트롤러에 그 메서드·경로로 선언되어 있고 `ConcertImageUploadInterceptor`를 쓰며, `POST /venue/geocode`가 `VenueController`에 `HttpCode(200)`으로 선언되어 있다. 4개 핸들러와 해당 컨트롤러 클래스에 `@Public()`이 없다 (컨트롤러 스펙의 메타데이터 검사)
- AC-02 `ConcertImageUploadInterceptor`의 multer limits가 `fileSize` 2MB·`files` 1·`parts` 1·`fields` 0이고, 2MB를 넘는 파일은 413 + `CONCERT_IMAGE_TOO_LARGE_MESSAGE`, `file`이 아닌 필드명은 400으로 거부된다. `toUploadException`의 두 번째 인자를 생략하면 기존과 같이 `CARD_IMAGE_TOO_LARGE_MESSAGE`를 쓴다 (인터셉터 스펙)
- AC-03 이미지 서비스가 6개 대상(설계 결정 1의 표) 각각에 대해 표의 경로 접두사로 업로드하고 표의 컬럼만 갱신하며, 표의 태그로 재검증을 1번 호출하고 `{ data, revalidated }`를 돌려준다. 재검증이 `false`여도 저장 결과와 `revalidated: false`를 돌려준다 (서비스 스펙)
- AC-04 잘못된 `slot`·`side`는 400, 형식이 틀리거나 없는 `dayKey`는 404, 기본 행이 없으면 설계 결정 2의 문구로 404이고, 이 경우와 파일 누락·형식 불가(400) 모두 저장소 업로드와 재검증을 호출하지 않는다 (서비스 스펙)
- AC-05 업로드 타임아웃은 504이며 보상 삭제를 하지 않고, 그 밖의 업로드 실패는 502이며, 둘 다 DB 갱신·재검증을 호출하지 않는다 (서비스 스펙)
- AC-06 DB 반영 실패 시 보상 규칙이 설계 결정 2의 5단계를 따른다 — `P2025`는 객체 삭제 후 404, 불명확한 오류에서 재조회 값이 방금 올린 URL이면 객체 유지, 다른 값이면 삭제, 재조회 실패면 삭제하지 않음, 삭제 실패는 원래 오류를 전파. 어느 경우에도 재검증을 호출하지 않는다 (서비스 스펙)
- AC-07 `GeocodingService` 생성 시 두 키 중 하나라도 없거나 공백뿐이면 예외가 나고 메시지에 입력 값이 없다 (서비스 스펙)
- AC-08 `geocode()`가 설계 결정 3의 주소·쿼리(`query`, `count=1`)·헤더 3개·`redirect: 'error'`·5초 타임아웃으로 요청하고, 정상 응답의 첫 결과를 `latitude`(=`y`)·`longitude`(=`x`) number와 `roadAddress`(빈 값이면 `jibunAddress`)로 돌려준다 (fetch 대역 스펙)
- AC-09 `geocode()`가 결과 0건은 404 + `GEOCODE_NOT_FOUND_MESSAGE`, 타임아웃은 504, 네트워크 오류·비 2xx·JSON 해석 실패·`status !== 'OK'`·좌표가 숫자가 아니거나 범위 밖은 502로 매핑하고, 실패 로그와 예외 메시지에 Client ID·Secret·입력 주소가 없다 (fetch 대역 스펙)
- AC-10 `POST /venue/geocode`의 `address`가 없거나 trim 후 빈 값·200자 초과·선언되지 않은 필드가 있으면 400이다 (DTO 스펙)
- AC-11 `youtube.module.spec.ts`가 설계 결정 4대로 두 키를 대역에 추가하고, 기존 단언을 모두 유지하며, `PUT /concert/images/poster`·`POST /venue/geocode` 미인증 401과 fetch·Prisma 미호출 단언이 추가되어 있다
- AC-12 `.env.example`에 설계 결정 3의 `NAVER_MAP_CLIENT_ID`·`NAVER_MAP_CLIENT_SECRET` 섹션이 값 없이 추가되어 있다
- AC-13 `apps/api`에서 `npm run build`·`npm run typecheck`·`npm run lint`·`npm test`가 통과한다
- AC-14 `origin/develop` 대비 변경 파일이 모두 `apps/api/` 아래이고, `apps/api/prisma/`, `src/common/cors.ts`, `src/auth/public-routes.spec.ts`, `src/teams/team-card-image.service.ts`는 바뀌지 않았다
- AC-15 [manual] 사용자가 로컬에서 API를 띄워 로그인 토큰으로 `POST /venue/geocode`에 실제 주소를 보내 200과 그 주소의 좌표·도로명 주소를 받고, 존재하지 않는 주소(`"없는주소테스트12345"`)는 404와 설계 결정 3의 문구를 받는다
- AC-16 [manual] 사용자가 로컬에서 `PUT /ticket/images/front`에 2MB 이하 PNG를 올려 200, `data.frontImageUrl`에 `/concert/ticket/front/`가 포함되고 그 URL을 브라우저로 열면 이미지가 보이며, `revalidated`가 `false`(공개 사이트 재검증 엔드포인트가 아직 없음)인 것을 확인한다. 텍스트 파일(`.txt`)을 올리면 400이다. 확인 후 SQL로 값을 되돌린다

## 테스트 계획

**커밋하기 전에** 실행하고 명령과 결과를 PR 본문에 남긴다. 새 파일은 `git add`로 스테이지한 뒤 실행한다.

```bash
# 저장소 루트
git diff --cached --name-only origin/develop -- . ':!apps/api'          # 출력 없음 (AC-14)
git diff --cached --name-only origin/develop -- apps/api/prisma apps/api/src/common/cors.ts apps/api/src/auth/public-routes.spec.ts apps/api/src/teams/team-card-image.service.ts   # 출력 없음 (AC-14)
git status --short                                                      # 스테이지되지 않은 변경 없음

# apps/api 폴더 (DB에 접속하지 않는 명령만)
npx prisma generate     # 생성 클라이언트 갱신 (DB 접속 없음)
npm run build           # 통과 (AC-13)
npm run typecheck       # 통과 (AC-13)
npm run lint            # 통과 (AC-13)
npm test                # 통과 (AC-13)
```

- **`npm test` 타임아웃 예외**: Windows 로컬에서 전체 실행 시 앱을 띄우는 테스트(`src/common/cors.spec.ts`, `src/app.setup.spec.ts`, `src/youtube/youtube.module.spec.ts` 등)가 부하로 `Test timed out in 5000ms`만 내고 실패하는 경우가 있다. 실패 사유가 **타임아웃뿐**이면 실패한 파일만 `npx vitest run <파일>`로 다시 실행하고, 통과하면 두 출력을 함께 보고한다. 타임아웃이 아닌 실패는 그대로 실패로 보고한다
- 테스트는 실제 네트워크·DB·저장소에 접속하지 않는다. fetch는 `vi.stubGlobal`로, Prisma는 `teams.service.spec.ts`처럼, 저장소는 `STORAGE_CLIENT` 대역(`team-card-image.service.spec.ts` 참고)으로 둔다

### 사용자 확인 절차 (AC-15·AC-16) — PR 생성 후 사용자에게 요청할 내용

Codex는 PR을 만든 뒤 아래 절차를 사용자에게 그대로 안내하고 끝낸다 (실행하지 않는다). `apps/api/.env`는 프로덕션 DB·Storage를 가리키므로 AC-16은 실제 `Ticket` 행과 버킷에 쓴다 — 마지막에 DB 값을 되돌린다 (현재 값은 `NULL`인 임시값 행이다). 올라간 객체는 기존 정책대로 지우지 않는다 (경로 `concert/ticket/front/` 아래, 용량만 차지).

1. 공유 폴더에서 PR 브랜치를 체크아웃하고 `cd apps/api` → `npm run start:dev`. 기동 로그에 오류가 없는지 확인 (`NAVER_MAP_*`가 없으면 여기서 실패한다)
2. `POST http://localhost:3001/auth/login`으로 토큰을 받는다 (또는 관리자 앱 로그인 후 Local Storage에서 확인)
3. `POST http://localhost:3001/venue/geocode` (헤더 `Authorization: Bearer <토큰>`, 본문 `{"address":"서울특별시 마포구 양화로 100-10"}`) → 200, `latitude`·`longitude`가 서울 범위(위도 37.x, 경도 126.x~127.x) 숫자, `roadAddress`가 도로명 주소
4. 같은 요청에 `{"address":"없는주소테스트12345"}` → 404, 메시지 "주소를 다시 확인하거나 지도에서 직접 위치를 지정해 주세요."
   - 3에서 502가 나오면 NCP Application에 Geocoding API가 체크됐는지(U2-3) 먼저 확인한다
5. `PUT http://localhost:3001/ticket/images/front` (multipart, 필드 `file`에 2MB 이하 PNG) → 200, `data.frontImageUrl`에 `/concert/ticket/front/` 포함, `revalidated: false`. 그 URL을 브라우저에서 열어 이미지 확인
6. 같은 라우트에 `.txt` 파일 → 400 "JPEG, PNG, WebP 이미지만 업로드할 수 있습니다."
7. Supabase SQL Editor에서 되돌리기: `update "Ticket" set "frontImageUrl" = null where id = 1;` → 1 row
8. 확인이 끝나면 PR 본문의 AC-15·AC-16을 체크하고 머지한다. 배포 전 서버 `/opt/summit-api/.env`에 `NAVER_MAP_CLIENT_ID`·`NAVER_MAP_CLIENT_SECRET`(그리고 T3A의 `PUBLIC_SITE_URL`·`REVALIDATE_SECRET`)을 **먼저** 넣는다 (`work05-implementation.md` U3 — 키가 없으면 서버가 기동하지 않아 재시작 루프에 빠진다)
