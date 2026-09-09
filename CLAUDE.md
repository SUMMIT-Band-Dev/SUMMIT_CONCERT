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

## 기술 스택

- **프레임워크**: Next.js 16.2.4 (App Router, 기본 Server Components)
- **UI**: React 19.2.4 + Tailwind CSS 4
- **언어**: TypeScript 5 (strict mode)
- **애니메이션**: framer-motion 12.38.0
- **데이터베이스**: Supabase 클라이언트 (`@supabase/supabase-js` 2.108.1)
- **린팅**: ESLint v9 (Next.js + TypeScript 설정)
- **빌드**: React Compiler 플러그인 활성화

⚠️ **중요**: Next.js 16은 API와 컨벤션의 주요 변경사항이 있습니다. 코드 작성 전에 `node_modules/next/dist/docs/` 또는 [v16 릴리스 노트](https://github.com/vercel/next.js/releases)를 확인하세요.

## 개발 커맨드

```bash
npm run dev    # 개발 서버 시작 (http://localhost:3000, 핫 리로드)
npm run build  # 프로덕션 빌드 (TS, ESLint 검증)
npm start      # 로컬에서 프로덕션 빌드 실행
npm run lint   # ESLint 검사
```

**경로 별칭**: `@/*` → `src/*`

## 환경설정

`.env.local` 파일 생성:
```
NEXT_PUBLIC_SUPABASE_URL=<your-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anonymous-key>
```

이 값들은 브라우저에 노출되므로 (Supabase 클라이언트 인증 필수), 여기에 시크릿/서비스 롤 키를 절대 사용하지 마세요.

## 아키텍처

### 폴더 구조
```
src/
  app/                    # App Router (기본 Server Components)
    page.tsx              # 홈페이지
    setlist/page.tsx      # 세트리스트 (654줄 — 큼, 분할 필요)
    event-goods/page.tsx  # 세트리스트 상세 (539줄 — 큼, 분할 필요)
    location/page.tsx     # 장소 (권장 패턴: Server + Client)
    [other routes]/       # time-table, ticket-info, notice 등
    api/youtube/...       # API 핸들러
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
    setlist.ts            # 데이터 타입
```

### 주요 패턴 & 이슈

**1. Server/Client 분할** (`location/page.tsx` 참고)
- **문제**: `setlist/page.tsx`와 `event-goods/page.tsx`는 전부 `"use client"`이고 `useEffect` 데이터 페칭을 하고 있어 SSR 이점 상실
- **해결**: 데이터 페칭을 Server Component로 이동, Client Component에 props로 전달
- 중복 방지 및 Next.js 캐시 재사용 허용

**2. 이미지 최적화** (성능 병목)
- **이슈**: `/event-goods`에서 Apple Music CDN에서 **600×600px** (각 60–190KB)로 18개 앨범 커버 요청 → 실제 표시는 40–60px 썸네일 → LCP 9.8s
- **이슈**: `public/day{1,2}-team*.png` (14개 파일, 각 85–94KB)는 `next/image` 없이 그대로 제공
- **해결**: iTunes/Apple Music API 작은 크기(`100x100bb.jpg`) 사용 또는 Next.js Image 최적화
- `next.config.ts` 참고 — `remotePatterns`에서 이미 `mzstatic.com`, Supabase CDN 허용

**3. Supabase 페치 동작**
- `lib/supabase.ts`는 `cache-control: no-cache, no-store` 헤더로 fetch 래핑
- 오래된 데이터 방지하지만 반복 요청 시 지연 증가
- 의도된 설계, 파일 내 주석 참고

**4. React Compiler (실험적)**
- `next.config.ts`에서 `reactCompiler: true` 활성화
- 엣지 케이스: 클로저 캡처, ref 변경이 예상대로 작동하지 않을 수 있음
- 이슈 발생 시 [React Compiler 문서](https://react.dev/learn/react-compiler) 확인

**5. 스크롤 끊김** ("스크롤이 끊긴다")
- CLS 아님 (Lighthouse 모든 페이지에서 0)
- 가능 원인: 이미지 디코딩이 메인 스레드 차단 또는 스크롤 중 `FadeInUp` (framer-motion) 애니메이션
- DevTools Performance로 디버그 → 스크롤 기록, long task 확인

## 알려진 이슈 (REFACTOR_NOTES.md 기준)

| 이슈 | 원인 | 우선순위 | 상태 |
|-------|-----------|----------|--------|
| `/event-goods` LCP 9.8s | 600×600px 앨범 커버 18개 (원본) | 1 | 진단됨 |
| 홈/세트리스트 LCP 4–5s | `public` 이미지가 `next/image`로 최적화 안됨 | 2 | 진단됨 |
| 로드 중 스크롤 끊김 | 이미지 디코딩 또는 메인 스레드 JS 실행 | 3 | DevTools 기록 필요 |
| 큰 클라이언트 컴포넌트 | `setlist/` & `event-goods/`는 654 & 539줄 | 4 | 아키텍처 기술부채 |
| 중복 파일 | `lib/src/lib/supabase.ts` (삭제 필요) | 5 | 정리 |
| 저장소의 `dist/` | 빌드 산물 커밋됨; 저장소 비대화 | 5 | 정리 |
| Supabase Free Tier 일시중지 | 비활성 시 데이터 접근 중단 | 4 | 운영 위험 |
| 분석 없음 | Vercel Analytics 미설치 | 4 | H2 공연에 필요 |

**Lighthouse 기준선** (모바일, navigation, incognito, 2026-08-30):
- 홈: 78 성능, 4.4s LCP
- 세트리스트: 79 성능, 4.8s LCP
- 이벤트 상품: 71 성능, 9.8s LCP

이전/이후 보고서는 `lighthouse-before-{home,setlist,event}-*.{html,json}`에 있습니다.

## Vercel 배포

- **도메인**: summit-concert.live
- **빌드 커맨드**: `npm run build`
- **시작 커맨드**: `npm start`
- **환경 변수**: Vercel 대시보드에서 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 설정

## 빠른 문제 해결

**TypeScript 에러**: `npm run build`는 strict mode 문제를 잡습니다. `npm run lint`는 별도입니다.

**사이트가 느림**: 
1. `npm run build && npm start`로 프로덕션 프로파일링
2. DevTools Lighthouse 실행 (Mobile, Navigation, incognito)
3. REFACTOR_NOTES.md의 기준선과 비교, Network 탭에서 이미지 크기 확인

**Supabase가 데이터 반환 안함**: Supabase 대시보드 확인 — Free tier는 비활성 후 자동 일시중지. Projects → Settings → Pause Project에서 재개.

**스크롤이 끊김**: DevTools Performance 탭에서 스크롤 중 기록; long task 및 이미지 디코드 시간 확인.

## 관련 파일

- **AGENTS.md**: Next.js v16 주요 변경사항 경고 (코드 작성 전 읽기)
- **REFACTOR_NOTES.md**: Lighthouse 데이터를 포함한 전체 성능 진단 및 다음 단계 (우선순위 로드맵)
