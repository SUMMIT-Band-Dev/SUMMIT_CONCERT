# AI Agent 운영 규칙 (summit_concert)

> 이 문서는 AI 코딩 에이전트 전용 운영 규칙입니다. 일반적인 Next.js/React 개발 지식은 포함하지 않습니다.
> 언어·커밋·브랜치·코드 스타일의 전체 규칙은 `CLAUDE.md`, `.claude/rules/code-style.md`, `.claude/rules/git-rules.md`가 원본(source of truth)입니다 — 이 문서는 그 규칙들을 프로젝트 실제 파일 구조에 적용할 때 발생하는 판단 지점만 다룹니다.

## 작업 시작 전 필수 확인

- 리팩토링/성능 작업 → `.claude/rules/work-01-refactoring.md` 먼저 읽는다
- 백엔드(Nest.js)/인증 작업 → `.claude/rules/work-02-nest.js.md` 먼저 읽는다
- 데이터 업데이트/어드민 페이지 작업 → `.claude/rules/work-03-update.md` 먼저 읽는다
- **`CLAUDE.md`의 "알려진 이슈" 표는 갱신되지 않았을 수 있다.** 코드를 수정하기 전에 실제 파일을 확인해 이슈가 아직 유효한지 검증한다. 예: `setlist/page.tsx`(654줄 전체 client)·`event-goods/page.tsx`(539줄) 이슈와 앨범 커버 리사이징 이슈는 이미 해결됨(각각 345/208줄, Server Component + `fetch-line-up-and-setlist.ts`로 분리; `src/lib/mzstatic.ts`의 `shrinkAlbumCoverUrl`로 112px 리사이징 적용됨) — 관련 작업 지시를 받으면 먼저 현재 상태를 재확인하고, `CLAUDE.md`의 표가 실제와 다르면 갱신을 제안한다.

## 중복 파일 — 반드시 올바른 쪽을 수정

- **Supabase 클라이언트가 두 곳에 존재한다**: `src/lib/supabase.ts`(사용 중, `cache-control: no-cache/no-store` 헤더 래핑 포함)와 `lib/src/lib/supabase.ts`(구버전, 미사용 중복 파일).
- Supabase 관련 코드를 수정할 때는 **`src/lib/supabase.ts`만 수정**한다. `lib/src/lib/supabase.ts`는 정리 대상(work01 우선순위 5)이므로 새 로직을 추가하지 않는다.
- import 시 반드시 `@/lib/supabase`(→ `src/lib/supabase.ts`)를 사용한다. `lib/src/lib/supabase`를 import하는 코드를 발견하면 버그로 간주하고 `@/lib/supabase`로 교체한다.

## 이미지 처리 규칙

- Apple Music/iTunes CDN(mzstatic.com) 앨범 커버 URL을 다룰 때는 원본 URL을 그대로 쓰지 말고 `src/lib/mzstatic.ts`의 `shrinkAlbumCoverUrl(url, size)`를 통과시킨다. 새로운 화면에서 앨범 커버를 추가로 표시해야 한다면 이 함수를 재사용한다 — 동일 리사이징 로직을 다른 곳에 새로 작성하지 않는다.
- `next.config.ts`의 `images.remotePatterns`에는 `**.supabase.co`와 `is1-ssl.mzstatic.com`만 허용되어 있다. 새로운 외부 이미지 호스트(다른 CDN 등)를 쓰게 되면 이 배열에 패턴을 추가해야 렌더링이 동작한다 — 추가하지 않으면 `next/image`가 400 에러를 낸다.
- `public/day{1,2}-team*.png`(팀 카드, 14개)는 `setlist/page.tsx`, `event-goods/page.tsx`에서 참조된다. 이 이미지들을 다루는 컴포넌트를 수정할 때는 `next/image`(fill 또는 명시적 width/height)를 사용한다 — `<img>` 태그로 되돌리지 않는다.

## 데이터 페칭 아키텍처

- `setlist/page.tsx`, `event-goods/page.tsx`는 `src/lib/fetch-line-up-and-setlist.ts`의 `fetchLineUpRows`/`fetchSetlistRows`를 Server Component에서 호출하고, 결과를 `setlist-view.tsx`/`event-goods-view.tsx`(Client Component)에 props로 넘기는 구조다. 새로운 데이터 기반 페이지를 추가할 때 이 패턴을 참고 구현체로 사용한다(`location/page.tsx`도 Server Component 참고 패턴).
- 새 Supabase 쿼리 함수를 추가할 때는 `src/lib/fetch-line-up-and-setlist.ts`처럼 서버 전용 fetch 함수를 `src/lib/`에 만들고, 페이지(Server Component)에서 호출한 뒤 Client Component로 props를 내려준다. 페이지 컴포넌트 전체를 `"use client"`로 선언하고 그 안에서 `useEffect`로 데이터를 페칭하는 구조를 새로 만들지 않는다.

## `.mcp.json` 관리

- `.mcp.json`에는 로컬 개발자 머신의 절대경로(예: `shrimp-task-manager`의 `C:\Users\PC\tools\...`)가 포함될 수 있다. 이는 의도적으로 커밋된 상태(1인 개발 환경)이며, 다른 협업자를 위해 경로를 상대화하거나 제거하는 리팩토링을 임의로 하지 않는다 — 변경이 필요하면 먼저 사용자에게 확인한다.

## 타입 위치

- 세트리스트/라인업 관련 타입은 `src/types/setlist.ts`(`DayType`, `SetlistCard`, `TrackItem`)와 `src/app/event-goods/types.ts`에 분산되어 있다. 세트리스트 도메인 타입을 추가/수정할 때는 먼저 두 파일 모두 확인해 중복 정의를 만들지 않는다.

## 금지 사항

- `.env.local`, `.env*` 파일을 읽거나 커밋하지 않는다 (Public 레포).
- `NEXT_PUBLIC_*`가 아닌 시크릿(Supabase service role key 등)을 클라이언트 코드나 `NEXT_PUBLIC_*` 환경 변수에 넣지 않는다.
- work02(Nest.js) 착수 전에 `apps/api` 폴더나 백엔드 스캐폴딩을 미리 만들지 않는다 (버전 드리프트 방지가 목적 — `.claude/rules/work-02-nest.js.md` 참조).
- 어드민 페이지(work03) 관련 작업 시 로그인 + 텍스트/이미지 CRUD를 넘어서는 기능(권한 세분화, 승인 워크플로우 등)을 미리 설계·구현하지 않는다.
