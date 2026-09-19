# REFACTOR_NOTES.md

> SUMMIT 정기공연 랜딩 페이지 리팩토링 기록
> 작성 시작일: 2026-08-31
> 목적: 1학기 실사용자 피드백을 근거로 진단 → 원인 확인 → 개선까지의 과정을 기록. 아직 리팩토링 실행 전, "발견" 단계까지의 기록.

---

## 1. 배경

1학기 여름 정기공연(2026.06.25~26) 런칭 후 동아리원(실사용자)들로부터 다음 피드백을 받음:

- "로딩이 느리다"
- "카드/이미지 로딩이 오래 걸린다"
- "스크롤이 중간중간 끊긴다"

이 문서는 위 피드백의 원인을 실제 코드/수치로 진단한 기록이다. 아직 원인을 코드로 직접 확인하기 전이었기 때문에, 추측이 아니라 Lighthouse 진단 + 코드 직접 확인을 통해 근거를 먼저 확보하는 순서로 진행함.

---

## 2. Before 측정 결과 (2026-08-30, 리팩토링 착수 전 원본 상태)

측정 조건: Chrome DevTools Lighthouse, Mobile, Navigation 모드, 시크릿 모드(확장 프로그램 영향 배제)

| 페이지                                           | Performance 점수 | LCP           | FCP  | TBT   | Speed Index | CLS | Total Byte Weight |
| ------------------------------------------------ | ---------------- | ------------- | ---- | ----- | ----------- | --- | ----------------- |
| `/` (홈)                                         | 78               | **4.4s** 🔴   | 1.0s | 300ms | 1.5s        | 0   | 974 KiB           |
| `/setlist`                                       | 79               | **4.8s** 🔴   | 0.9s | 210ms | 2.1s        | 0   | 784 KiB           |
| `/event-goods` (실제로는 셋리스트 전체보기 화면) | 71               | **9.8s** 🔴🔴 | 0.9s | 180ms | 3.8s        | 0   | **2,387 KiB**     |

**관찰**: 이미지 개수가 늘어나는 페이지일수록 LCP가 뚜렷하게 악화됨 (홈 8개 → setlist 5개 → event-goods 18개 이미지 요청). LCP가 페이지 간 가장 뚜렷한 병목이며, CLS는 세 페이지 모두 0으로 측정됨 (→ 4번 참고).

---

## 3. 발견된 문제

### 3-1. `/event-goods` — 외부 CDN에서 앨범 커버 원본 해상도를 그대로 로드 (가장 심각)

Network 요청 분석 결과, 이 페이지의 무거운 이미지 18개는 `public` 폴더가 아니라 **Apple Music CDN(`mzstatic.com`)에서 직접 가져오는 앨범 커버**였음. 전부 `600x600bb.jpg` — 즉 600x600 원본 해상도 그대로 요청하고 있고, 개당 60~190KB, 18개 합쳐서 약 1.9MB.

실제 화면에서 이 이미지들은 목록의 작은 썸네일(가로 40~60px 추정)로만 쓰이는데, 그 몇 배 크기인 원본을 그대로 받아오고 있음 — **이 페이지 LCP 9.8초의 핵심 원인으로 확정.**

가장 큰 5개:

- cover_KM0020509_1.jpg — 189KB
- 8809851798683.jpg — 187KB
- 201_cover.jpg — 169KB
- cover_KM0000121_1.jpg — 136KB
- 8809936060797.jpg — 133KB

→ 해결 방향(가설): iTunes/Apple Music Search API 응답에서 더 작은 사이즈 파라미터(`100x100bb.jpg` 등)를 요청하거나, `next/image`로 프록시해서 리사이징.

### 3-2. `public` 폴더 이미지 — 최적화 없이 직접 서빙 (홈/setlist 공통)

`public/day1-teamN.png`, `public/day2-teamN.png` 등 팀 카드 이미지 14개, 각 85~94KB. `next/image`를 거치지 않고 원본 그대로 요청됨 (`https://summit-concert.live/day2-team8.png` 형태로 직접 요청 확인, `_next/image` 경로 아님).

참고로 `concert-poster-latest.png`는 `_next/image?url=...&w=750&q=75` 형태로 확인되어 **일부는 이미 next/image를 쓰고 있음** — 팀 카드 이미지 쪽만 빠져있는 것으로 추정.

전체 `public` 폴더 이미지 총합 3.6MB (ticket-back/front 각 500KB대, 타임테이블 이미지 2개 각 470KB대 포함).

### 3-3. CLS가 0으로 측정된 것에 대한 재해석

세 페이지 모두 CLS 0 — 처음엔 "스크롤 끊김과 무관한가?"로 오해할 수 있으나, **Lighthouse의 CLS는 페이지 로드 시점의 레이아웃 변화만 측정**하고 로드 후 사용자의 실제 스크롤 중 발생하는 버벅임(jank)은 잡지 못함. 따라서 "스크롤이 끊긴다"는 피드백의 원인은 CLS가 아니라 다른 곳(이미지 디코딩 비용, 혹은 framer-motion 애니메이션의 메인 스레드 점유)일 가능성이 높음.

→ **다음 진단 단계**: DevTools Performance 탭으로 실제 스크롤 동작을 녹화해 원인 특정 필요 (아직 미실행).

### 3-4. 홈페이지 JS 실행 비용

홈페이지 Diagnostics에서 확인:

- Main-thread work: 7.5s
- Long task: 5개
- Reduce unused JavaScript: 약 200KiB 절감 가능

이미지 문제와 별개로 JS 실행 비용도 상당함. 홈페이지에 여러 개 걸려있는 `FadeInUp` 애니메이션 컴포넌트(framer-motion)가 원인일 가능성.

### 3-5. `lib/src/lib/supabase.ts` 중복 파일

정상 위치는 `src/lib/supabase.ts`. `lib/src/lib/supabase.ts`는 불필요한 중복으로, GitHub 트리 직접 확인으로 재확인됨. 제거 대상.

### 3-6. `dist` 폴더가 레포에 커밋되어 있음

빌드 산출물(`dist/assets/*.js`, `*.css`, 이미지 중복본)이 버전관리 대상이 되어있음. `.gitignore` 설정 미흡으로 추정. 저장소 용량 증가 + 혼란 유발.

### 3-7. 라우트명과 실제 콘텐츠 불일치

`/event-goods` 경로인데 실제 렌더링되는 화면은 "셋리스트 전체 보기"(곡별 앨범 커버 포함 플레이리스트 뷰)임. 네비게이션 메뉴에도 연결되어 있지 않은 상태(직접 URL 접근으로만 확인 가능). 애초에 굿즈 판매 목적으로 만들다가 셋리스트 상세 뷰로 용도가 바뀐 것으로 추정. 추후 `/setlist/all` 등으로 리네이밍 필요.

### 3-8. Supabase Free Tier 자동 Pause (운영 이슈)

진단 도중 Supabase 프로젝트가 free tier 미사용 기간 초과로 자동 pause되어 사이트 데이터가 전부 안 불러와지는 상황 발생 (원인: 데이터 삭제 아님, resume으로 즉시 복구 확인됨). 12월 정기공연 전까지 재발 방지 필요 — GitHub Actions로 주기적 핑을 보내거나 Pro 플랜 전환 검토.

### 3-9. (기존 확인) 대형 클라이언트 컴포넌트

`setlist/page.tsx`(654줄), `event-goods/page.tsx`(539줄) — 정적 데이터, 데이터 페칭, UI가 분리 없이 한 파일에 혼재. 전체가 `"use client"`로 선언되어 있고 Supabase 페칭이 `useEffect` 내부에서 이뤄져 SSR 이점을 포기하고 있음. `location/page.tsx`, `site-footer.tsx`는 Server-to-Client 조합 패턴이 올바르게 적용되어 있어 참고 가능.

---

## 4. 정량 데이터 확보 상태

- **Before 지표 확보 완료** (2026-08-30, 위 표 참고, 원본 상태 그대로 측정 — 손대지 않음)
- Lighthouse HTML/JSON 리포트 3종 저장 완료 (`lighthouse-before-{home,setlist,event}-0831`)
- **After 지표**: 리팩토링 완료 후 동일 조건으로 재측정 예정
- **실사용자 트래픽 데이터**: 없음. `@vercel/analytics` 등 어떤 analytics도 설치된 이력 없음(Vercel Analytics "Get Started" 화면으로 확인). 1학기엔 데이터 수집 체계 자체가 없었음 — 12월 정기공연 전 Analytics 선반영 필요.

---

## 5. 다음 단계 (미실행, 계획만)

우선순위 순:

1. `/event-goods` 앨범 커버 이미지 리사이징 (가장 확실한 개선 근거, 임팩트 최대)
2. `public` 폴더 팀 카드 이미지 → `next/image` 전환
3. DevTools Performance 탭으로 실제 스크롤 녹화 → jank 원인 특정
4. `setlist/page.tsx`, `event-goods/page.tsx` 서버/클라이언트 컴포넌트 분리 (TypeScript/React 학습 진도에 맞춰 진행 예정)
5. `lib/src/lib/supabase.ts` 삭제, `dist` 폴더 `.gitignore` 처리
6. `@vercel/analytics` 설치
7. `/event-goods` 라우트 리네이밍

---

## 6. work01-4 (Server/Client 분할) 진행 기록

- 2026-09-13: `setlist/page.tsx` 리팩토링 중 트랙 매칭 방식을 `trackItemsByTeamKey`(정규화된 팀명 문자열 키)에서 `trackItemsByCardId`(Line Up row id 키)로 임의 변경했다가, lineUpRows가 비어있고 setlistRows만 있는 엣지 케이스에서 더미 카드가 실데이터와 매칭될 기회를 잃는 회귀를 발견 — 스코프(CLS 수정)를 벗어난 개선이었으므로 원안(`trackItemsByTeamKey`)으로 원복함.

## 7. 버그 수정 기록: Setlist 스키마 변경 이후 팀당 1곡만 노출되던 문제 (2026-09-19)

### 배경

프로덕션 Supabase `Setlist` 테이블 스키마를 다음과 같이 변경함:

- 제거: `team`(문자열, Line Up.team_name과 매칭하던 값), `day`, `image_src`
- 추가: `teamId`(int8, `Line Up.id`를 참조하는 FK)
- 유지: `id`, `title`, `singer`, `album`, `youtube_url`

변경 직후 `/setlist`, `/event-goods` 페이지에서 각 팀 아래 곡이 1곡씩만(혹은 팀-곡 매칭이 어긋나게) 노출되는 회귀가 발생. Network 탭 확인 결과 Supabase 요청은 전부 200 정상 응답 — 쿼리 문제가 아니라 응답 데이터를 팀별로 그룹핑하는 프론트엔드 로직 문제로 판단하고 코드를 직접 확인함.

### 원인

`src/app/setlist/page.tsx`, `src/app/event-goods/page.tsx`의 `getTeamFromSetlistRow`/`getTeamFromRow` 함수가 `Setlist` row에서 `row.team` → `row.team_name` 순으로 값을 찾고, 둘 다 없으면 **해당 Setlist row 자신의 id**를 기준으로 `getTeamFallbackName(id)`를 호출해 임의의 팀명을 반환하는 폴백 구조였음.

스키마 변경으로 `Setlist.team`/`team_name` 컬럼이 사라지면서 모든 Setlist row가 항상 폴백 경로를 타게 됐고, 그 결과 **Setlist row 고유 id마다 서로 다른 팀명이 붙어버려** 사실상 모든 곡이 서로 다른(대부분 존재하지 않는) "팀"으로 흩어지는 결과가 나왔음. 화면에는 이게 "팀당 곡 1개"처럼 보였는데, 실제로는 팀 매칭 자체가 완전히 깨져 있던 것.

기존에도 문자열 정규화(`normalizeTeamName`) 기반 매칭이라 오탈자/표기 차이에 취약한 구조였는데, 이번 스키마 변경으로 애초에 매칭에 쓰일 컬럼 자체가 사라지면서 문제가 드러남. `.claude`에는 관련 스코프 문서가 없어 별도 참고할 규칙은 없었고, 과거 §6 기록(2026-09-13, `trackItemsByCardId`로 바꿨다가 lineUpRows가 비어있는 엣지 케이스 때문에 원복한 이력)이 있었으나, 이번엔 애초에 DB 스키마 자체가 id 기반 매칭을 강제하므로 그 우려가 더 이상 적용되지 않음(팀 문자열 매칭 경로가 스키마 상 존재하지 않게 됨).

### 수정 내용

문자열 정규화 매칭을 전부 제거하고 `Setlist.teamId` ↔ `Line Up.id` 숫자 매칭으로 교체:

