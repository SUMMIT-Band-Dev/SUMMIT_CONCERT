# CLAUDE.md

이 파일은 이 저장소에서 Claude Code (claude.ai/code)를 사용할 때 필요한 가이드를 제공합니다.

## 언어 커뮤니케이션 규칙

- **기본 응답**: 한국어
- **코드 주석**: 한국어
- **커밋 메시지**: 한국어
- **문서화**: 한국어
- **변수명/함수명**: 영어 (코드 표준 준수)

## 프로젝트 개요

**summit_concert**는 SUMMIT 공연 시리즈를 위한 Next.js 랜딩 페이지입니다. 행사 일정, 세트리스트, 티켓팅 정보, 장소 상세 정보를 표시합니다. 주요 사용자는 2026년 상반기 성능, 이미지 로딩, 스크롤 반응성에 대한 피드백을 제공한 클럽 회원들입니다.

**배포**: Vercel | **데이터베이스**: Supabase

**포지셔닝 원칙**: 프론트엔드가 메인이고, 백엔드(Nest.js/어드민)는 필요에 의한 확장입니다. 포트폴리오/서류상 서사도 이 축을 유지합니다.

---

## 작업 로드맵

작업 단위(workNN)로 진행합니다. **해당 work 작업을 시작하기 전에 아래 표의 경로에 있는 문서를 먼저 읽으세요** — 지금 하는 작업과 무관한 work 문서까지 매번 읽을 필요는 없습니다. 종료된 work 문서는 `.claude/rules/history/`에 보관합니다.

| 단계   | 작업                                                       | 상태                                                                                   | 상세 문서                                       |
| ------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------- |
| work05 | 공연 콘텐츠 관리 확장 + 유튜브 연결 관리 단순화 (어드민)  | **진행 중 (2026-10-15 착수)** — PRD: `.claude/docs/prd-construction.md` · 구현 명세: `.claude/docs/work05-implementation.md` | `.claude/rules/work-05-construction.md`         |
| work01 | 리팩토링 (웹 성능 지표 개선)                               | 우선순위 1~4 완료, 5~7(정리 작업 · `@vercel/analytics` · 라우트 리네이밍) 잔여         | `.claude/rules/history/work-01-refactoring.md`  |
| work04 | 어드민 페이지 기능 수정                                    | 종료 — 범위를 work05로 이관                                                            | `.claude/rules/history/work-04-admin.md`        |
| work03 | 데이터 업데이트 + 어드민 페이지                            | 종료 — B(어드민)는 work02와 함께 구축 완료, A(데이터 업데이트)는 폐기                 | `.claude/rules/history/work-03-update.md`       |
| work02 | Nest.js 백엔드 (로그인 + 팀/곡 CRUD 어드민)                | 종료 — 배포 완료. 이전 어드민 PRD: `.claude/docs/prd-admin.md`                         | `.claude/rules/history/work-02-nest.js.md`      |

**이력 요약**: 2026-09-19에 Setlist/Line Up 스키마를 FK 구조로 정규화하고 RLS를 활성화한 뒤(`REFACTOR_NOTES.md` §8) work02(백엔드)를 착수해 배포까지 완료함. 이후 어드민 기능 수정을 work04로 신설했으나, 2026-10-15 공연 콘텐츠 전체 관리 + 유튜브 관리 단순화로 범위를 넓혀 work05로 새로 시작함.

다음 두 문서는 작업 종류와 무관하게 항상 적용되는 공통 규칙이므로 항상 로드합니다:

```
@.claude/rules/code-style.md
@.claude/rules/git-rules.md
```

> `frontend/`, `backend/` 하위 규칙 폴더는 기술 스택 정리 후 별도로 작성 예정 (현재는 비어있음/무시)

---

## Claude–Codex 협업 흐름 (work05부터)

**설계·리뷰는 Claude Code(터미널), 구현은 Codex(패널)**가 맡는다. Codex의 규칙은 루트 `AGENTS.md`에 있으며, 이 섹션과 같은 흐름을 Codex 관점으로 적어 두었다. 흐름을 바꿀 때는 두 파일을 함께 고친다.

