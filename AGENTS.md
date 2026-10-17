<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# SUMMIT 프로젝트 — Codex 작업 규칙

> 위 Next.js 블록은 `next dev`가 다시 써 넣는 영역이므로 수정하지 않는다. 이 아래가 프로젝트 규칙이다.
> 이 파일은 Codex용 진입점이다. Claude Code는 `CLAUDE.md`를 읽으며, 두 파일의 규칙은 같아야 한다. 규칙을 바꿀 때는 양쪽을 함께 고친다.

## 역할 분담

- **설계는 Claude Code, 구현은 Codex**가 담당한다
- Codex는 설계 문서(PRD·구현 명세)에 적힌 결정을 그대로 구현한다. 명세와 다르게 구현해야 할 이유가 생기면 **임의로 결정하지 말고 작업을 멈추고 이유를 보고**한다 (설계 문서 수정은 Claude Code 쪽에서 한다)
- 명세에 없는 기능·API·추상화는 만들지 않는다 (과설계 금지)
- **설계 문서(`.claude/docs/*`, `.claude/rules/*`, `CLAUDE.md`)는 수정하지 않는다.** 명세 변경이 필요하면 보고만 한다

## 작업 흐름 (항상 직렬)

1. Claude가 명세를 쓰고 `develop`에 머지한다
2. **Codex가 작업 단위(Tn) 하나를 구현한다** — 최신 `develop`에서 명세에 적힌 `feature/*` 브랜치로 분기 → 착수 전 체크포인트 점검(구현 명세 4절) → 구현 → 완료 기준 검증 → 결과 보고(구현 명세 3절 형식)
3. 사용자 확인 후 커밋한다. **커밋하고 나면 멈춘다** — push·PR은 Claude 리뷰를 통과한 뒤 사용자가 요청할 때 한다
4. Claude가 리뷰한다. "[work05 Tn 리뷰 수정 요청]"을 받으면 **적힌 항목만** 고치고, 같은 브랜치에 **추가 커밋**한다(amend·force push 금지). 완료 기준을 다시 검증한 출력을 첨부하고 다시 멈춘다
5. 리뷰를 통과하면 push·PR(base `develop`)을 연다. 머지는 사용자가 한다
6. **이전 작업 단위의 PR이 머지되기 전에는 다음 Tn을 시작하지 않는다**

### 같은 작업 폴더를 Claude와 공유한다

- 작업을 시작할 때와 커밋하기 전에 `git status`를 확인한다. **내가 만들지 않은 변경·untracked 파일은 스테이지하거나 커밋하지 않는다** (`git add -A`·`git add .` 금지, 파일을 지정해서 add). 예상하지 못한 변경이 보이면 손대지 말고 보고한다
- 리뷰 단계에서 Claude가 현재 feature 브랜치에 명세 수정 커밋(`📝 docs`)을 추가할 수 있다. 수정 요청을 받으면 먼저 `git log`로 최신 상태를 확인하고 바뀐 명세를 다시 읽는다

## 작업 시작 전 반드시 읽을 문서

1. `CLAUDE.md` — 프로젝트 개요, 아키텍처, 알려진 이슈, 개발 커맨드
2. `.claude/rules/code-style.md` — 코드 스타일 (항상 적용)
3. `.claude/rules/git-rules.md` — 브랜치·커밋·PR 규칙 (항상 적용)
4. 진행 중인 work 문서 — 현재 **work05**:
   - `.claude/rules/work-05-construction.md` (배경·범위)
   - `.claude/docs/prd-construction.md` (기능 명세, ✅ 확정 사항)
   - `.claude/docs/work05-implementation.md` (**구현 명세 — 작업 단위·설계 결정·완료 기준. 구현은 이 문서를 기준으로 한다**)
5. 관리자 프론트를 건드리면 `apps/admin/AGENTS.md`, 백엔드를 건드리면 `apps/api/README.md`도 확인

종료된 work 문서는 `.claude/rules/history/`에 있다. 지금 작업과 무관하면 읽지 않아도 된다.

## 언어

- 응답·코드 주석·커밋 메시지·문서: **한국어**
- 변수명·함수명·컴포넌트명: 영어

## 반드시 지킬 것

- **프로덕션 DB에 `prisma migrate dev` 금지.** 마이그레이션은 수작성 SQL(`apps/api/prisma/migrations/<timestamp>_<name>/migration.sql`) + 롤백 SQL(`apps/api/prisma/rollback/`)로 작성만 하고, `migrate deploy` 실행은 사용자가 직접 한다
- **막히면 우회하지 말고 보고한다.** 권한 거부·샌드박스 차단·인증 실패 등으로 실행이 막히면, 다른 방법으로 돌아가지 말고 무엇이 어떤 이유로 막혔는지 그대로 보고한다
- **비밀번호·API 키·시크릿을 채팅으로 주고받지 않는다.** 필요한 값은 어느 파일(`.env`, `.env.local`)의 어떤 키에 넣으면 되는지만 안내하고, 사용자가 직접 편집한다. `.env*` 파일은 커밋하지 않는다 (Public 레포). `.env.example`에는 키 이름과 설명만 쓴다
- **커밋·push·PR은 사용자가 요청할 때만** 한다 (`source-command-git-commit`, `source-command-git-push` 스킬). **PR 머지는 절대 하지 않는다**
- **공개 사이트 성능 회귀 금지** — `next/image` 최적화와 메인 배경 `priority`를 유지한다. 공개 사이트를 바꾼 작업은 `source-command-perf-check`로 측정 대상인지 사용자에게 알린다

## 저장소 구조와 커맨드

| 앱 | 위치 | 실행 | 검증 |
| --- | --- | --- | --- |
| 공개 사이트 (Next.js 16.2.4) | 루트 `src/` | `npm run dev` (3000) | `npm run build`, `npm run lint` |
| 관리자 프론트 (Next.js 16.3.5) | `apps/admin` | `npm run dev` (3010) | `npm run build`, `npm run lint`, `npm test` |
| 관리자 API (NestJS 12 + Prisma 7) | `apps/api` | `npm run start:dev` (3001) | `npm run build`, `npm run lint`, `npm test` |

- 각 앱은 독립 `package.json`이다. 명령은 해당 앱 폴더에서 실행한다
- 경로 별칭: `@/*` → 각 앱의 `src/*`
- 테스트는 대상 파일 옆에 둔다 — API는 `*.spec.ts`, admin은 `*.test.ts`(Vitest). 기존 테스트 스타일을 먼저 확인한다
- 공개 사이트(루트)에는 테스트 러너가 없다. `npm run build`·`npm run lint`와 로컬 프로덕션 실행(`npm run build && npm start`)으로 검증한다