- `src/lib/fetch-line-up-and-setlist.ts`: `SetlistRow` 타입에서 `team`/`day`/`image_src` 제거, `teamId?: number` 추가 (Line Up 테이블은 스키마 변경 없어 `LineUpRow` 타입은 그대로 둠)
- `src/app/setlist/page.tsx`, `src/app/event-goods/page.tsx`: `normalizeTeamName` 기반 팀명 정규화/그룹핑 로직 제거. `tracksByTeam: Record<string, TrackItem[]>` → `tracksByTeamId: Record<number, TrackItem[]>`로 변경하고 `row.teamId`로 그룹핑. `Line Up.id` 집합과 대조해 존재하지 않는 teamId는 무시(데이터 정합성 방어는 기존과 동일하게 유지, 키만 문자열→숫자)
- `src/components/sections/setlist-view.tsx`: 모달에서 곡 목록을 찾을 때 `normalizeTeamName(selectedCard.title)` 문자열 매칭 대신 `selectedCard.id`(Line Up row id)로 직접 조회하도록 변경. `normalizeTeamName` 함수 자체 삭제
- 카드/포스터/팀명 표시는 `Line Up` 테이블 기준이라 스키마 영향 없음 — `card-carousel.tsx`, `getTeamFromRow`(카드용) 등은 수정하지 않음

### 검증 결과 (2026-09-19, 로컬 프로덕션 데이터 기준)

Supabase에 직접 SQL로 확인한 팀별 곡 수와 실제 화면 노출 곡 수를 대조:

| teamId | Line Up 팀명 | DB상 곡 수 | 화면 노출 곡 수 |
| ------ | ------------- | ---------- | ---------------- |
| 1      | 8C8           | 4          | 4 (일치)         |
| 3      | 즐겜굴비      | 4          | 4 (일치)         |
| 4      | 써밋 음악도둑 | 6          | 6 (일치)         |

`/setlist`에서 8C8·즐겜굴비 카드를 각각 클릭해 모달에 뜨는 곡 목록이 DB의 `teamId` 그룹과 정확히 일치함을 확인(Playwright로 직접 클릭 후 스냅샷 대조). `/event-goods`에서도 1일차 전체 7개 팀의 곡 목록이 각 팀 아래 올바르게 묶여 렌더링됨을 확인(써밋 음악도둑 6곡 포함).

### 스코프 밖에서 발견했지만 손대지 않은 것 (참고용 기록)

- Supabase RLS(Row Level Security)가 `Line Up`, `Setlist` 테이블 모두 비활성화 상태 — anon key로 읽기/쓰기가 전부 열려 있음. 이번 버그 수정과 무관하여 별도 처리하지 않았고, 정책 설계 없이 RLS만 켜면 전체 접근이 막히므로 신중한 별도 작업 필요.
- `getTeamFallbackName`/`getImageFallbackPath`(Line Up 카드용 폴백)는 이번 수정 대상이 아니라 그대로 유지됨 — Line Up 테이블에 `team_name`이 비어있는 극단적 케이스에서만 동작하는 방어 코드.

## 8. DB 스키마 마이그레이션(FK 전환) + RLS 활성화 (2026-09-19)

### 배경

work02(Nest.js 백엔드 + 어드민 페이지) 착수를 앞두고, 어드민 페이지에서 팀명을 직접 수정할 수 있는 기능을 넣을 계획을 확정함. 이 상태에서 §7에서 다룬 `Setlist.team`(문자열) ↔ `Line Up.team_name`(문자열) 매칭 구조를 그대로 두면, 어드민이 팀명을 수정하는 순간 두 테이블의 연결이 깨지는 문제가 재발할 것이 자명했음. 또한 §7 말미 "스코프 밖에서 발견했지만 손대지 않은 것"에 기록해둔 RLS 비활성화 문제도 이번에 함께 해소함.

### 문제

1. `Setlist.team` 문자열 매칭 방식은 오탈자/표기 차이에 취약하고, §7에서 실제로 스키마 변경 한 번만으로 팀-곡 매칭이 전부 깨지는 회귀가 발생한 전례가 있음. 어드민의 팀명 수정 기능과 근본적으로 상충하는 구조
2. `Line Up`에 공연 순서를 나타내는 컬럼이 없어, 어드민의 팀 재정렬 기능을 구현할 방법이 없음
3. `Setlist`, `Line Up` 두 테이블 모두 RLS(Row Level Security)가 disabled 상태 — anon key로 읽기뿐 아니라 쓰기까지 가능한 보안 취약점 (§7에서 발견했으나 "정책 설계 없이 RLS만 켜면 전체 접근이 막히므로 신중한 별도 작업 필요"로 보류했던 항목)

### 변경 내용 (Supabase, production)

- **Setlist**: `team`(문자열), `day`, `image_src` 컬럼 제거. `teamId`(int8, FK → `Line Up.id`) 컬럼 추가
- **Line Up**: `performanceOrder` 컬럼 추가 (기존 컬럼 구조는 유지)
- **RLS**: `Setlist`, `Line Up` 두 테이블에 SELECT 전용 정책(`public` role, `using(true)`) 추가 후 RLS 활성화 → anon key는 이제 읽기만 가능, 쓰기는 불가능한 상태

최종 컬럼 구조(요약):

| 테이블   | 컬럼                                                              |
| -------- | ------------------------------------------------------------------- |
| Line Up  | `id`, `team_name`, `day`, `image_src`, `performanceOrder`(신규)     |
| Setlist  | `id`, `title`, `singer`, `album`, `youtube_url`, `teamId`(신규, FK → Line Up.id) |

### 검증

- 프론트엔드는 §7 수정으로 이미 `teamId` 기반 매칭(`tracksByTeamId`)으로 전환이 끝난 상태였기 때문에, 이번 컬럼 정리(`team`/`day`/`image_src` 제거)는 추가 코드 변경 없이 그대로 반영됨
- RLS 활성화 후 `/setlist`, `/event-goods`가 anon key로 정상적으로 데이터를 읽어오는지 확인. anon key로는 쓰기(insert/update/delete)가 거부되는 것을 확인
- `performanceOrder`는 이번 마이그레이션에서 컬럼만 추가한 상태로, 프론트엔드/백엔드 어디에서도 아직 사용하지 않음 — work02의 팀 재정렬 기능 구현 시점에 실제로 소비될 예정

## 9. work02-1 — Nest.js 프로젝트 세팅 + Supabase Postgres 직접 연결 (2026-09-19)

### 배경

§8에서 스키마 정규화(FK 전환)와 RLS 활성화가 끝나 work02 착수 조건이 충족됨. 이번 단계의 목표는 CRUD 구현이 아니라, **Nest.js가 Supabase PostgREST(anon key)를 거치지 않고 Postgres에 Prisma로 직접 붙는 상태를 만들고 연결을 검증하는 것**까지다. 빌드 순서 1단계(`.claude/rules/work-02-nest.js.md`)에 해당.

### 저장소 구조 판단 — web 이동은 보류

`apps/web` + `apps/api` 모노레포가 최종 목표지만, 이번에는 **`apps/api`만 신규 생성하고 Next.js는 루트에 그대로 뒀다.**

- `.vercel/repo.json`의 프로젝트 `directory`가 `"."` — web을 옮기면 Vercel 대시보드의 Root Directory 설정을 동시에 바꿔야 하고, 그 전까지 `summit-concert.live` 프로덕션 배포가 깨진다. 백엔드 세팅과 배포 설정 변경을 한 커밋에 섞을 이유가 없음
- web 이동은 경로 참조(tsconfig paths, 문서, Lighthouse 산출물)를 광범위하게 건드려 Nest 스캐폴딩과 diff가 뒤섞임

`apps/api` 경로는 web 이동 후에도 바뀌지 않으므로, 지금 확정해도 나중에 재작업이 없다. web 이동은 별도 작업으로 분리.

### 작업 내용

**1) NestJS 스캐폴딩** — `apps/api`, Nest 12 (ESM, TypeScript 6, vitest, oxlint). 기본 포트는 Next.js 개발 서버(3000)와 충돌하지 않도록 **3001**. 보일러플레이트 `AppController`/`AppService`와 그에 딸린 스펙은 제거하고 `HealthController`로 대체.

**2) Prisma 7.10.0** — `prisma` 패키지의 npm `latest` 태그가 `8.0.0-rc.15`(RC)를 가리키고 있어, 안정 버전인 7.10.0으로 명시 고정했다. Prisma 7부터 접속 URL은 `schema.prisma`의 `datasource` 블록이 아니라 `prisma.config.ts`에서 관리하고, 클라이언트는 driver adapter(`@prisma/adapter-pg`) 기반으로 동작한다.

**3) 연결 방식** — Supabase **Session pooler(포트 5432)** 사용.

| 후보 | 채택 여부 | 이유 |
| ---- | --------- | ---- |
| Direct connection (`db.<ref>.supabase.co:5432`) | ✗ | Free tier는 IPv6 전용이라 환경에 따라 접속 불가 |
| Transaction pooler (`:6543`) | ✗ | 서버리스용. Nest는 상주 프로세스라 세션 단위 연결이 적합하고, prepared statement 제약을 받을 이유가 없음 |
| **Session pooler (`:5432`)** | ✓ | IPv4 지원, 상주 서버에 적합, 마이그레이션도 동작 |

접속 계정은 `postgres`. `pg_roles` 확인 결과 `rolbypassrls = true`이고 두 테이블의 소유자이므로, §8에서 건 SELECT 전용 RLS 정책과 무관하게 관리자 쓰기가 가능하다 — 별도 service role 계정을 따로 만들 필요가 없었음.

**4) `db pull` 및 스키마 정리** — 기존 2개 테이블 introspect 성공. DB의 이름 규칙이 뒤섞여 있어(`Line Up` 테이블명에 공백, `team_name`/`image_src`는 snake_case, `teamId`/`performanceOrder`는 camelCase), **Prisma 쪽 이름은 PRD 데이터 모델 기준 camelCase로 통일하고 차이는 `@map`/`@@map`으로만 흡수**했다. `int8` → `BigInt`, `int2` → `Int @db.SmallInt`로 정확히 반영된 것도 확인.

| Prisma 모델/필드 | 실제 DB |
| ---------------- | ------- |
| `LineUp` | `@@map("Line Up")` |
| `LineUp.teamName` | `@map("team_name")` |
| `LineUp.cardImageUrl` | `@map("image_src")` |
| `Setlist.albumCoverUrl` | `@map("album")` |
| `Setlist.youtubeUrl` | `@map("youtube_url")` |

리네이밍이 DB에 영향을 주지 않는다는 것은 `prisma migrate diff --from-config-datasource --to-schema`가 *empty migration*을 반환하는 것으로 확인했다.

**5) 마이그레이션 이력 baseline** — 기존 테이블은 Prisma 이력에 없으므로, `0_init` 마이그레이션을 생성만 하고 `prisma migrate resolve --applied 0_init`으로 "이미 적용됨" 처리했다(SQL은 실행되지 않음). 이 과정을 생략하면 이후 마이그레이션이 기존 테이블을 재생성하려 든다.

**6) AdminUser 테이블 신규 생성** — PRD 데이터 모델 기준(`id` int8, `username`, `passwordHash`). PRD에 없지만 추가한 것은 `username` UNIQUE(로그인 조회 정합성)와 RLS 활성화.

`prisma migrate dev`가 아니라 **`prisma migrate deploy`를 사용**했다. `migrate dev`는 드리프트를 감지하면 DB 리셋(전체 DROP)을 제안하는 경로가 있어 프로덕션 DB에 쓸 수 없고, `deploy`에는 그 경로가 없다. 적용 SQL은 사전에 `migrate diff`로 전량 확인한 뒤 실행.

**7) 신규 테이블의 RLS** — `pg_default_acl` 확인 결과, `postgres`가 `public` 스키마에 만드는 테이블은 **`anon`/`authenticated`에게 ALL 권한(`arwdDxtm`)이 기본 부여**된다. 즉 RLS 없이 `AdminUser`를 만들면 anon key만으로 PostgREST를 통해 비밀번호 해시를 읽고 쓸 수 있다. 정책 없이 RLS만 활성화해 anon 경로를 전면 차단했다(`postgres`는 `rolbypassrls`라 영향 없음).

같은 이유로 Prisma가 자동 생성하는 `_prisma_migrations`도 노출 대상이 되어 Supabase 보안 린터가 ERROR(`rls_disabled_in_public`)를 냈다. 이미 적용된 마이그레이션 파일을 수정하면 체크섬이 깨지므로 별도 마이그레이션(`20260919120500_secure_prisma_migrations_table`)으로 분리했다.

