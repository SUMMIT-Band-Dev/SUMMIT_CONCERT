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
- **팀/곡/유튜브 CRUD 라우트** — 3~6단계. 이번 Guard를 그대로 재사용하면 된다
- **`Setlist.youtubeReviewStatus` 컬럼** — §9에 이어 계속 보류(4단계)

### 완료 상태 및 다음 단계

- 브랜치 `feature/auth-jwt-login` (`develop`에서 분기)
- **다음**: work02 빌드 순서 3단계 — Team CRUD(PRD F003~F006). 시작 시점에 BigInt 직렬화 방식을 전역 정책으로 확정해야 한다

## 부록: 원본 리포트 참조

- `lighthouse-before-home-0831.html` / `.json`
- `lighthouse-before-setlist-0831.html` / `.json`
- `lighthouse-before-event-0831.html` / `.json`