### 한 작업 단위(Tn)의 흐름 — 항상 직렬로 진행

1. **Claude — 명세 작성·수정 → 커밋**: 명세(`.claude/docs/work05-implementation.md`)를 고치면 `docs/*` 브랜치에서 커밋 → PR → `develop` 머지까지 끝낸 뒤 Codex에 넘긴다. Codex는 `develop`에서 분기하므로 머지되지 않은 명세는 Codex에 보이지 않는다
2. **Codex — 구현 → 커밋**: 명세의 작업 단위 순서대로, 명세에 적힌 `feature/*` 브랜치에서 구현한다. 커밋은 사용자 확인 후 `source-command-git-commit` 규칙대로 한다. 커밋하고 나면 **멈추고 리뷰를 기다린다** (push·PR은 아직 안 함)
3. **Claude — 리뷰**: 아래 "리뷰 절차"대로 `code-reviewer` 에이전트로 리뷰한다
   - 문제가 없으면 → 4로
   - 구현이 명세와 어긋나면 → "Codex 전달용 수정 요청"을 작성하고, 사용자가 Codex에 전달한다. Codex는 같은 브랜치에 **추가 커밋**으로 고치고(amend·force push 금지), 다시 3으로
   - 명세 자체가 틀렸으면 → Claude가 명세를 고친다. 이때는 **현재 feature 브랜치에 별도 `📝 docs` 커밋**으로 넣어 구현과 같은 PR로 묶는다. 그다음 수정 요청을 Codex에 전달한다
4. **push·PR → 머지**: 리뷰를 통과하면 사용자가 `git:push`(Claude) 또는 `source-command-git-push`(Codex)로 PR을 연다. 머지는 사용자가 직접 한다
5. 머지가 끝난 뒤에 다음 작업 단위로 넘어간다. **이전 PR이 머지되기 전에 다음 Tn을 시작하지 않는다**

### 같은 작업 폴더를 공유하므로 지킬 것

- Claude와 Codex는 같은 체크아웃을 쓴다. **Codex가 작업 중일 때 Claude는 파일 수정·브랜치 전환·커밋을 하지 않는다** (읽기 전용 확인만 한다)
- Claude가 명세를 고치거나 커밋할 때는 Codex가 멈춰 있는 상태(커밋 후 리뷰 대기, 또는 작업 단위 사이)여야 한다
- 브랜치 전환 전에는 `git status`로 미커밋 변경이 없는지 확인한다. 다른 쪽이 남긴 변경이 보이면 손대지 말고 사용자에게 알린다

### 리뷰 절차 (Claude)

1. 대상 범위 확인: `git log --oneline develop..HEAD`, `git diff --stat develop...HEAD`
2. diff 전문을 스크래치패드에 저장한다 (`git diff develop...HEAD > <스크래치패드>/review-Tn.diff`). `code-reviewer`는 읽기 전용 도구(Read·Grep·Glob)만 있어 git을 직접 실행하지 못하기 때문이다
3. `code-reviewer` 에이전트에 넘길 것: 작업 단위 번호(Tn), diff 파일 경로, 변경 파일 목록, 해당 Tn의 범위·완료 기준이 있는 명세 위치
4. 에이전트 결과를 Claude가 직접 검증한다. 실제 코드를 확인해 사실인 항목만 남긴다. 완료 기준 중 실행이 필요한 것(build·lint·test)은 Codex 보고의 출력을 확인하고, 의심스러우면 Claude가 직접 실행한다. **API의 메서드·헤더가 바뀌었다면 CORS 설정(`apps/api/src/common/cors.ts`)과 어드민 호출이 맞는지 직접 확인한다** — supertest 같은 서버 단위 테스트는 브라우저의 preflight를 거치지 않아 통과해도 화면에서는 막힐 수 있다 (T1에서 `DELETE` 누락으로 발생, T1.1). 브라우저로 확인하지 못한 항목은 통과로 보고하지 말고 "사용자 수동 확인 필요"로 따로 적는다
5. 결과를 사용자에게 보고한다: 통과 여부, 명세 불일치, 버그, 그리고 수정이 필요하면 "Codex 전달용 수정 요청"