이 마이그레이션은 한 차례 미적용 상태로 남았다가 이후 `migrate deploy`로 반영 완료됨 — 경위는 아래 "작업 중 발생한 이슈" 1번 참조.

### 검증

- `prisma db pull` → 기존 2개 모델 introspect 성공, 컬럼 타입/케이스 정확히 반영
- `migrate diff` → 리네이밍 후 드리프트 0 (empty migration)
- `GET /health` 응답: `{"status":"ok","database":"connected","rowCounts":{"lineUp":15,"setlist":64,"adminUser":0}}` — Prisma Client가 실제로 세 테이블을 조회함을 확인
- 마이그레이션 후 기존 데이터 무영향 확인: `Line Up` 15행, `Setlist` 64행, `teamId`가 채워진 곡 64/64행 (마이그레이션 전과 동일)
- 루트 `npm run build`(Next.js 프로덕션 빌드) / `npm run lint` 정상 통과 — 백엔드 추가가 기존 프론트엔드에 영향 없음

최종 상태(3개 마이그레이션 전부 반영 + DB 비밀번호 재설정 이후 재확인):

- `_prisma_migrations` 3행 모두 정상. `0_init`은 `applied_steps_count = 0`(baseline이라 SQL 미실행), 나머지 둘은 `1`(실제 실행됨)
- 4개 테이블 전부 `relrowsecurity = true`. `Line Up`/`Setlist`는 SELECT 정책 1개, `AdminUser`/`_prisma_migrations`는 정책 0개(= anon 전면 차단)
- Supabase 보안 린터 ERROR 0건. 남은 2건은 의도한 INFO(`rls_enabled_no_policy`)
- 새 비밀번호로 `GET /health` 재확인 → 동일 응답, 서버 로그 에러 없음

### 기존 프론트엔드에 가한 변경 (백엔드 추가의 부수 효과)

`apps/api` 추가만으로 기존 빌드가 깨지는 지점이 있어 함께 수정했다.

- **`tsconfig.json`**: `exclude`에 `apps` 추가. 루트 tsconfig의 `include`가 `["**/*.ts", ...]`이고 `exclude`가 `["node_modules"]`뿐이라, 그대로 두면 `next build` 타입체크가 Nest 코드를 끌어간다
- **`eslint.config.mjs`**: `globalIgnores`에 `apps/**` 추가 (백엔드는 자체 린터 oxlint 사용)
- **`.gitignore`**: `.env*` 패턴이 `.env.example`까지 무시하고 있어 `!.env.example` 예외 추가. 또한 루트의 `/node_modules`는 선행 슬래시 때문에 루트에만 적용되므로, `apps/api/.gitignore`를 따로 두어 `node_modules`/`dist`/`.env`/생성 클라이언트를 처리

### 이 단계에서 의도적으로 하지 않은 것

- **CRUD 로직 전부** — 1단계 스코프는 연결 검증까지
- **`Setlist.youtubeReviewStatus` 컬럼** — PRD에 "신규 컬럼 추가 필요"로 명시돼 있으나 빌드 순서 4단계(Song CRUD)에서 다룸
- **`apps/web` 이동** — 위 "저장소 구조 판단" 참조
- **BigInt 직렬화 처리** — `id`가 `int8`이라 Prisma는 `BigInt`로 매핑하는데, `JSON.stringify`가 `BigInt`에서 예외를 던진다. `/health`는 `count()`(number)만 반환해 문제가 없지만, 실제 레코드를 응답에 싣는 3단계(Team CRUD) 시작 시점에 직렬화 방식을 먼저 정해야 함
  - **→ 확정됨 (2026-09-19, §11)**: 전역 인터셉터·프로토타입 패치가 아니라 **응답 매퍼 + 응답 타입 선언**(`toTeamResponse` / `TeamResponse`). 근거와 기각한 대안은 §11 "기술 판단" 참조. 4단계 `Setlist`(`id`, `teamId` 둘 다 int8)도 같은 패턴을 재사용한다

### 작업 중 발생한 이슈 2건

**1) `_prisma_migrations` 보안 마이그레이션이 한 차례 미적용으로 남음**

`20260919120500_secure_prisma_migrations_table`을 만든 직후 `migrate deploy` 호출이 거부되면서 파일만 커밋되고 DB에는 반영되지 않은 상태로 한 턴을 넘겼다.

주의할 점은 **거부 주체가 Postgres가 아니라 개발 도구 쪽 권한 정책이었다**는 것이다. DB는 에러를 낸 적이 없다. 당시 기록을 "권한 정책에 걸려 차단됨"이라고만 남겨서, 이후 이걸 *`postgres` role의 DB 권한 부족* 문제로 오진하고 "Supabase 대시보드 SQL Editor에서 수동 실행 → `migrate resolve --applied`로 히스토리만 맞추기" 우회 경로를 검토하는 일이 있었다. 실제로는 그럴 필요가 없었다:

- 해당 마이그레이션은 `ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;` 한 줄이고, Supabase 관리 role(anon/authenticated/service_role)에 대한 GRANT/REVOKE가 없다
- `_prisma_migrations`의 소유자가 `postgres`(= 접속 계정 본인)이고, 테이블 소유자는 자기 테이블에 RLS를 켤 수 있다. Session pooler 연결과도 무관

결국 `migrate deploy`를 그대로 재실행해 반영됐다(`applied_steps_count = 1`로 실제 실행 확인). **교훈 두 가지**: (a) 실행 실패를 기록할 때 *무엇이* 거부했는지를 명시해야 한다 — 도구 정책 거부와 DB 권한 오류는 대응이 완전히 다르다. (b) `migrate resolve --applied`는 SQL 실행 여부를 검증하지 않고 "적용됨"으로 기록만 하므로, 수동 실행 단계를 빠뜨리면 마이그레이션 히스토리가 조용히 거짓이 된다 — 우회 경로로 쉽게 손대면 안 되는 명령이다.

**2) DB 비밀번호 노출 → 재설정**

`.env.example`에 실제 connection string(비밀번호 포함)이 들어간 상태가 잠시 존재했다. 이 파일은 **커밋 대상**이고 레포는 Public이라 그대로 뒀으면 자격증명이 공개됐을 상황이었다.

- 커밋 전에 값을 비웠고, git 이력에는 들어가지 않은 것을 확인함 (`git show :apps/api/.env.example` → 빈 값)
- 다만 노출 경로가 완전히 통제되지 않아 Supabase 대시보드에서 **DB 비밀번호를 재설정**하고 `apps/api/.env`만 갱신함. 재설정 후 `migrate deploy`/`GET /health` 모두 정상 동작 확인

부수적으로, 대시보드가 보여주는 `[YOUR-PASSWORD]`의 **대괄호가 placeholder 표기**인데 이를 포함한 채로 붙여넣으면 URL 파싱이 깨진다(실제로 한 번 발생). `.env.example` 주석에 이 두 가지(실제 값 금지, 대괄호 제거)를 명시해 뒀다.

### 완료 상태 및 다음 단계

- **완료 커밋**: `9809748` (`feature/nestjs-backend-setup`). 이후 PR #31로 `develop`에 머지됨(`1765e43`) — 위 문장은 작성 시점 기준이었고, 머지는 §10 착수 직전에 확인함
- **다음**: work02 빌드 순서 2단계 — Auth 모듈(JWT 로그인, PRD F001/F002). `.claude/rules/git-rules.md`에 따라 `feature/auth-*` 브랜치로 격리해 작업하고, `develop` 머지 전 별도 검증 단계를 거친다
- 이번 단계에서 만든 `AdminUser` 테이블이 Auth 모듈의 첫 소비처가 된다 (현재 0행 — 계정 시딩 방식은 2단계에서 결정)

## 10. work02-2 — Auth 모듈: JWT 로그인 + 접근 제어 (2026-09-19)

### 배경

work02 빌드 순서 2단계, PRD `F001`(관리자 로그인)/`F002`(접근 제어). §9에서 만든 `AdminUser` 테이블(0행)의 첫 소비처다.

목표는 "**AdminUser 계정으로 로그인하면 JWT가 발급되고, 그 JWT 없이는 관리자 라우트에 접근할 수 없는 상태**"까지. 3~6단계에서 붙일 팀/곡/유튜브 API가 이 Guard를 그대로 재사용하는 것이 전제라, 이 단계에서 만드는 것은 엔드포인트 2개가 아니라 **이후 모든 관리자 라우트가 올라탈 인증 기반**이다.

브랜치는 `.claude/rules/git-rules.md`의 "인증/세션 작업은 `feature/auth-*`로 격리" 규칙에 따라 `feature/auth-jwt-login`.

### 작업 내용

**1) 비밀번호 해싱 — Argon2id (`auth/password.service.ts`)**

`PasswordService`가 해싱/검증을 전부 감싼다. 파라미터는 OWASP Password Storage Cheat Sheet 권장값(m=19MiB, t=2, p=1)을 **코드에 명시적으로 고정**했다. 라이브러리 기본값과 현재는 같지만, 버전이 올라가며 기본값이 바뀌면 해싱 비용이 조용히 달라지기 때문이다.

**2) 초기 관리자 계정 시딩 (`scripts/seed-admin.ts`, `scripts/terminal-prompt.ts`)**

`npm run seed:admin` — 아이디/비밀번호를 **실행 시점에 터미널에서 직접 입력**받는다. 이미 있는 아이디를 입력하면 비밀번호 재설정으로 동작한다(MVP에 비밀번호 변경 UI가 없으므로 분실/교체 시 유일한 경로).

`AppModule` 대신 `ConfigModule + PrismaModule + PasswordService`만 묶은 축소 모듈로 컨텍스트를 띄운다. `AppModule`을 쓰면 `JWT_SECRET`까지 설정돼 있어야 스크립트가 돌기 때문에, "계정 먼저 만들고 JWT 설정은 나중에" 순서를 막을 이유가 없다.

**3) JWT 발급 (`auth/auth.service.ts`, `auth/auth.module.ts`)**

`POST /auth/login` → 200 + `{ accessToken }`. 자원을 만드는 게 아니라 토큰을 발급할 뿐이므로 201이 아니라 200으로 고정했다.

페이로드는 `sub`(= `AdminUser.id`) **하나뿐**이다. `username`을 넣지 않은 이유는 (a) 토큰은 브라우저 저장소·로그에 남기 쉬운 값이라 최소한만 담고, (b) 나중에 계정 정보 수정이 생겼을 때 토큰 안의 값이 DB와 어긋난 채 살아있는 상황을 만들지 않기 위해서다. 대신 `GET /auth/me`가 매번 DB를 한 번 읽는다.

`JWT_SECRET`은 `.env` 전용이며 **기본값을 두지 않았다** — 없거나 32자 미만이면 기동 자체가 실패한다. 개발 편의용 기본 시크릿을 두면 그대로 배포될 위험이 있다. `JWT_EXPIRES_IN`은 형식을 기동 시점에 정규식으로 검사한다(jsonwebtoken은 잘못된 형식을 첫 서명 시점에야 알려줘서, 오타가 첫 로그인까지 숨는다).

**4) 인증 실패 처리**

아이디가 틀렸는지 비밀번호가 틀렸는지 구분하지 않고 `401 아이디 또는 비밀번호가 올바르지 않습니다.` 하나로 응답한다. 메시지만 같게 해도 **응답 시간 차이로 계정 존재 여부가 드러나므로**, 계정이 없을 때도 더미 해시를 상대로 검증 비용을 동일하게 치른 뒤 실패시킨다(`burnVerifyCost`). 더미 해시는 기동 시 난수로 만들어 대응하는 평문이 어디에도 없다.

**5) 전역 Guard (`auth/jwt-auth.guard.ts`, `auth/public.decorator.ts`)**

`JwtAuthGuard`를 `APP_GUARD`로 등록해 **전역 적용**하고, 공개가 필요한 라우트에만 `@Public()`을 붙인다. 현재 공개 라우트는 `GET /health`와 `POST /auth/login` 둘뿐. 검증용 보호 엔드포인트로 `GET /auth/me`를 뒀다.

**6) 부수 변경**

- `main.ts`에 전역 `ValidationPipe` (`whitelist` + `forbidNonWhitelisted` + `stopAtFirstError`). 3~6단계의 수정 API에서 의도치 않은 컬럼이 덮어써지는 것을 막기 위한 사전 세팅이기도 하다
- `GET /health`에 `@Public()` — 전역 Guard 도입으로 그냥 두면 헬스체크가 막힌다

### 기술 판단

