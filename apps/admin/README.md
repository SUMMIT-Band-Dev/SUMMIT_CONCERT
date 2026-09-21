# apps/admin — SUMMIT 관리자 프론트

SUMMIT 정기공연 사이트의 관리자 페이지(팀·곡·유튜브 연결 관리). 공개 사이트(레포 루트)와 **별도 앱·별도 Vercel 프로젝트**다.
API는 `apps/api`(NestJS)를 쓴다. 결정 배경과 기술 판단은 `REFACTOR_NOTES.md` §18.

> 현재 상태(7c-1b): 로그인·인증 저장·보호 라우트·API 클라이언트·**레이아웃(어두운 사이드바 + 상단 바)과 디자인 토큰**까지. 팀·곡·유튜브 화면은 "준비 중" 자리표시 페이지다(7c-2~4).

## 스택

Next.js 16.3.5(App Router) · React 19.2.4 · TypeScript · Tailwind 4 · shadcn/ui(radix-nova; 토큰은 `globals.css`의 `:root` 한 곳) ·
TanStack Query · React Hook Form + Zod · Vitest. 의존성은 **정확 버전으로 고정**한다(`^` 없음). 잠금 파일은 이 폴더의 `package-lock.json`이며 루트와 독립이다.

## 스크립트

```bash
npm run dev        # 개발 서버 http://localhost:3010
npm run build      # 프로덕션 빌드
npm start          # 빌드 결과 실행 (3010)
npm run lint
npm run typecheck  # 빌드 뒤에 실행(next-env.d.ts, .next/types 필요)
npm test           # vitest
```

## 환경변수

`.env.example` 참고. 실제 값은 `apps/admin/.env.local`(gitignore)에 둔다.

| 이름 | 필수 | 설명 |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | 예 | 관리자 API 주소. 로컬 `http://localhost:3001`. http는 로컬 루프백에서만, 경로·끝 슬래시 없이 |
| `NEXT_PUBLIC_PUBLIC_SITE_ORIGIN` | 아니오 | 공개 사이트 오리진. 7c-2(팀 카드 미리보기)부터 사용 |

⚠️ `NEXT_PUBLIC_*`는 **브라우저 번들에 그대로 들어가 누구에게나 보인다.** 비밀값을 넣지 않는다. 값이 바뀌면 **다시 빌드**해야 한다.

## 로컬에서 API와 함께 띄우기

1. **API의 CORS에 admin 오리진을 허용한다** — `apps/api/.env`에 한 줄 추가(값은 비밀이 아니다):
   ```
   CORS_ALLOWED_ORIGINS=http://localhost:3010
   ```
   설정하지 않으면 API가 모든 크로스 오리진 요청을 거부한다(fail-closed). 브라우저에서는 로그인이 "서버에 연결할 수 없습니다"로 보인다.
2. API 실행(기본 3001): `cd apps/api && npm run start:dev`. **같은 DB에 API 서버를 둘 이상 띄우지 않는다**(요청 mutex가 프로세스 단위).
3. admin 실행: `cd apps/admin && npm run dev` → http://localhost:3010

로그인 한도는 **IP당 5분에 5회**, 초과하면 15분 차단이다(성공한 로그인과 입력 검증 실패도 센다). 실제 계정으로 여러 번 시험하지 않는다.

## 구조

```
src/
  app/
    login/            로그인 페이지
    (admin)/          보호된 영역(레이아웃이 로그인 여부를 확인): teams, songs, youtube
  components/         AuthGate(보호 라우트), layout/(AppShell·Sidebar·Topbar·MobileDrawer·PageHeader·SplitPanel·page-states), LoginForm, SessionExpiredDialog, ui/(shadcn + badge·table)
  lib/
    api/              client.ts(유일한 호출 통로), errors.ts(오류 정규화), config.ts, types.ts(계약 타입)
    auth/             token-storage.ts, session-expiry.ts, login-schema.ts, login-block.ts, next-path.ts, guard.ts, auth-context.tsx
    csp.ts            next.config.ts가 쓰는 Content-Security-Policy 생성
    nav.ts            메뉴 정의(사이드바·상단 바가 함께 씀)
```

## 디자인 토큰

색·radius·글꼴·밀도·레이아웃 치수는 **`src/app/globals.css`의 `:root` 한 곳**에만 둔다. 컴포넌트에는 색상 값(`#hex`, `rgb()`, `bg-blue-500`, `bg-white` 등)을 쓰지 않고 `bg-primary`, `text-muted-foreground`, `w-(--sidebar-width)` 같은 토큰 유틸리티만 쓴다(`src/lib/design-tokens.test.ts`가 검사). 디자인을 바꿀 때는 `:root` 블록과 `components/layout/`만 손본다.

## 보안 원칙

- 토큰은 localStorage에 둔다. **읽고 쓰는 곳은 `token-storage.ts` 하나**이고, 로그·URL·오류 화면·analytics에 남기지 않는다.
- 서버가 준 문자열(오류 메시지, 계정 이름 등)은 **텍스트로만 렌더링**한다. `dangerouslySetInnerHTML` 금지, 서드파티 스크립트 0.
- 보호 라우트(`AuthGate`)는 화면 이동(UX)일 뿐이다. 데이터를 지키는 경계는 API의 JWT Guard다.
- 세션이 만료되면 로그인 페이지로 이동하지 않고 **현재 페이지 위에** 재로그인 대화상자를 띄운다(작성 중이던 폼이 보존된다).
- CSP는 `next.config.ts`의 헤더로 건다. Next.js 인라인 스크립트 때문에 `script-src`에 `'unsafe-inline'`이 필요하다는 한계는 `src/lib/csp.ts` 주석에 있다.

## 새 API 호출을 추가할 때

1. `src/lib/api/types.ts`에 응답 타입을 옮기고, **미러링하는 API 쪽 정의의 위치를 주석으로 적는다**(OpenAPI가 없어 드리프트를 사람이 관리한다).
2. 호출은 반드시 `apiRequest`를 쓴다(`fetch` 직접 호출 금지). 오류는 `ApiError`로 정규화돼 나온다.
3. 조회는 TanStack Query, 변경은 `useMutation`(자동 재시도 없음, 낙관적 업데이트 금지).

## shadcn 컴포넌트를 추가할 때

`npx shadcn add …` 뒤에 (1) 생성된 파일의 `from "cn"` import를 `@/lib/utils`로 바꾸고 (2) `package.json`에 `cn` 패키지가 다시 들어오지 않았는지 확인한다(이 프로젝트는 `clsx` + `tailwind-merge`를 쓴다). (3) 색 하드코딩이 들어오지 않았는지 `npm test`로 확인한다.
