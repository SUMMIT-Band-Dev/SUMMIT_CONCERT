# apps/admin — SUMMIT 어드민

임원진이 공연 콘텐츠를 직접 관리하는 관리자 앱입니다. 공개 사이트와 분리된 Vercel 프로젝트로 배포하고, 모든 데이터는 [관리자 API](../api/README.md)를 거칩니다. 전체 구성은 [루트 README](../../README.md), 호출 흐름은 [아키텍처 문서](../../docs/architecture.md)를 참고하세요.

## 기술 스택

| 기술 | 역할 |
| --- | --- |
| Next.js 16.3 (App Router), React 19 | 화면과 라우팅 |
| TanStack Query 5 | 서버 상태 조회와 변경 |
| React Hook Form, Zod | 폼 상태와 입력 검증 |
| shadcn/ui, Tailwind CSS 4 | UI 컴포넌트와 디자인 토큰 |
| dnd-kit | 공연 순서 드래그 재정렬 |
| Vitest | 단위 테스트 |

의존성은 `^` 없이 정확한 버전으로 고정합니다. 잠금 파일은 이 폴더의 `package-lock.json`이며 루트와 독립입니다.

## 프로젝트 구조

```text
src/
  app/
    login/              로그인
    (admin)/            보호 영역: teams, songs, youtube, concert, venue,
                        performance-days, ticket, notice
  components/
    ui/                 shadcn 기반 공통 컴포넌트
    layout/             AppShell, Sidebar, Topbar, PageHeader, 상태 화면
    teams/ songs/ youtube/ concert-content/
                        도메인 화면. *-page-client.tsx가 페이지 진입점
  lib/
    api/                API 호출, 오류 정규화, 계약 타입
    auth/               토큰 저장, 세션, 로그인 스키마, 인증 훅
    teams/ songs/ youtube/ concert-content/
                        Zod 스키마와 도메인 규칙
    query-client.ts     TanStack Query 기본값
    query-keys.ts       쿼리 키
    nav.ts              메뉴 정의
    csp.ts              Content-Security-Policy 생성
```

## 상태 관리 원칙

- 화면은 `lib/api`의 함수만 호출합니다. `fetch` 직접 호출은 `lib/api/client.ts`의 `apiRequest` 한 곳에만 둡니다.
- 쿼리 키는 `lib/query-keys.ts`에 모아 무효화가 어긋나지 않게 합니다.
- 조회는 일시적 오류만 재시도하고, 변경은 중복 등록을 막기 위해 자동 재시도하지 않습니다.
- 낙관적 업데이트는 쓰지 않습니다. 서버 응답을 받은 뒤 화면을 바꿉니다.

## 실행

```bash
cp .env.example .env.local
npm ci
npm run dev        # http://localhost:3010
npm test
```

| 스크립트 | 설명 |
| --- | --- |
| `npm run build`, `npm start` | 프로덕션 빌드와 실행 |
| `npm run lint` | ESLint |
| `npm run typecheck` | 타입 검사. 빌드 뒤에 실행 |

API를 함께 띄울 때는 `apps/api/.env`의 `CORS_ALLOWED_ORIGINS`에 `http://localhost:3010`을 넣습니다. 비어 있으면 브라우저에서 "서버에 연결할 수 없습니다"로 보입니다.

| 환경 변수 | 필수 | 설명 |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | 예 | 관리자 API 주소. 로컬은 `http://localhost:3001` |
| `NEXT_PUBLIC_PUBLIC_SITE_ORIGIN` | 아니오 | 상대 경로 이미지 미리보기와 공개 페이지 확인 링크 |
| `NEXT_PUBLIC_SUPABASE_STORAGE_ORIGIN` | 아니오 | 업로드 이미지를 CSP `img-src`에 허용 |
| `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` | 아니오 | 공연장 지도. 비어 있으면 좌표 직접 입력만 가능 |

`NEXT_PUBLIC_*` 값은 브라우저 번들에 그대로 들어가므로 비밀값을 넣지 않습니다. 값을 바꾸면 다시 빌드해야 합니다. 자세한 형식은 `.env.example`을 참고하세요.

## 보안 원칙

- 토큰은 localStorage에 두고, 읽고 쓰는 곳은 `token-storage.ts` 하나입니다. 로그, URL, 오류 화면에 남기지 않습니다.
- 서버가 준 문자열은 텍스트로만 렌더링합니다. `dangerouslySetInnerHTML`은 쓰지 않습니다.
- `AuthGate`는 화면 이동만 담당합니다. 데이터를 지키는 경계는 API의 JWT Guard입니다.
- 세션이 만료되면 현재 페이지 위에 재로그인 대화상자를 띄워 작성 중인 폼을 보존합니다.
- CSP는 `next.config.ts`의 헤더로 적용합니다. `script-src`의 `'unsafe-inline'` 한계는 `src/lib/csp.ts` 주석에 있습니다.

## 디자인 토큰

색, radius, 글꼴, 밀도, 레이아웃 치수는 `src/app/globals.css`의 `:root` 한 곳에만 둡니다. 컴포넌트에는 색상 값을 직접 쓰지 않고 `bg-primary` 같은 토큰 유틸리티만 씁니다. `src/lib/design-tokens.test.ts`가 이를 검사합니다.

## 새 API 호출을 추가할 때

1. `src/lib/api/types.ts`에 응답 타입을 옮기고, 미러링한 API 쪽 위치를 주석으로 적습니다. OpenAPI가 없어 타입 차이는 사람이 관리합니다.
2. 호출은 `apiRequest`를 사용합니다. 오류는 `ApiError`로 정규화됩니다.
3. 조회는 TanStack Query, 변경은 `useMutation`을 사용합니다.
4. 새 HTTP 메서드나 헤더를 쓰면 `apps/api/src/common/cors.ts`도 함께 확인합니다.

## shadcn 컴포넌트를 추가할 때

`npx shadcn add …` 뒤에 아래 세 가지를 확인합니다.

1. 생성된 파일의 `from "cn"` import를 `@/lib/utils`로 바꿉니다.
2. `package.json`에 `cn` 패키지가 다시 들어오지 않았는지 확인합니다.
3. 색 하드코딩이 없는지 `npm test`로 확인합니다.