| 쟁점 | 선택 | 이유 |
| ---- | ---- | ---- |
| 해싱 알고리즘 | **Argon2id** (bcrypt ✗) | OWASP 1순위 권장. bcrypt는 메모리 하드하지 않아 GPU 공격에 상대적으로 약하고 72바이트 입력 잘림 제약이 있다. 관리자 계정 하나짜리 규모에서 둘 다 "충분히" 안전하지만, 지금 고르는 비용이 같으므로 더 나은 쪽을 고름 |
| Argon2 구현체 | **`@node-rs/argon2`** (`argon2` ✗) | napi-rs 사전 빌드 바이너리를 제공해 Windows 개발 환경에서 node-gyp/빌드 툴체인이 필요 없다. `win32-x64-msvc`와 `linux-x64-gnu/musl`이 모두 있어 향후 배포 환경도 커버 |
| Passport 사용 | **미사용** — `@nestjs/jwt` + 직접 구현 Guard | 전략이 JWT 하나뿐인데 `@nestjs/passport`/`passport`/`passport-jwt`가 붙으면 의존성 3개와 간접 계층만 늘어난다. Guard가 40줄이라 흐름을 전부 눈으로 따라갈 수 있는 쪽을 택함 (포트폴리오 서사의 "인증까지 직접 설계·구현"과도 맞음) |
| 토큰 만료 | **2시간** (`JWT_EXPIRES_IN`으로 조정 가능) | 학기 데이터를 한 번에 몰아 입력하는 용도라 너무 짧으면 입력 도중 로그인이 풀린다. 반대로 MVP에는 refresh 토큰도 서버측 무효화도 없어서 **이 값이 곧 "토큰 유출 시 살아있는 시간"**이다. 로그아웃도 클라이언트가 토큰을 버리는 것뿐이라, 실질적 강제 만료 수단은 `JWT_SECRET` 교체밖에 없다. 세션 길이를 늘려야 하면 만료를 늘릴 게 아니라 refresh 토큰을 도입하는 쪽이 맞다 |
| 초기 계정 시딩 | **대화형 입력** (CLI 인자 ✗, 환경변수 ✗) | CLI 인자는 셸 히스토리와 프로세스 목록에 평문이 남는다. 환경변수(`.env`)는 계정을 만든 뒤에도 평문 비밀번호가 파일에 계속 남는데, 이 레포는 Public이고 `.env`는 gitignore에만 의존한다. 대화형 입력은 히스토리·프로세스 인자·파일 어디에도 남지 않는다 |
| Guard 적용 방식 | **전역 `APP_GUARD` + `@Public()`** (`@UseGuards` ✗) | 기본값이 "인증 필요"가 되는 fail-closed 구조. 3~6단계에서 라우트를 추가하며 `@UseGuards`를 깜빡해 쓰기 엔드포인트가 열린 채 나가는 사고를 구조적으로 막는다. 대신 공개 라우트에 `@Public()`을 빠뜨리면 즉시 401로 드러나므로 실수의 방향이 안전한 쪽이다 |
| BigInt 직렬화 | **경계에서 명시 변환** (전역 `BigInt.prototype.toJSON` 패치 ✗) | §9에서 3단계 시작 시점에 정하기로 했던 항목이 `/auth/me` 때문에 먼저 걸렸다. 이번엔 `id.toString()`으로 응답 경계에서만 바꿨다. 전역 프로토타입 패치는 앱 전체의 JSON 동작을 바꾸는 부작용이 있어, 레코드를 목록으로 싣기 시작하는 3단계에서 인터셉터 방식까지 포함해 다시 판단한다 |

### 검증

**단위 테스트 17개** (`npm test`, `auth.service.spec.ts` / `jwt-auth.guard.spec.ts`) — 프로덕션 DB에 시험용 계정을 만들지 않고 로그인 **성공 경로**까지 검증하기 위해, `PrismaService`만 대역으로 두고 해싱·서명은 실제 구현을 그대로 쓴다.

- 올바른 자격증명 → 검증 가능한 토큰 발급, `sub`가 관리자 id
- 토큰 페이로드 키가 정확히 `sub`/`iat`/`exp`뿐 (민감정보 미포함)
- 비밀번호 오류·계정 없음의 **에러 메시지가 동일**
- 계정이 없어도 `burnVerifyCost`가 호출됨
- 해시가 평문을 포함하지 않고 `$argon2id$` + `m=19456,t=2,p=1`, 같은 비밀번호도 매번 다른 해시(salt)
- Guard: 토큰 없음/위조 서명/만료/Bearer 아님 → 전부 401이고 **메시지가 서로 구분되지 않음**, `@Public()` → 통과

**런타임 검증** (`node dist/main.js`, 임시 시크릿 사용)

| 요청 | 결과 |
| ---- | ---- |
| `GET /health` (토큰 없음) | `200` — 공개 유지 확인 |
| `GET /auth/me` (토큰 없음 / Bearer 아님 / 위조 서명) | 모두 `401 인증이 필요합니다.` |
| `POST /auth/login` (없는 계정) | `401 아이디 또는 비밀번호가 올바르지 않습니다.` |
| `POST /auth/login` (빈 비밀번호 / 필드 누락) | `400` + 필드당 메시지 1개 |
| `POST /auth/login` (DTO에 없는 필드 포함) | `400 property isAdmin should not exist` |
| `JWT_SECRET` 미설정 상태로 기동 | 기동 실패 (`Configuration key "JWT_SECRET" does not exist`) |

없는 계정에 대한 로그인 응답 시간은 **약 23~38ms**로, 해시 검증을 건너뛰던 상태(약 2ms)와 뚜렷이 구분된다 — 타이밍 동일화가 실제로 동작함을 확인.

**시드 스크립트** — DB에 쓰지 않는 경로(짧은 비밀번호/확인 불일치/빈 아이디/아이디와 동일한 비밀번호/입력 중단/CRLF)를 전부 확인했고, 마스킹(`*`)도 동작. 검증 후 `AdminUser` 행 수가 여전히 0인 것을 SQL로 확인했다.

**회귀 없음** — 루트 `npm run build`(Next.js 프로덕션 빌드) 정상, `apps/api` `npm run lint` 정상.

**남은 검증 1건**: 실제 계정으로의 엔드투엔드 로그인은 계정 시딩이 선행돼야 하므로 사용자가 직접 수행한다(아래 절차). 단위 테스트가 같은 경로를 대역으로 덮고 있지만, 실제 DB 레코드를 거치는 경로는 아직 실행되지 않았다.

> 검증 중 포트 3001을 1단계 때 띄워둔 서버가 점유하고 있어 요청이 그쪽으로 가는 일이 있었다(라우트가 없어 전부 404). 남의 프로세스를 죽이는 대신 3002로 검증했다. **증상이 401이 아니라 404면 Guard 문제가 아니라 다른 서버에 붙은 것**을 먼저 의심할 것.

### 초기 계정 생성 절차

```bash
cd apps/api
# 1) .env에 JWT_SECRET 생성해서 넣기 (값은 아래 명령 출력을 붙여넣는다)
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
# 2) 대화형으로 계정 생성 (아이디/비밀번호는 입력 시점에만 존재, 12자 이상)
npm run seed:admin
```

### 이 단계에서 의도적으로 하지 않은 것

- **로그인 시도 횟수 제한(rate limiting)** — 현재 `POST /auth/login`은 무제한 시도가 가능하다. Argon2id 검증 비용(약 20ms)이 약간의 완충은 되지만 방어책이 아니다. **API를 외부에 배포하기 전에 반드시 선행되어야 하는 항목**(`@nestjs/throttler`). 지금은 로컬 전용이라 미적용
- **refresh 토큰 / 서버측 토큰 무효화** — 위 만료 시간 판단 참조. 필요해지는 시점은 7단계(관리자 프론트)에서 실제 사용 패턴이 나온 뒤
- **CORS 설정** — 프론트(3000)에서 API(3001)를 호출하는 7단계에서 필요. 지금 열어둘 이유가 없다
- **관리자 프론트 로그인 페이지** — 빌드 순서 7단계
- **팀/곡/유튜브 CRUD 라우트** — 3~6단계. 이번 Guard를 그대로 재사용하면 된다 (3단계 팀 CRUD는 §11에서, 4단계 곡 CRUD는 §12에서 완료. 두 단계 모두 Guard 재사용 확인됨)
- **`Setlist.youtubeReviewStatus` 컬럼** — §9에 이어 계속 보류. **4단계에서도 추가하지 않았고 6단계로 이월했다**(§12) — 컬럼만 먼저 만들면 아무도 읽지 않는 상태 값이 프로덕션 스키마에 남는다. 유튜브 배치/리뷰 기능과 함께 추가한다

#### 7단계(배포/관리자 프론트) 전 확인 항목

위 rate limiting·CORS와 함께 배포 전에 반드시 확인해야 하는 항목을 여기에 모아 둔다.

- **공개 프론트의 팀 id 범위 하드코딩** (2026-09-19, §11 조사 중 발견) — `src/app/setlist/page.tsx`와 `src/app/event-goods/page.tsx`가 `day`/`image_src`가 비었을 때 **팀 id 범위로 일자·팀명·이미지를 추정하는 폴백**을 갖고 있다. 두 파일의 구현이 서로 다른 것이 특히 문제다.
  - `setlist/page.tsx`: `id 1~7 → day1`, `id 8~14 → day2`, 그 외 `null`(= 렌더링 제외)
  - `event-goods/page.tsx`: `id 1~7 → day1`, **`id >= 8 → day2` (상한 없음)** → id 16 이상의 신규 팀이 무조건 2일차로 분류된다
  - `getImageFallbackPath(16)`은 에러가 아니라 **`/day1-team1.png`(8C8 사진)** 을 돌려준다. 즉 깨진 이미지가 아니라 **엉뚱한 이미지**가 뜬다
  - **어드민으로 만든 팀은 F007(카드뉴스 업로드, 5단계) 전까지 `image_src`가 NULL**이므로 이 폴백을 그대로 탄다. 즉 "팀 등록 → 공개 페이지에 8C8 사진으로 노출"이 실제로 가능한 경로다
  - 지금 당장 터지지 않는 이유는 기존 15행이 `day`/`image_src`를 모두 채우고 있어 폴백이 호출되지 않기 때문이다. work03에서 이 폴백을 제거하거나 최소한 두 파일의 규칙을 통일해야 한다

### 완료 상태 및 다음 단계

- 브랜치 `feature/auth-jwt-login` (`develop`에서 분기)
- **다음**: work02 빌드 순서 3단계 — Team CRUD(PRD F003~F006). 시작 시점에 BigInt 직렬화 방식을 전역 정책으로 확정해야 한다 → §11에서 완료

## 11. work02-3 — 팀(Line Up) CRUD: 조회/등록/수정/순서 재정렬 (2026-09-19)

- **날짜**: 2026-09-19
- **브랜치**: `feature/team-crud` (`develop`에서 분기. 분기 전 로컬 `develop`이 `origin/develop`과 동일한 `6c02b98`임을 확인 — 2단계 때처럼 뒤처져 있지 않았다)
- **관련 PR**: work02-3, `feat: 팀(Line Up) 조회/등록/수정/순서 재정렬 API 구현` (푸시/PR 생성은 보류)

### 배경

work02 빌드 순서 3단계, PRD `F003`(팀 목록 조회) / `F004`(팀 등록) / `F005`(팀 정보 수정) / `F006`(공연 순서 재정렬). §10에서 만든 전역 Guard 위에 올라가는 **첫 실사용 API**이고, §9에서 "3단계 시작 시점에 정한다"고 미뤄 둔 **BigInt 직렬화 정책**을 확정해야 하는 단계다.

팀 **삭제**는 만들지 않았다 — PRD가 MVP 스코프에서 제외했고(학기 단위 통째 갱신 전제, 오입력은 수정으로 대응), `Setlist.teamId` FK가 `ON DELETE NO ACTION`이라 곡이 딸린 팀은 DB가 애초에 삭제를 거부한다.

### 구현 전 조사에서 드러난 것 (설계를 바꾼 사실들)

코드를 쓰기 전에 스키마와 **실제 프로덕션 데이터**를 확인했고, 그 결과 초안 설계를 두 군데 바꿨다.