### "Codex 전달용 수정 요청" 형식

사용자가 Codex 패널에 그대로 붙여넣을 수 있게, 하나의 코드 블록으로 작성한다.

```
[work05 Tn 리뷰 수정 요청]
기준: .claude/docs/work05-implementation.md (Dn / Tn 완료 기준)
1. <파일:줄> — <문제> → <명세가 요구하는 것>
2. ...
수정 후: 같은 브랜치에 추가 커밋(amend 금지), 완료 기준 재검증 출력 첨부, 커밋 후 멈춤
```

---

## 개발 커맨드

```bash
npm run dev    # 개발 서버 시작 (http://localhost:3000, 핫 리로드)
npm run build  # 프로덕션 빌드 (TS, ESLint 검증)
npm start      # 로컬에서 프로덕션 빌드 실행
npm run lint   # ESLint 검사
```

**경로 별칭**: `@/*` → `src/*`

> 위 커맨드는 루트(공개 사이트) 기준. 관리자 프론트는 `apps/admin`에서 `npm run dev`(포트 3010), 백엔드는 `apps/api`에서 `npm run start:dev`로 각각 실행 (각 앱은 독립 `package.json`).

## 환경설정

`.env.local` 파일 생성:

```
NEXT_PUBLIC_SUPABASE_URL=<프로젝트-URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<익명-키>
```

이 값들은 브라우저에 노출되므로 (Supabase 클라이언트 인증 필수), 여기에 시크릿/서비스 롤 키를 절대 사용하지 마세요.

## 기술 스택

- **프레임워크**: Next.js 16.2.4 (App Router, 기본 Server Components)
- **UI**: React 19.2.4 + Tailwind CSS 4
- **언어**: TypeScript 5 (strict mode)
- **애니메이션**: framer-motion 12.38.0
- **데이터베이스**: Supabase 클라이언트 (`@supabase/supabase-js` 2.108.1)
- **린팅**: ESLint v9 (Next.js + TypeScript 설정)
- **빌드**: React Compiler 플러그인 활성화

