# SUMMIT Concert

SUMMIT 공연 시리즈를 위한 Next.js 랜딩 페이지입니다. 행사 일정, 세트리스트, 티켓팅 정보, 장소 상세 정보를 제공합니다.

- **배포**: [summit-concert.live](https://summit-concert.live) (Vercel)
- **데이터베이스**: Supabase

**포지셔닝 원칙**: 프론트엔드가 메인이고, 백엔드(Nest.js/어드민)는 필요에 의한 확장입니다.

## 기술 스택

| 분류        | 스택                                             |
| ----------- | ------------------------------------------------ |
| 프레임워크  | Next.js 16.2.4 (App Router, 기본 Server Components) |
| UI          | React 19.2.4, Tailwind CSS 4                     |
| 언어        | TypeScript 5 (strict mode)                       |
| 애니메이션  | framer-motion 12.38.0                            |
| 데이터베이스 | Supabase (`@supabase/supabase-js` 2.108.1)       |
| 린팅        | ESLint v9 (Next.js + TypeScript 설정)             |
| 빌드        | React Compiler 플러그인 활성화                     |

## 아키텍처

### 폴더 구조

```
src/
  app/                    # App Router (기본 Server Components)
    page.tsx              # 홈페이지
    setlist/page.tsx      # 세트리스트
    event-goods/page.tsx  # 세트리스트 상세
    location/page.tsx     # 장소 정보 (Server + Client 분할 참고 패턴)
    time-table/page.tsx   # 타임테이블
    ticket-info/page.tsx  # 티켓 정보
    notice/page.tsx       # 공지사항
    book/page.tsx
    desktop-404/page.tsx
    layout.tsx
    globals.css
  components/
    layout/               # site-header, site-footer
    sections/             # 세트리스트/시설/채널 등 섹션 컴포넌트
    ui/                    # card-carousel, setlist-detail-modal
    common/               # naver-map, fade-in-up 등 공용 컴포넌트
  lib/
    supabase.ts           # 커스텀 캐시 헤더로 Supabase 클라이언트 초기화
  types/
    setlist.ts            # 세트리스트 관련 타입 정의
```

### 주요 패턴

- **기본은 Server Component**: `"use client"`는 상태/이벤트/브라우저 API가 필요한 최소 범위에만 사용합니다. 데이터 페칭은 Server Component에서 수행하고 Client Component에는 props로 전달합니다 (`location/page.tsx` 참고 패턴).
- **이미지 최적화**: `next/image`와 `next.config.ts`의 `remotePatterns`(Supabase, `mzstatic.com`)를 통해 외부 이미지를 최적화합니다.
- **Supabase 페치**: `lib/supabase.ts`는 `cache-control: no-cache, no-store` 헤더로 fetch를 래핑해 오래된 캐시 데이터를 방지합니다 (의도된 설계 결정).
- **React Compiler**: `next.config.ts`에서 `reactCompiler: true`로 활성화되어 있어 수동 메모이제이션이 필요 없는 경우가 많습니다.

> 현재 리팩토링(work01), 백엔드 도입(work02), 어드민 페이지(work03) 로드맵이 진행 중입니다. 상세 내용은 `.claude/rules/` 문서를 참고하세요.

## 개발 커맨드

```bash
npm run dev    # 개발 서버 시작 (http://localhost:3000, 핫 리로드)
npm run build  # 프로덕션 빌드 (TS, ESLint 검증)
npm start      # 로컬에서 프로덕션 빌드 실행
npm run lint   # ESLint 검사
```

**경로 별칭**: `@/*` → `src/*`

## 환경설정

루트에 `.env.local` 파일을 생성합니다:

```
NEXT_PUBLIC_SUPABASE_URL=<프로젝트-URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<익명-키>
```

이 값들은 브라우저에 노출되므로(Supabase 클라이언트 인증 필수), 여기에 시크릿/서비스 롤 키를 절대 사용하지 마세요.

## 배포

- **플랫폼**: Vercel
- **도메인**: summit-concert.live
- **빌드 커맨드**: `npm run build`
- **시작 커맨드**: `npm start`
- **환경 변수**: Vercel 대시보드에서 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 설정

## 문제 해결

**Supabase가 데이터를 반환하지 않을 때**: Supabase Free tier는 비활성 기간 후 프로젝트가 자동으로 일시중지됩니다. 대시보드의 Projects → Settings → Pause Project 섹션에서 재개할 수 있습니다.

**사이트가 느려 보일 때**: `npm run build && npm start`로 프로덕션 환경을 프로파일링하고, DevTools Lighthouse(Mobile, Navigation, Incognito)를 실행해 확인합니다.

## 관련 문서

- `CLAUDE.md`: 프로젝트 전반 가이드 및 작업 로드맵
- `AGENTS.md`: Next.js v16 주요 변경사항
- `REFACTOR_NOTES.md`: 성능 진단 및 개선 로드맵
- `REFACTOR_HYPOTHESIS_LOG.md`: 성능 이슈 가설 검증 기록
- `.claude/rules/`: 코드 스타일, Git 규칙, 작업 단계별(work01~03) 상세 문서