| 조사 항목 | 확인된 사실 | 설계에 미친 영향 |
| --- | --- | --- |
| `performanceOrder` 범위 | 전체 통틀어 1..15가 **아니라 일자별 1..N** (day1=1..7, day2=1..8) | 정렬 기준이 `day → performanceOrder`가 되고, **재정렬 단위가 일자별**로 바뀜. 초안의 "전역 순서 배열"은 데이터와 맞지 않아 폐기 |
| `day` 값 형태 | 날짜가 아니라 리터럴 `"day1"` / `"day2"` | DTO 검증을 `/^day[1-9]\d*$/`로 고정. 공개 프론트가 이 문자열을 그대로 비교하므로 "1일차" 같은 값이 들어가면 해당 팀이 화면에서 사라진다 |
| `performanceOrder` unique 제약 | **없음** (실제 DB 제약 전수 조회: PK 2개 + FK 1개가 전부, 인덱스도 PK뿐) | 재정렬 중간 상태 충돌이 없으므로 임시 오프셋 트릭 불필요. 설계 쟁점 하나가 통째로 사라짐 |
| `Setlist.teamId` | 스칼라가 아니라 **Prisma 관계**(`LineUp.songs` 역방향 포함), `onDelete: NoAction` | 4단계에서 `include`/`_count` 사용 가능. 삭제 미구현 결정과도 방향이 일치 |

### 작업 내용

**1) 엔드포인트 4개** (`src/teams/`, 전부 인증 필요 — `@Public()` 미사용)

| 메서드 | 경로 | 동작 |
| --- | --- | --- |
| `GET` | `/teams` | `day` → `performanceOrder` → `id` 순 정렬 (NULL은 뒤) |
| `POST` | `/teams` | 팀명 + 공연일자 + 공연순서 한 세트. 같은 일자에 순서가 겹치면 409 |
| `PATCH` | `/teams/reorder` | 해당 일자 **전체** 팀 id 순서 배열 → 서버가 인덱스로 1..N 부여 |
| `PATCH` | `/teams/:id` | 팀명·공연일자 개별 수정 |

`reorder`는 `:id`보다 **먼저 선언**해야 한다(Express 매칭 순서). 선언 순서가 뒤집히면 `reorder`가 id로 파싱돼 400이 나므로, 컨트롤러 주석 + 단위 테스트로 순서를 고정했다.

**2) 응답 계약 (`dto/team-response.ts`)** — `TeamResponse` 인터페이스 + `toTeamResponse` 매퍼. DB 컬럼명(`team_name`/`image_src`)은 Prisma `@map`이 이미 흡수했으므로 매퍼가 실제로 하는 일은 `BigInt` → `string` 변환 하나다.

**3) `ParseBigIntPipe` (`src/common/`)** — `:id`를 BigInt로 변환. `BigInt("reorder")`가 던지는 `SyntaxError`가 500으로 새지 않도록 형식·자릿수·int8 범위를 먼저 거른다. 같은 규칙이 재정렬 본문의 `teamIds`에도 필요해서 `parseBigIntId` 함수로 분리했다. 4단계에서 그대로 재사용한다.

**4) 재정렬 집합 검증** — 중복 id / 존재하지 않는 id / 다른 일자의 id / 누락(부분 목록) / 빈 배열을 전부 400으로 거부하고, 검증을 모두 통과한 뒤에야 `prisma.$transaction` 안에서 순차 갱신한다.

**5) `day` 이동 시 순서 재배치** — `day`가 **실제로 바뀔 때만** 대상 일자의 맨 뒤(`max+1`)로 보낸다. 같은 `day`를 그대로 보내면 재배치하지 않는다(no-op). `max+1` 조회와 갱신은 같은 트랜잭션 안에 있다.

### 기술 판단

| 쟁점 | 선택 | 이유 |
| --- | --- | --- |
| **BigInt 직렬화** (§9/§10 이월 항목 확정) | **응답 매퍼 + 응답 타입 선언** (전역 인터셉터 ✗, `BigInt.prototype.toJSON` 패치 ✗) | 매퍼를 쓰면 **타입 자체가 API 계약**이 된다 — 컨트롤러 반환 타입만 보고 클라이언트가 받는 모양을 알 수 있다. 인터셉터는 "빠뜨릴 수 없다"는 장점이 있지만 서비스가 `{id: bigint}`를 반환한다고 선언해 놓고 실제로는 `string`이 나가서 **타입이 계약을 설명하지 못한다**. 매퍼를 빠뜨렸을 때의 실패는 `JSON.stringify` 예외 → 즉시 500이라 조용히 새지 않는다. 검토 당시 "컬럼명 매핑도 어차피 응답 경계에서 하니까"를 근거로 들었는데, 확인해 보니 **컬럼명은 Prisma `@map`이 이미 처리**하고 있어서 그 근거는 성립하지 않았다 — 순수하게 위 이유로 선택 |
| **재정렬 요청 형식** | **`{ day, teamIds[] }`** (`{id, performanceOrder}[]` ✗) | 서버가 배열 인덱스로 1..N을 부여해 **"연속·중복 없음" 불변식을 서버가 소유**한다. 클라이언트가 숫자를 계산해 보내면 `{1,2,2,5}` 같은 값이 올 수 있어 어차피 서버가 전부 재검증해야 한다 — 검증 코드는 같은데 사고 여지만 는다. 드래그 UI가 그대로 내놓는 모양이기도 하다 |
| **부분 목록 허용 여부** | **불허 — 일자 전체 집합과 정확히 일치해야 통과** | 빠진 팀의 순서값이 그대로 남아 1..N 연속성이 깨진다. "존재하지 않는 id"도 404가 아니라 400으로 처리했다 — 이 요청의 본질은 단일 자원 지목이 아니라 **본문 전체가 집합으로서 유효한가**이고, 부분 404를 섞으면 클라이언트가 분기할 이유가 없다 |
| **`(day, performanceOrder)` DB unique 제약** | **추가하지 않음** | 일반 unique 인덱스를 걸면 순서를 맞바꾸는 **중간 상태가 즉시 위반**이라 `DEFERRABLE` 제약이 필요한데 Prisma가 이를 모델링하지 못한다. 불변식은 애플리케이션(트랜잭션 + 집합 검증)이 보장하고, 대신 아래 "남겨둔 레이스"를 명시해 둔다 |
| **등록 시 순서 중복** | **409로 거부** (뒤로 밀기 ✗, 중복 허용 ✗) | 순서 변경에는 전용 엔드포인트가 이미 있다. 등록이 *다른 팀의 순서까지* 건드리는 두 번째 경로가 되면 "왜 저 팀이 밀렸는지"를 추적할 수 없다. 중복 허용은 정렬을 비결정적으로 만들어 공개 페이지 노출 순서가 흔들린다 |
| **`day` 변경 시 순서** | **대상 일자의 맨 뒤로 자동 이동** (충돌 시 409 ✗) | 일자를 옮기는 순간 기존 순서값은 의미를 잃는다(대상 일자에 같은 번호가 이미 있을 수 있음). 맨 뒤 배치가 유일하게 놀랍지 않은 선택이고, "먼저 재정렬하고 다시 오세요"라는 2단계 강요를 피한다. 원래 일자에 생기는 **번호 공백은 정렬에 무해**하며 다음 재정렬이 1..N으로 자동 복구한다. `performanceOrder`를 클라이언트가 직접 지정하는 것은 여전히 금지(`forbidNonWhitelisted` → 400)이고, **서버 주도 재배치만 예외**다 |
| **응답 필드명** | **PRD 개념명** (`teamName`, `cardImageUrl` 등) | Prisma 모델이 이미 그 이름을 쓰고 있어 추가 비용이 0. `cardImageUrl`은 F007(5단계) 전까지 **읽기 전용**으로만 응답에 포함하고 입력 DTO에는 넣지 않는다 |
| **Prisma 에러 매핑** | `P2025` → 404, `P2002` → 409 | `P2025`는 정상 경로에서 발생하지 않지만(갱신 직전에 존재 확인) API 밖에서 행이 사라졌을 때 500으로 새는 것을 막는다. **`P2002`는 "도달 불가"로 판단했다가 런타임 검증에서 실제로 터졌다** — 아래 트러블슈팅 1번 참조 |
| **DTO 검증 위치** | class-validator + 전역 `ValidationPipe` 재사용 | §10에서 이미 `whitelist`/`forbidNonWhitelisted`/`stopAtFirstError`를 걸어 둔 덕분에 이 단계에서 추가 설정이 필요 없었다. `stopAtFirstError` 때문에 데코레이터를 역순(맨 아래가 먼저 보고됨)으로 선언하는 2단계 컨벤션을 그대로 따랐다 |

### 검증

**단위 테스트 78개** (`npm test`, 2단계 17개 + 이번 61개). 2단계와 같이 `PrismaService`만 대역으로 두되, 호출 여부만 보는 대신 **작은 인메모리 저장소로 동작까지 흉내 내서** 순서 부여·집합 검증을 실제로 검증했다.

- `findAll`: 정렬 인자, id 문자열화, 응답 전체의 JSON 직렬화 가능 여부
- `create`: 정상 등록 / 순서 중복 409(그리고 **`create`가 호출되지 않음**) / 다른 일자의 같은 번호는 허용 / `P2002` → 409
- `update`: 404 / 빈 본문 400(트랜잭션을 열지도 않음) / 팀명만 수정 시 순서·일자 불변 / **id를 건드리지 않음**(FK 보호) / `day` 변경 시 맨 뒤 / 같은 `day`는 no-op
- `reorder`: 1..N 부여 / 다른 일자 불간섭 / 누락·타 일자 id·중복 id·비숫자 id 거부 / 거부 시 **`update`가 한 번도 호출되지 않음** / 트랜잭션 1회 + `update` N회
- 컨트롤러: **4개 핸들러와 클래스에 `isPublic` 메타데이터가 없음**(`@Public()` 오부착 방지), `reorder` 선언이 `:id`보다 앞임, 경로·메서드 메타데이터
- DTO: 전역 파이프와 **동일한 옵션**으로 재현해 공백 trim, 빈 문자열 거부, `day` 형식, int2 상한(32768 거부), 미선언 필드 거부

**런타임 검증 80개 체크, 실패 0** (`node dist/main.js`, 포트 3002 — 1단계 때처럼 3001을 다른 프로세스가 잡고 있을 때 404로 오인하는 것을 피하려고 분리).

| 구간 | 내용 | 결과 |
| --- | --- | --- |
| A1 | 4개 엔드포인트 × (토큰 없음 / 위조 서명 / 만료 / Bearer 아님) | 전부 `401 인증이 필요합니다.` |
| A1 | `GET /health` | `200` — 공개 유지 (회귀 없음) |
| A3 | POST DTO 거부 10종 | 전부 `400` |
| A4 | `:id` 파싱(`abc`/`0`/`-1`/int8 초과), 없는 id, 빈 본문, `performanceOrder` 주입 | `400` ×6, `404` ×1 |
| A5 | 재정렬 거부 8종(빈 배열/형식/중복/부분/타 일자/미지의 일자) | 전부 `400`, **직후 스냅샷 diff 0** |
| A6 | 실제 `day1`/`day2` **현재 순서 그대로 전송(무변경)** | `200`, 응답이 시작 시점과 **바이트 단위 동일** |
| B | 임시 일자(`day98`/`day99`) 임시 팀 4건으로 등록·중복 409·수정·재정렬·swap·일자 이동·no-op·공백 복구 | 전부 기대값 일치 |
| C | 임시 행 삭제 후 복구 확인 | 15행 / `Setlist` 64행 / `teamId` 매칭 **64/64** / 순서 시그니처 무변경 / `GET /teams` 스냅샷 **바이트 단위 동일** |

**프로덕션 데이터 보호 절차** (별도 테스트 DB가 없어 프로덕션에 직접 검증했다)

- **쓰기가 없는 거부 케이스를 전부 먼저** 실행하고, 그 직후 스냅샷 diff가 0인지 확인한 뒤에 쓰기 구간으로 넘어갔다
- 실제 `day1`/`day2` 행에는 **swap을 하지 않았다**. "현재 순서 그대로 전송" 무변경 검증만 수행
- 임시 팀은 실제 일자와 섞이지 않도록 **`day98`/`day99`** 를 사용하고 팀명을 `__verify_*`로 고정. 임시 팀에는 **곡(`Setlist`)을 절대 만들지 않았고**, 정리 스크립트가 삭제 전에 그 사실을 다시 확인한다
- 임시 행 생성부터 삭제까지를 `try/finally`로 묶어 중간 실패와 무관하게 정리되도록 했다. **실제 노출 창은 1초**
- 스냅샷은 레포 바깥(세션 스크래치패드)에 저장했다 — `.gitignore`에 의존하지 않는 쪽이 확실하다
- **시퀀스는 되돌리지 않았다.** 임시 팀이 소비한 id는 **16~19**이며, 되감으면 향후 id 재사용 위험이 생긴다. 현재 `Line Up` 시퀀스는 19에 있고 다음 팀은 20번부터 시작한다