⚠️ **중요**: Next.js 16은 API와 컨벤션의 주요 변경사항이 있습니다. 코드 작성 전에 `node_modules/next/dist/docs/` 또는 [v16 릴리스 노트](https://github.com/vercel/next.js/releases)를 확인하세요.

**관리자 앱 (모노레포 `apps/`)**

- **`apps/admin`**: 관리자 프론트 — Next.js 16.3.5, TanStack Query 5, shadcn/ui, React Hook Form + Zod (별도 Vercel 프로젝트)
- **`apps/api`**: 관리자 API — NestJS 12 + Prisma 7, Supabase Postgres 직접 연결, JWT 인증, Supabase Storage 이미지 업로드
- 구성 결정과 근거는 `REFACTOR_NOTES.md` §9 이후, 기능 명세는 `.claude/docs/prd-admin.md`(기존) · `.claude/docs/prd-construction.md`(work05) 참조

## 아키텍처

### 폴더 구조

```
src/
  app/                    # App Router (기본 Server Components)
    page.tsx              # 홈페이지
    setlist/page.tsx      # 세트리스트 (work01-4에서 Server/Client 분할 완료)
    event-goods/page.tsx  # 세트리스트 상세 (work01-4에서 Server/Client 분할 완료)
    location/page.tsx     # 장소 정보 (권장 패턴: Server + Client)
    [other routes]/       # time-table, ticket-info, notice 등
    layout.tsx
    globals.css
  components/
    layout/               # site-header, site-footer (footer가 좋은 패턴)
    sections/             # Setlist, facility, channel 섹션
    ui/                   # card-carousel, setlist-detail-modal
    common/               # naver-map, fade-in-up (애니메이션)
  lib/
    supabase.ts           # 커스텀 캐시 헤더로 클라이언트 초기화
  types/
    setlist.ts            # 데이터 타입 정의
apps/
  admin/                  # 관리자 프론트 (Next.js)
  api/                    # 관리자 API (NestJS + Prisma)
```

### 주요 패턴 & 이슈

**1. Server/Client 분할** (`location/page.tsx` 참고)

- **문제(해결됨)**: `setlist/page.tsx`와 `event-goods/page.tsx`가 전부 `"use client"` + `useEffect` 데이터 페칭이라 SSR 이점 상실
- **해결**: 데이터 페칭을 Server Component로 이동하고, Client Component(`components/sections/*-view.tsx`)에 props로 데이터 전달 (work01-4, `PERFORMANCE_LOG.md` 2026-09-13 항목)
- 새 페이지·work05 콘텐츠 조회도 이 패턴을 따른다
- 상세는 `.claude/rules/history/work-01-refactoring.md` 참조

**2. 이미지 최적화** (성능 병목)

- **이슈**: `/event-goods`에서 Apple Music CDN에서 **600×600px** 크기(각 60–190KB)로 18개 앨범 커버 요청하지만, 실제 화면 표시는 40–60px 썸네일 크기로 표시됨 → LCP 9.8s
- **이슈**: `public/day{1,2}-team*.png` (14개 파일, 각 85–94KB)는 `next/image` 없이 원본 그대로 제공
- **해결**: iTunes/Apple Music API의 작은 크기(`100x100bb.jpg`) 사용 또는 Next.js Image 컴포넌트 최적화 활용
- **참고**: `next.config.ts`의 `remotePatterns`에서 이미 `mzstatic.com`, Supabase CDN 허용 중

**3. Supabase 페치 동작**

- `lib/supabase.ts`는 `cache-control: no-cache, no-store` 헤더로 fetch 요청 래핑
- 오래된 캐시 데이터 방지하지만 반복 요청 시 지연 증가
- 의도된 설계 결정이므로, 필요 시 파일 내 주석 확인

**4. React Compiler (실험적 기능)**

- `next.config.ts`에서 `reactCompiler: true`로 활성화됨
- 엣지 케이스: 클로저 캡처, ref 변경이 예상과 다르게 작동할 수 있음
- 문제 발생 시 [React Compiler 공식 문서](https://react.dev/learn/react-compiler) 확인

**5. 스크롤 끊김** ("스크롤이 끊긴다")

- CLS(누적 레이아웃 이동) 이슈는 아님 (Lighthouse 모든 페이지에서 0 기록)
- 가능 원인: 이미지 디코딩이 메인 스레드 차단 또는 스크롤 중 `FadeInUp` (framer-motion) 애니메이션 실행
- 디버깅 방법: DevTools Performance 탭으로 스크롤 기록 후 long task 및 image decode 시간 확인

## 알려진 이슈 (REFACTOR_NOTES.md 기준)

| 이슈                        | 원인                                                    | 우선순위 | 상태                    |
| --------------------------- | ------------------------------------------------------- | -------- | ----------------------- |
| `/event-goods` LCP 9.8s     | 600×600px 앨범 커버 18개 (원본 크기)                    | 1        | 개선됨 (112×112 리사이징, `PERFORMANCE_LOG.md`) |
| 홈/세트리스트 LCP 4–5s      | `public` 폴더의 이미지가 `next/image`로 최적화되지 않음 | 2        | 진단됨                  |
| 로드 중 스크롤 끊김         | 이미지 디코딩 또는 메인 스레드 JS 실행                  | 3        | DevTools 성능 기록 필요 |
| 큰 클라이언트 컴포넌트      | `setlist/` & `event-goods/`는 654 & 539줄로 과도하게 큼 | 4        | 해결됨 (work01-4 Server/Client 분할) |
| 공연 정보 하드코딩          | 포스터·장소·날짜·티켓·유의사항·예매 링크가 코드에 고정, 주소 불일치 발생 | -        | work05에서 DB 관리로 전환 예정 |
| 중복 파일                   | `lib/src/lib/supabase.ts` (삭제 필요)                   | 5        | 정리 작업               |
| 저장소의 `dist/` 폴더       | 빌드 산물이 커밋됨; 저장소 크기 비대화                  | 5        | 정리 작업               |
| Supabase Free Tier 일시중지 | 비활성 기간 경과 시 데이터 접근 중단                    | 4        | 운영 위험 요소          |
| 분석 기능 미설치            | Vercel Analytics가 설치되지 않음                        | 4        | H2 공연 시즌에 필요     |

**Lighthouse 성능 기준선** (모바일, navigation, incognito, 2026-08-30):

- 홈: 78 성능 점수, 4.4s LCP
- 세트리스트: 79 성능 점수, 4.8s LCP
- 이벤트 상품: 71 성능 점수, 9.8s LCP

이전/이후 비교 보고서는 `lighthouse-before-{home,setlist,event}-*.{html,json}` 파일에 저장됨.

## Vercel 배포

- **도메인**: summit-concert.live
- **빌드 커맨드**: `npm run build`
- **시작 커맨드**: `npm start`
- **환경 변수**: Vercel 대시보드에서 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 설정

## 빠른 문제 해결 가이드

**TypeScript 에러 발생**:

- `npm run build`는 strict mode 문제를 감지합니다
- `npm run lint`는 별도로 실행하면 됩니다

**사이트가 느려 보일 때**:

1. `npm run build && npm start`로 프로덕션 환경 프로파일링
2. DevTools Lighthouse 실행 (Mobile, Navigation, incognito 모드)
3. REFACTOR_NOTES.md의 기준선과 비교하고, Network 탭에서 이미지 크기 확인

**Supabase가 데이터를 반환하지 않을 때**:

- Supabase 대시보드 확인
- Free tier는 비활성 기간 후 자동으로 일시중지됨
- Projects → Settings → Pause Project 섹션에서 재개 가능

**스크롤이 끊기거나 버벅거릴 때**:

- DevTools Performance 탭에서 스크롤 중 성능 기록
- long task(장기 작업) 및 image decode(이미지 디코딩) 시간 확인

## 관련 파일

- **AGENTS.md**: Next.js v16의 주요 변경사항 경고 (코드 작성 전 필독)
- **REFACTOR_NOTES.md**: Lighthouse 데이터를 포함한 전체 성능 진단 및 다음 단계 (우선순위별 로드맵)
- **REFACTOR_HYPOTHESIS_LOG.md**: 최초 가설(public 폴더 문제)이 실제 진단 결과(외부 CDN 이미지)로 수정된 과정 기록 — 면접 준비용 판단 근거
- **PERFORMANCE_LOG.md**: 성능 개선 작업 단위별 Before/After 지표와 원리 설명·개념 노트 누적 기록. 신규 측정은 `/perf-check`로만 진행 (자동 트리거 없음)
- **.claude/rules/code-style.md**: 코드 스타일 규칙
- **.claude/rules/git-rules.md**: Git 브랜치/커밋 규칙
- **.claude/rules/work-05-construction.md**: work05 상세 범위 (진행 중)
- **.claude/docs/prd-construction.md**: work05 PRD (공연 콘텐츠 관리 + 유튜브 연결 관리 개편)
- **.claude/docs/work05-implementation.md**: work05 구현 명세 (설계 결정 D1~D10, 작업 단위 T1~T7, 완료 기준) — Codex 구현 기준 문서
- **AGENTS.md**: Codex용 진입점 (역할 분담: 설계 Claude Code / 구현 Codex). 이 파일과 규칙을 맞춰 유지한다
- **.claude/docs/prd-admin.md**: 이전 어드민 PRD (work02, 기존 기능 참고용)
- **.claude/rules/history/**: 종료된 work 문서 보관 (work01 잔여 항목 포함 — `work-01-refactoring.md`)