**회귀 없음** — 루트 `npm run build`(Next.js 프로덕션 빌드) / `npm run lint`, `apps/api` `npm run build` / `npm run lint` 모두 정상.

**엔드투엔드 로그인은 이번에도 미수행** — 관리자 비밀번호를 주고받지 않는다는 원칙에 따라, Guard 검증에는 `JWT_SECRET`으로 **로컬에서 직접 서명한 토큰**을 사용했다. 서명·검증 경로는 서버가 쓰는 것과 동일하지만, `POST /auth/login`을 통과하는 실제 자격증명 경로는 §10과 마찬가지로 사용자 몫으로 남아 있다.

### 트러블슈팅 기록

**1) `POST /teams`가 프로덕션에서 500 — id 시퀀스가 실제 데이터보다 뒤처져 있었다**

런타임 검증 첫 실행에서 A/P 구간(인증·검증·조회)은 전부 통과했는데 **쓰기가 5건 모두 500**이었다. 서버 로그의 실제 에러는 다음과 같다.

```
PrismaClientKnownRequestError: Unique constraint failed on the constraint: `setlist_pkey`
code: 'P2002' → originalMessage: 'duplicate key value violates unique constraint "setlist_pkey"'
```

원인을 단정하지 않고 시퀀스 상태를 직접 조회했다.

| 테이블 | `max(id)` | 시퀀스 `last_value` | `is_called` | 다음 `nextval` |
| --- | --- | --- | --- | --- |
| `Line Up` | 15 | 7 | true | **8 → 이미 존재** |
| `Setlist` | 64 | 1 | **false** | **1 → 이미 존재** |
| `AdminUser` | 1 | 1 | true | 2 (정상) |

기존 행(`Line Up` 1~15, `Setlist` 1~64)이 Supabase 콘솔/CSV로 **id를 명시해서** 들어가 `BIGSERIAL` 시퀀스가 함께 전진하지 않은 것이다. `AdminUser`만 멀쩡한 것이 이 진단의 대조군이다 — 그것만 Prisma로 삽입했다.

**이건 이번 단계만의 문제가 아니었다.** `Setlist` 시퀀스는 `is_called=false`, 즉 한 번도 호출된 적이 없어서 **4단계(곡 등록)도 첫 삽입부터 똑같이 실패**했을 상황이었다. 마이그레이션 `20260919210000_resync_id_sequences`로 두 시퀀스를 함께 교정했다.

```sql
SELECT setval(pg_get_serial_sequence('"Line Up"', 'id'),
              COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM "Line Up";
```

- 시퀀스 이름을 직접 쓰지 않고 `pg_get_serial_sequence`로 찾는다 — `Line Up`의 시퀀스 이름은 `setlist_id_seq`다(PK 이름이 `setlist_pkey`인 것과 같은, 테이블 개명의 흔적). 적용 전에 두 테이블 모두 이 함수가 **NULL이 아닌** 값을 돌려주는지 확인했다. `setval`의 첫 인자가 NULL이면 에러 없이 조용히 넘어가기 때문이다
- **행은 전혀 건드리지 않는다.** 시퀀스 위치만 앞으로 옮기므로 이미 쓰인 id가 재사용될 위험도 없다
- §9와 같은 이유로 `migrate dev`가 아니라 **`prisma migrate deploy`** 로 적용했다
- 적용 후 확인: `Line Up` 15/true, `Setlist` 64/true, 행 수 15·64, `teamId` 매칭 64/64, 순서 시그니처 무변경

**부수적으로 확인한 것**: 재실행에서 시퀀스가 15 → 19로 **정확히 등록 성공 횟수(4)만큼** 전진했다. 즉 **INSERT 이전에 거부되는 409(순서 중복)는 `nextval`을 소비하지 않는다.** 반대로 첫 실행에서는 한 행도 생성되지 않았는데 시퀀스가 움직였는데, 이는 "실패한 INSERT도 `nextval`을 소비한다"는 Postgres 동작(시퀀스는 비트랜잭션적)과 일치한다. 다만 **첫 실행 직전 값을 측정해 두지 않았으므로** 이 부분은 정황 일치이지 직접 확인은 아니다.

**2) "`P2002`는 도달 불가"라는 판단을 정정함**

설계 단계에서 "`Line Up`의 unique 인덱스는 PK뿐이므로 `P2002`는 도달할 수 없는 분기이고, 미리 처리하는 것은 과설계"라고 판단하고 `P2025`만 매핑했다. **틀렸다.** PK 자체가 unique 제약이고, 위 1번처럼 시퀀스가 뒤처지면 바로 그 경로로 터진다. "제약 목록을 봤다"는 것과 "그 제약이 위반될 경로가 없다"는 것을 같은 것으로 취급한 판단 오류였다.

교정: `mapUniqueViolation`을 추가해 `P2002` → 409로 매핑하고, 회귀 테스트를 넣었다. 메시지는 **사용자 입력 오류로 읽히지 않도록** 원인을 명시한다 — 같은 409라도 "순서 중복"(입력 문제)과 "id 발급 충돌"(서버 데이터 정합성 문제)은 대응이 완전히 다르기 때문이다.

> `day1의 2번 순서는 이미 '뉴비' 팀이 사용 중입니다.` (입력 문제)
> `서버 측 id 발급이 충돌해 팀을 등록하지 못했습니다. 입력값 문제가 아니며, id 시퀀스 재동기화가 필요할 수 있습니다.` (서버 문제)

**3) "임시 행은 공개 프론트에 렌더링되지 않는다"는 발언을 정정함**

임시 팀이 공개 페이지에 영향을 주는지 확인하면서, 처음에는 `src/app/setlist/page.tsx`의 `getDayFromRow`가 알 수 없는 `day`에 `null`을 반환하는 것만 보고 "공개 프론트는 이 값을 렌더링하지 않는다"고 단정했다. **`event-goods/page.tsx`에 별도 복사본이 있고 그 폴백에는 상한이 없다**(`id >= 8 → day2`)는 것을 확인하지 않은 추측이었다.

실제로는 임시 팀이 `/event-goods`의 **2일차 데이터에 포함된다**. 화면에 보이지 않는 이유는 `event-goods-view.tsx`가 `tracks.length > 0`인 팀만 렌더링하기 때문인데, 이는 임시 팀에 곡이 없어서 **우연히** 안전했던 것이다(서버 → 클라이언트 페이로드에는 들어간다). 이 사실을 보고하고 승인을 받은 뒤 쓰기 검증을 진행했고, 폴백 자체의 정리는 §10 "7단계 배포 전 확인 항목"에 기록했다.

**교훈**: 같은 로직의 복사본이 두 파일에 있으면 한쪽만 읽고 일반화하면 안 된다. 그리고 "확인했다"와 "그럴 것이다"를 보고 단계에서 구분해서 적어야, 상대가 검증 여부를 판단할 수 있다.

### 이 단계에서 의도적으로 하지 않은 것

- **팀 삭제 API** — PRD MVP 제외. 학기 단위 통째 갱신 전제이고 오입력은 수정으로 대응한다. FK가 `NO ACTION`이라 곡이 딸린 팀은 DB도 삭제를 막는다
- **카드뉴스 이미지 업로드(F007)** — 5단계. `image_src`는 `cardImageUrl`로 **읽기 전용 응답**에만 포함하고, 입력 DTO에는 넣지 않았다(보내면 400)
- **Setlist(곡) API** — 4단계. 이번에 만든 `ParseBigIntPipe`·응답 매퍼 패턴·Prisma 에러 매핑을 그대로 재사용하면 된다
- **로그인 시도 제한(`@nestjs/throttler`) / CORS** — §10의 판단 유지. 둘 다 **7단계(배포/관리자 프론트) 전 선행 항목**이며 지금 열어 둘 이유가 없다
- **`songCount` 같은 파생 필드** — PRD F003은 목록 조회까지다. 필요해지면 4단계에서 `_count`로 붙인다
- **`(day, performanceOrder)` DB 제약 추가** — 위 기술 판단 표 참조
- **`/event-goods` id 범위 폴백 수정** — 프론트 스코프. §10 "7단계 배포 전 확인 항목"에 기록만 했다

### 남겨둔 결정 (4단계 이후로 이월)

- **`day` 문자열 정렬** — `day`가 문자열이라 `day10`이 `day2`보다 앞에 온다. 현재 `day1`/`day2`뿐이라 그대로 뒀다. 3일차 이상으로 늘어나거나 `day10`이 생기는 시점에 (a) 정렬용 숫자 컬럼 분리 또는 (b) 별도 `Day` 테이블로 정규화를 검토한다
- **등록 시 남아 있는 레이스** — `(day, performanceOrder)`에 unique 제약이 없어서, 중복 확인과 INSERT를 한 트랜잭션에 묶어도 동시 요청 경쟁이 **완전히 닫히지는 않는다**. 관리자 1인 전제라 수용했다. 관리자가 여러 명이 되면 DB 제약(`DEFERRABLE` 포함)을 다시 검토해야 한다
- **`Setlist.youtubeReviewStatus` 컬럼** — §9·§10에 이어 계속 보류(4단계)
- **BigInt 매퍼의 반복 비용** — 모델마다 매퍼를 하나씩 쓰는 방식이라 4~6단계에서 반복이 쌓인다. 부담스러워지는 시점(6단계쯤)에 인터셉터 방식을 다시 판단한다
- **work03 대량 마이그레이션 시 시퀀스 재동기화** — 2학기 콘텐츠를 **id를 명시해서** 넣으면 위 트러블슈팅 1번과 똑같은 상황이 재현된다. 대량 삽입 뒤에는 반드시 `setval(pg_get_serial_sequence(...), MAX(id))`로 시퀀스를 다시 맞출 것. 가능하면 애초에 id를 명시하지 않고 삽입하는 쪽이 낫다

## 12. work02-4 — 곡(Setlist) 팀별 조회/등록/수정 (2026-09-19)

- **날짜**: 2026-09-19
- **브랜치**: `feature/setlist-crud` (`develop`과 같은 커밋 `6822b05`에 있던 작업 브랜치를 `git branch -m`으로 개명. 분기 시점에 로컬 `develop`이 `origin/develop`과 동일함을 확인)
- **관련 PR**: work02-4, `feat: 곡(Setlist) 팀별 조회/등록/수정 API 구현` (푸시/PR 생성은 보류)

### 배경

work02 빌드 순서 4단계, PRD `F008`(팀별 곡 조회) / `F009`(곡 등록·수정). §11에서 만든 `ParseBigIntPipe`·응답 매퍼·Prisma 에러 매핑을 그대로 얹는 단계이고, 관리자 페이지의 "팀 선택 → 곡 패널" 흐름에서 **팀 다음으로 오는 실사용 API**다.

곡 **삭제**는 만들지 않았다 — PRD가 MVP 스코프에서 제외했고, 학기 단위 통째 갱신 전제라 오입력은 수정으로 대응한다.

### 구현 전 조사에서 드러난 것 (설계를 바꾼 사실들)

| 조사 항목 | 확인된 사실 | 설계에 미친 영향 |
| --- | --- | --- |
| 곡 정렬 기준 | `Setlist`에 순서 컬럼이 **없고**, 공개 프론트가 `.order("id", asc)`로 읽어 그대로 렌더링한다(`src/lib/fetch-line-up-and-setlist.ts`). 실데이터도 팀별 id가 완전히 연속(1~4=팀1 … 59~64=팀15) | 조회 정렬을 `id` asc로 고정. **새 곡은 항상 맨 뒤에 붙고 중간 삽입이 불가능**하다는 한계가 확정됨 |
| 공개 프론트의 중복 처리 | 두 페이지 모두 `title + artist`가 같은 뒤 행을 **조용히 버린다**. 비교 범위는 `tracksByTeamId[teamId]` 안, 즉 **팀 내부 한정**(`setlist/page.tsx:297`, `event-goods/page.tsx:143`) | 중복을 허용하면 "관리자엔 보이는데 사이트엔 안 나오는 곡"이 생긴다 → **409 거부**로 확정. 판정 범위도 팀 내부로 맞춤 |
| `singer` 실제 상태 | 컬럼은 nullable인데 **64행 전부 값이 있고** 공백·빈 문자열도 0건. 비면 공개 페이지가 `"SUMMIT Band"`로 대체 표시 | 등록 시 **필수**로 확정. 이 API로 NULL로 되돌리는 경로는 두지 않음 |
| `albumCoverUrl` / `youtubeUrl` 분포 | 앨범 커버는 **64/64 채워짐**, 유튜브는 **5건뿐**(59건 NULL) | 수정 시 초기화 여부 판단의 근거. 커버는 F010으로 다시 받으면 되지만 승인된 링크 5건은 복구 비용이 크다 → **유지** |
| 길이·공백 위생 | title 최대 24자 / singer 최대 21자, 앞뒤 공백·빈 문자열 0건, 같은 팀 내 중복 0건(전역으로 넓혀도 0건) | 상한 200/100이 **기존 64행을 전혀 막지 않음**을 실측으로 확인. 새 검증 규칙 때문에 기존 행의 PATCH가 실패하는 경우 없음 |
| `Setlist` 시퀀스 | `Setlist_id_seq` = 64, `max(id)` = 64 → 다음 65 (§11 마이그레이션 이후 정상) | 쓰기 검증 전 교정 불필요 |
| DB 제약 | `Setlist`의 unique 인덱스는 PK뿐. `(teamId, title, singer)` 제약 없음. `teamId`에 인덱스도 없음(64행이라 성능 무관) | 중복 방지를 DB가 해 주지 않으므로 **애플리케이션이 불변식을 소유**해야 함 → 아래 행 잠금 |
| `event-goods` 폴백 상한 | §11에서 기록한 `id >= 8 → day2`(상한 없음)가 **develop에 아직 미반영** | 쓰기 검증 게이트 발동 — 곡 생성 전에 노출 경로를 보고하고 승인받음 |

### 작업 내용

**1) 엔드포인트 3개** (`src/songs/`, 전부 인증 필요 — `@Public()` 미사용)

| 메서드 | 경로 | 동작 |
| --- | --- | --- |
| `GET` | `/teams/:teamId/songs` | 해당 팀의 곡을 `id` asc로 조회. 없는 팀은 404 |
| `POST` | `/teams/:teamId/songs` | `{ title, singer }`. 같은 팀에 같은 곡이 있으면 409 |
| `PATCH` | `/songs/:id` | `{ title?, singer? }` (최소 1개). 수정 후 값 기준 중복 검사 |

컨트롤러를 둘로 나눴다(`TeamSongsController` / `SongsController`). 조회·등록은 팀이 항상 정해져 있어 중첩이 자연스럽지만, 수정은 곡 id 하나로 이미 유일하게 지목되므로 중첩하면 `:teamId`와 실제 소속을 대조하는 분기만 늘어난다.

**2) 팀 행 잠금** — 등록·수정 트랜잭션의 **첫 단계**에서 대상 팀 행을 `SELECT id FROM "Line Up" WHERE id = $1 FOR NO KEY UPDATE`로 잠그고, 0행이면 404. 존재 확인만으로는 더블클릭(거의 동시 요청) 두 건이 중복 검사를 **함께 통과**한다.

**3) 중복 판정 규칙** — 같은 팀 안에서 `NFC 정규화 → trim → 소문자` 비교. `singer`가 NULL이면 빈 문자열로 취급한다. **비교에만 적용하고 저장값은 DTO의 trim까지만** 적용한다. 수정은 **수정 후 값** 기준이고 자기 자신은 제외하므로, 같은 값으로 다시 보내면 409가 아니라 200이다.

**4) 응답 계약 (`dto/song-response.ts`)** — §11과 같은 매퍼 방식. `albumCoverUrl`·`youtubeUrl`은 응답에만 싣고 입력 DTO에는 넣지 않았다(보내면 400).

**5) `mapForeignKeyViolation` 추가 (`src/common/prisma-error.ts`)** — `P2003` → 404.

### 기술 판단

| 쟁점 | 선택 | 이유 |
| --- | --- | --- |
| **경로 구조** | **조회·등록은 팀 하위 중첩, 수정은 평탄** (`/teams/:teamId/songs`, `/songs/:id`) | PRD 흐름이 "팀 선택 → 해당 팀 패널"이라 조회·등록 시 팀이 항상 정해져 있다. 중첩하면 `teamId`가 타입 수준에서 필수가 되고 본문에서 사라져 **곡의 팀을 옮기는 경로가 구조적으로 존재하지 않게 된다**. 수정까지 중첩하면 `:teamId`와 실제 소속이 어긋난 요청을 처리하는 분기가 생기는데, 곡 id만으로 이미 유일하게 지목되므로 순수한 비용이다 |
| **곡 정렬** | **`id` 오름차순** (순서 컬럼 추가 ✗) | 공개 프론트가 id 순으로 읽어 그대로 렌더링한다. 관리자 화면이 다른 순서를 보여주면 "관리자에서 본 순서"와 "방문자가 보는 순서"가 갈린다. 순서 컬럼 추가는 프로덕션 마이그레이션이고 이번 스코프 밖이라, **중간 삽입·재정렬 불가**를 한계로 명시하고 넘긴다 |
| **같은 팀 동일 곡** | **409 거부** (허용 ✗) | 허용하면 공개 프론트가 뒤 행을 조용히 버려 "관리자엔 있는데 사이트엔 없는 곡"이 된다. 게다가 순서 컬럼이 없어 동일한 두 행은 **애초에 구분할 방법이 없다**. 등록 버튼 더블클릭이 실제 위험이라 잠금까지 함께 넣었다 |
| **중복 비교 규칙** | **NFC + trim + 소문자**, 비교 전용 | 프론트는 대소문자를 구분하지만 API를 더 엄격하게 두는 쪽이 안전하다 — 관리자 화면에서 `Butterfly`와 `butterfly`는 구분되지 않는다. NFC를 거는 이유는 자모가 분리된 한글(macOS 복사 등)이 눈에 같아 보여도 코드 포인트가 달라 판정을 빠져나가기 때문이다. **저장값에는 적용하지 않는다** — 관리자가 입력한 표기를 API가 임의로 바꾸면 안 된다 |
| **동시 등록 방어** | **`FOR NO KEY UPDATE` 행 잠금** (DB unique 제약 ✗, 확인-후-삽입만 ✗) | "확인 후 삽입"은 트랜잭션 안에 있어도 **동시 요청을 막지 못한다** — Read Committed에서 두 트랜잭션이 서로의 미커밋 INSERT를 보지 못하기 때문이다. `(teamId, title, singer)` unique 제약은 대소문자·NFC 정규화까지 담으려면 표현식 인덱스가 필요하고 프로덕션 마이그레이션이 되므로 이번엔 하지 않았다. 팀 행을 잠그면 **같은 팀에 대한 쓰기가 직렬화**되어 뒤 요청이 앞 요청의 커밋 결과를 보고 409로 떨어진다 |
| **`FOR UPDATE`가 아닌 이유** | **`FOR NO KEY UPDATE`** | 이 잠금의 목적은 팀 행의 **삭제·키 변경을 막는 것**이지 팀 정보 수정을 막는 것이 아니다. `FOR UPDATE`를 쓰면 같은 팀의 팀명을 바꾸는 `PATCH /teams/:id`와 불필요하게 경합한다 |
| **수정 시 `albumCoverUrl`/`youtubeUrl`** | **유지** (초기화 ✗) | 이 엔드포인트는 "오타 교정"과 "다른 곡으로 교체"를 구분할 수 없는데 두 경우의 비용이 비대칭이다. 앨범 커버는 F010으로 즉시·무료로 다시 받을 수 있지만, 승인된 유튜브 링크는 **사람 검토 + 일일 100회 quota**가 든 자산이고 현재 64곡 중 5건뿐이다. 오래된 커버는 눈에 보이는 경미한 오류, 잃어버린 링크는 **보이지 않는 손실**이다. 교체 의도일 때의 재매칭은 F010/F013에서 명시적 동작으로 처리한다 |
| **없는 팀의 GET** | **404** (빈 배열 ✗) | 곡 0건인 팀이 **정상 상태**다(팀 등록 직후는 항상 0건). 빈 배열로 합치면 관리자 UI가 "잘못된 팀 id"와 "아직 곡 없음"을 구분할 수 없다 |
| **`singer` 필수 여부** | **등록 시 필수**, 수정 시 optional(보냈다면 비울 수 없음) | 실제 64행이 전부 채워져 있고, 비면 공개 페이지가 `"SUMMIT Band"`로 **잘못된 정보를 노출**한다. F010도 제목+가수를 함께 쓴다. 대신 이 API로는 `singer`를 NULL로 되돌릴 수 없다(의도된 한계) |
| **길이 상한** | title 200 / singer 100 | DB가 `text`라 무제한이다. 실제 최댓값(24/21)보다 크게 잡아 **기존 64행이 전부 통과**하면서도 비정상적으로 긴 본문은 DB에 닿기 전에 막는다 |
| **BigInt 매퍼** | **§11 방식 반복** (공용 헬퍼 추출 ✗) | 공유되는 로직이 `id.toString()` 한 줄뿐이라 헬퍼를 빼도 모델별 매퍼는 그대로 남는다 — 간접 계층만 는다. §11이 6단계로 이월한 것은 **인터셉터 재판단**이고, 매퍼가 2개가 된 지금은 아직 그 시점이 아니다 |
| **Prisma 에러 매핑** | `P2002` → 409, `P2003` → 404, `P2025` → 404 | 도달 경로 기준으로 판단했다 — 아래 트러블슈팅 2번 참조 |

### 검증

**단위 테스트 133개** (`npm test`, 이전 78개 + 이번 55개). §11과 같이 `PrismaService`만 대역으로 두되 작은 인메모리 저장소로 동작까지 흉내 냈고, 행 잠금용 `$queryRaw`는 태그드 템플릿 형태로 mock했다.

- `findAllByTeam`: `id` asc 정렬 인자 / 곡 0건 팀은 빈 배열 / 없는 팀은 404(조회조차 하지 않음) / id·teamId 문자열화 / JSON 직렬화
- `create`: 정상 등록 / 없는 팀 404(`create` 미호출) / 완전 동일·대소문자·NFD 중복 409 / 다른 팀의 같은 곡은 허용 / 같은 팀이라도 가수가 다르면 허용 / **잠금이 중복 검사보다 먼저 호출됨**(`invocationCallOrder` 비교) / 쿼리에 `FOR NO KEY UPDATE`와 `"Line Up"`이 포함됨 / `P2002` → 409 / `P2003` → 404 / 트랜잭션 1회
- `update`: 제목만 수정 시 가수 불변 / **앨범 커버·유튜브 링크 보존** / `data`에 `teamId` 없음 / 같은 값 재전송은 200 / 대소문자만 바꾸기 200(자기 자신 제외) / 다른 곡과 겹치면 409 / **부분 수정도 수정 후 값 기준** / `teamId`가 NULL이면 중복 검사 건너뜀 / 404 / 빈 본문 400(트랜잭션 미개시) / `P2025` → 404
- 컨트롤러: **두 클래스와 세 핸들러에 `isPublic` 메타데이터 없음**, 경로·메서드 메타데이터, BigInt 파라미터 위임
- DTO: 전역 파이프와 **동일한 옵션**으로 재현해 trim, 빈 문자열 거부, 상한 200/101 경계, `teamId`/`albumCoverUrl`/`youtubeUrl` 주입 거부

**런타임 검증 101개 체크, 실패 0** (`node dist/main.js`, 포트 3002 — §11과 같은 이유로 3001과 분리).

| 구간 | 내용 | 결과 |
| --- | --- | --- |
| A1 | 3개 엔드포인트 × (토큰 없음 / 위조 서명 / 만료 / Bearer 아님) | 전부 `401 인증이 필요합니다.` |
| A1 | `GET /health` | `200` — 공개 유지 (회귀 없음) |
| A2 | POST DTO 거부 13종(누락·공백·타입·상한·필드 주입) | 전부 `400` |
| A3 | PATCH DTO 거부 7종(빈 본문·`teamId`·`albumCoverUrl`·`youtubeUrl` 등) | 전부 `400` |
| A4 | `:teamId`/`:id` 파싱(`abc`/`0`/`-1`/`1.5`/int8 초과) | 전부 `400` |
| A5 | 없는 팀 GET·POST, 없는 곡 PATCH | `404` ×3 |
| A6 | 거부 구간 직후 스냅샷 | **diff 0** |
| A7 | 실제 팀 **15개 전부** GET → 직접 SQL 결과와 필드 단위 비교 | 전부 일치, 곡 수 합계 **64**, 스냅샷 **diff 0** |
| B1 | 임시 팀 생성, 곡 0건 팀의 빈 배열, 없는 팀 404와의 구분, 거부 3종 | 기대값 일치, `Setlist` **64행 유지** |
| B2 | 등록 / 완전 동일·대소문자·공백·NFD 중복 409 / 제목 다르면 등록 | 전부 기대값 일치 |
| B2 | **동일 payload 동시 요청 2건** (`Promise.all`) | `201` 1건 + `409` 1건, **곡 1행만 생성** |
| B2 | 조회 정렬, 앨범/유튜브 보존, 같은 값 200, 충돌 409, 부분 수정 409, 대소문자 변경 200 | 전부 기대값 일치 |
| C | 임시 행 삭제 후 복구 | `Line Up` **15행** / `Setlist` **64행** / `teamId` 매칭 **64/64** / 스냅샷 **diff 0** / `day98`·`__verify__` 잔존 **0** |

**프로덕션 데이터 보호 절차** (별도 테스트 DB가 없어 프로덕션에 직접 검증했다)

- **쓰기가 없는 A 구간을 전부 먼저** 실행하고 스냅샷 diff 0을 확인한 뒤 쓰기로 넘어갔다. 실제 팀 15개에 대해서는 **GET만** 수행했고 곡 64행은 한 건도 수정하지 않았다
- **§11과 달라진 점**: 이번엔 임시 팀에 곡을 만들어야 해서 `/event-goods`의 "곡 0건" 필터를 통과한다. 곡 생성 직전에 멈추고 노출 경로를 코드 근거와 함께 보고한 뒤 승인을 받았다 (아래 "검증 게이트" 참조)
- 곡이 필요 없는 검증(B1)을 먼저 끝내고, **곡을 만드는 구간(B2)은 스크립트 한 번에 몰아서** 실행했다. 임시 곡은 3건만 사용
- 앨범 커버·유튜브 보존 검증에 값이 필요해서 **이번 실행에서 만든 임시 행에만** SQL로 값을 심었다. 실제 곡에는 쓰지 않았다
- 정리는 `try/finally`. 삭제 순서는 `Setlist` → `Line Up`(FK가 `NoAction`), 삭제 조건은 **이번 실행에서 생성한 id 목록 AND `team_name='__verify__'` AND `day='day98'`**. 추적하지 못한 잔존 행이 없는지 삭제 후 별도로 확인(0건)
- 스냅샷은 레포 바깥(세션 스크래치패드)에 저장했다
- **시퀀스는 되돌리지 않았다.** 소모된 id는 `Line Up` **20번 1개**, `Setlist` **65~67번 3개**다. 되감으면 향후 id 재사용 위험이 생긴다

**검증 게이트 — `__verify__` 팀의 실제 노출 경로**

곡을 만들기 전에 아래를 코드 근거로 보고하고 승인을 받았다.

- `event-goods/page.tsx:35-38` — `day='day98'`은 어떤 리터럴과도 일치하지 않아 id 폴백으로 내려가고, 임시 팀 id가 20이므로 `id >= 8` → **2일차로 분류**된다
- `event-goods/page.tsx:72` — `image_src`가 NULL이라 `getImageFallbackPath(20)`이 **`/day1-team1.png`(8C8 사진)** 을 돌려준다
- `event-goods-view.tsx:19` — `tracks.length > 0`인 팀만 렌더링하므로, **곡을 만드는 순간 이 필터를 통과**한다
- 두 페이지 모두 `revalidate`/`dynamic` 선언이 없고 `supabase.ts:17`이 `cache: "no-store"`라 **매 요청 실시간 조회**다 → 배포본에 그대로 반영된다
- `setlist/page.tsx:147-150`은 `id <= 14` 상한이 있어 `null` → **`/setlist`에는 노출되지 않는다**
- `card-carousel.tsx:215`는 `image_src`가 비면 제외 → **홈 캐러셀에도 노출되지 않는다**

**실측 노출 창**: 첫 곡 생성 `13:55:33.152Z` → 마지막 곡 삭제 `13:55:33.764Z`, **0.6초**. (곡이 0건인 임시 팀 자체는 `13:54:27Z`~`13:55:33Z` 약 66초간 존재했지만, 위 필터 때문에 화면에는 나오지 않고 서버→클라이언트 페이로드에만 포함된다 — §11이 확인한 것과 같은 상태다.)

**회귀 없음** — 루트 `npm run build`(Next.js 프로덕션 빌드) / `npm run lint`, `apps/api` `npm run build` / `npm run lint` / `npm test` 모두 정상.

**엔드투엔드 로그인은 이번에도 미수행** — 관리자 비밀번호를 주고받지 않는다는 원칙에 따라 `JWT_SECRET`으로 로컬에서 직접 서명한 토큰을 사용했다(§10·§11과 동일).

### 트러블슈팅 기록

**1) "확인 후 삽입"만으로는 더블클릭을 막지 못한다**

초안 설계에서는 등록 트랜잭션을 `팀 존재 확인 → 중복 검사 → INSERT`로 잡고, 남는 레이스는 "관리자 1인 전제라 수용"하기로 했다. 이 판단이 느슨했다. 등록 버튼 더블클릭은 **관리자가 한 명이어도 발생하는 거의 동시 요청**이고, Read Committed에서 두 트랜잭션은 서로의 미커밋 INSERT를 보지 못하므로 중복 검사를 **나란히 통과**한다. `(teamId, title, singer)`에 unique 제약이 없으니 DB가 잡아 주지도 않는다.

교정: 트랜잭션 첫 단계를 **팀 행 잠금**으로 바꿨다.

```sql
SELECT id FROM "Line Up" WHERE id = $1 FOR NO KEY UPDATE
```

같은 팀에 대한 등록·수정이 이 지점에서 직렬화되므로, 뒤 요청은 앞 요청이 커밋한 곡을 보고 409로 떨어진다. 런타임 검증에서 동일 payload를 `Promise.all`로 동시에 보내 **201 1건 + 409 1건, 실제 생성 1행**을 확인했다.

수정(`PATCH`)에도 같은 잠금을 걸었다. 등록만 잠그면 "수정과 등록이 동시에 일어나는 경우"가 그대로 열려 있어 불변식이 반쪽이 된다.

**2) `P2003`의 도달 경로를 잠금 도입 후 다시 판단함**

설계 단계에서는 `P2003`(FK 위반)을 "등록의 존재 확인과 INSERT 사이에 팀이 외부에서 삭제되면 발생"하는 **도달 가능한 경로**로 봤다. 행 잠금을 넣은 뒤에는 그렇지 않다 — 팀 행이 잠겨 있어 동시 `DELETE`는 우리 트랜잭션이 끝날 때까지 대기하고, 이미 삭제된 뒤라면 잠금 쿼리가 0행을 돌려줘 그 시점에 404가 된다.

그래도 **매핑은 방어용으로 남겼다.** §11에서 "`P2002`는 도달 불가"라고 단정했다가 런타임에서 실제로 터진 선례가 있기 때문이다. "제약을 확인했다"와 "위반될 경로가 없다"는 같은 말이 아니다. 판단을 코드 주석과 이 문서에 **"도달 불가라고 판단하지만 방어용으로 유지"** 로 적어 두는 쪽이, 매핑을 지웠다가 500으로 새는 것보다 낫다.

**3) 409로 거부된 등록은 `nextval`을 소비하지 않는다 (직접 확인)**

§11에서는 "INSERT 이전에 거부되는 409는 시퀀스를 소비하지 않는다"를 **정황 일치**로만 적었다(직전 값을 측정해 두지 않았다). 이번에는 쓰기 전후 시퀀스를 모두 측정했다.

| 시점 | `Setlist_id_seq` |
| --- | --- |
| B2 시작 전 | 64 |
| B2 종료 후 | **67** |

등록 요청은 9건이었고 그중 성공은 3건이다. 시퀀스가 정확히 3만큼 전진했으므로 **거부된 6건은 `nextval`을 소비하지 않았다**. 중복 검사가 INSERT보다 앞에 있기 때문이며, 이번엔 직접 확인한 결과다.

**4) 검증 스크립트의 `.env` 파싱 실수**

검증 스크립트에서 `.env`를 직접 정규식으로 파싱했는데, 이 저장소의 값은 **큰따옴표로 감싸져 있어** 따옴표째 접속 문자열로 들어갔다(`getaddrinfo ENOTFOUND base`). 자체 파서를 버리고 `node --env-file=<apps/api>/.env`로 교체했다. 검증 도구 쪽 실수라 API 코드에는 영향이 없지만, **"환경 변수를 직접 파싱하지 말 것"** 은 6~7단계 스크립트에도 그대로 적용된다.

### 이 단계에서 의도적으로 하지 않은 것

- **곡 삭제 API** — PRD MVP 제외. 학기 단위 통째 갱신 전제이고 오입력은 수정으로 대응한다(팀 삭제를 만들지 않은 것과 같은 이유). 다만 "다른 곡으로 교체"가 수정으로만 가능해진다는 점은 위 `albumCoverUrl` 유지 판단과 함께 봐야 한다
- **곡 순서 변경 / 중간 삽입** — `Setlist`에 순서 컬럼이 없고 추가하려면 프로덕션 마이그레이션이 필요하다. 공개 프론트가 `id` asc로 읽는 이상 **새 곡은 항상 맨 뒤**다. 실제로 순서를 바꿔야 하는 요구가 생기면 그때 컬럼을 추가한다(아래 이월 항목)
- **곡의 팀 이동(`teamId` 수정)** — 경로가 소속을 정하고 DTO에 `teamId`가 없어 **구조적으로 불가능**하다. 보내면 `forbidNonWhitelisted`가 400
- **곡 일괄 등록(벌크)** — 지금 필요한 곳이 없다. work03 콘텐츠 마이그레이션에서 대량 삽입이 필요해지면 그때 만들되, **id를 명시하지 않고 삽입**해야 §11 트러블슈팅 1번(시퀀스 뒤처짐)이 재발하지 않는다
- **앨범 커버 자동 매칭(F010)** — 같은 4단계 범위였지만 이번 작업에서 분리했다. `albumCoverUrl`은 **읽기 전용 응답**에만 포함하고 입력 DTO에는 넣지 않았다(보내면 400). iTunes Search API 연동은 분당 rate limit과 매칭 실패 처리 설계가 따로 필요하다
- **유튜브 배치 검색·리뷰(F011~F013)** — 6단계. `youtubeUrl`도 읽기 전용 응답만
- **`Setlist.youtubeReviewStatus` 컬럼 추가** — 6단계로 이월(§10 갱신). 컬럼만 먼저 만들면 **아무도 읽지 않는 상태 값이 프로덕션 스키마에 남는다**. 기능과 함께 추가한다
- **`(teamId, title, singer)` DB unique 제약** — 대소문자·NFC 정규화까지 담으려면 표현식 인덱스가 필요하고 프로덕션 마이그레이션이 된다. 불변식은 행 잠금 + 애플리케이션 검사로 보장한다
- **`Setlist.teamId` 인덱스** — 64행이라 의미가 없다. work03에서 행이 크게 늘면 재검토
- **카드뉴스 업로드(F007) / throttler / CORS** — §10·§11의 판단 유지. 5단계와 7단계 항목이다
- **`/event-goods` id 범위 폴백 수정** — 프론트 스코프. 이번 브랜치에서 건드리지 않기로 명시적으로 합의했고, §10 "7단계 배포 전 확인 항목"에 기록된 상태를 유지한다

### 남겨둔 결정 (5단계 이후로 이월)

- **곡 순서 컬럼** — 지금은 `id` asc가 곧 공연 순서다. 중간 삽입이나 순서 교체가 필요해지는 시점에 `Setlist`에도 `performanceOrder`를 추가하고, **공개 프론트의 정렬도 함께** 바꿔야 한다(`src/lib/fetch-line-up-and-setlist.ts`의 `.order("id")`). 한쪽만 바꾸면 관리자와 방문자가 다른 순서를 본다
- **남는 레이스** — 팀 행 잠금으로 **같은 팀에 대한 등록·수정 경합은 닫혔다.** 남은 것은 서로 다른 팀에 대한 동시 쓰기인데, 중복 판정 범위가 팀 내부라 애초에 경합 대상이 아니다. 관리자가 여러 명이 되어도 이 구조는 유지되지만, 잠금이 늘어나면 대기 시간이 문제가 될 수 있어 그 시점에 표현식 unique 인덱스로 옮기는 쪽을 재검토한다
- **BigInt 매퍼의 반복 비용** — §11에서 이월한 항목 유지. 이번에 매퍼가 2개가 됐고, 6단계쯤 인터셉터 방식을 다시 판단한다
- **`singer`를 비우는 경로** — 현재 API로는 NULL로 되돌릴 수 없다. 실제로 가수를 모르는 곡이 들어오면 그때 정책을 정한다(빈 값 허용 vs `"미상"` 같은 규약)
- **`day` 문자열 정렬** — §11에서 이월한 항목 그대로

## 부록: 원본 리포트 참조

- `lighthouse-before-home-0831.html` / `.json`
- `lighthouse-before-setlist-0831.html` / `.json`
- `lighthouse-before-event-0831.html` / `.json`
