<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# SUMMIT 프로젝트 — Codex 작업 규칙

> 위 Next.js 블록은 `next dev`가 다시 써 넣는 영역이므로 수정하지 않는다. 이 아래가 프로젝트 규칙이다.
> 이 파일은 Codex용 진입점이다. Claude Code는 `CLAUDE.md`를 읽으며, 두 파일의 규칙은 같아야 한다. 규칙을 바꿀 때는 양쪽을 함께 고친다.

## 역할 분담

- **설계는 Claude Code, 구현은 Codex**가 담당한다. 연결 흐름 전체는 `docs/workflow/claude-codex-plan.md`
- Codex는 단위 명세(`docs/specs/<SPEC_ID>.md`)에 적힌 범위·설계 결정·수용 기준(`AC-xx`)을 그대로 구현한다. 명세와 다르게 구현해야 할 이유가 생기면 **임의로 결정하지 말고 멈추고 보고**한다 — 명세 보완은 Claude가 새 revision으로 한다
- 명세에 없는 기능·API·추상화는 만들지 않는다 (과설계 금지)
- **바꾸지 않는 경로**: `docs/specs/`(명세), 정책 경로 `.github/` `.claude/` `.codex/` `.agents/` `docs/ai/` `docs/workflow/` `scripts/ai/`, 모든 폴더의 `AGENTS.md`·`CLAUDE.md`. 구현 PR에 섞이면 CI(`pr-gate`)가 실패한다. 바꿔야 한다면 보고만 한다

## 작업 흐름 (명세 하나 = 구현 PR 하나, 항상 직렬)

1. Claude가 `spec/` PR로 명세를 올리고, 사용자가 머지한다. Actions가 그 PR에 **Codex용 프롬프트 코멘트**를 게시한다
2. 사용자가 프롬프트를 패널에 붙여넣으면, **프롬프트의 순서대로** 진행한다: 준비 점검 → 판정 JSON 출력 → (`ready`면) `impl/<SPEC_ID>-spec-<명세 PR 번호>` 브랜치에서 구현 → 테스트 계획 실행 → 커밋 → `node scripts/ai/create-impl-pr.mjs`로 **PR 생성까지**
3. 판정이 `needs_spec_revision`이면 구현하지 않고 Claude용 보완 요청문을 출력하고 끝낸다 (revision 2면 `needs_human`). `needs_human`이면 근거만 출력하고 끝낸다
4. 명세의 **`[manual]` 수용 기준**에 오면 멈추고, 사용자에게 무엇을 어떻게 확인하면 되는지 적어 확인을 요청한다. 확인을 받은 뒤 진행한다
5. PR을 만든 뒤에는 멈춘다. CI·Claude 명세 대조 리뷰·`pr-gate` 결과 확인과 **머지는 사용자가 한다**
6. `pr-gate`가 실패해 사용자가 수정을 지시하면, **지시된 항목만** 같은 브랜치에 **추가 커밋**으로 고치고(amend·force push 금지) 테스트를 다시 실행한 뒤 `create-impl-pr`을 다시 실행한다 (push + PR 본문 갱신)
7. 이전 구현 PR이 머지되기 전에는 다음 명세를 시작하지 않는다

### 명령 승인

- push·GitHub 호출이 필요한 명령은 샌드박스 밖 실행 승인을 요청한다. **승인은 사용자가 직접 한다** — 허용되는 것은 `create-impl-pr` 실행뿐이고, `git push`·`gh pr create`를 직접 실행하지 않는다
- `gh pr merge`, `develop`·`main`으로의 push는 어떤 경우에도 실행하지 않는다

### 같은 작업 폴더를 사용자와 공유한다

- 작업을 시작할 때와 커밋하기 전에 `git status`를 확인한다. **내가 만들지 않은 변경·untracked 파일은 스테이지하거나 커밋하지 않는다** (`git add -A`·`git add .` 금지, 파일을 지정해서 add). 예상하지 못한 변경이 보이면 손대지 말고 보고한다
- Claude는 별도 워크트리에서 작업하므로 이 폴더를 건드리지 않는다
- PR 본문 초안은 `.ai-tmp/`(git 무시 경로)에 쓴다

## 작업 시작 전 반드시 읽을 문서

1. `CLAUDE.md` — 프로젝트 개요, 아키텍처, 알려진 이슈, 개발 커맨드
2. `.claude/rules/code-style.md` — 코드 스타일 (항상 적용)
3. `.claude/rules/git-rules.md` — 브랜치·커밋·PR 규칙 (항상 적용)
4. **프롬프트가 지정한 단위 명세** `docs/specs/<SPEC_ID>.md` — 구현은 이 문서를 기준으로 한다. 명세가 참조하는 PRD·work 문서(예: work05의 `docs/specs/prd-construction.md`, `docs/specs/work05-implementation.md`)는 배경으로 읽는다
5. 관리자 프론트를 건드리면 `apps/admin/AGENTS.md`, 백엔드를 건드리면 `apps/api/README.md`도 확인

종료된 work 문서는 `.claude/rules/history/`에 있다. 지금 작업과 무관하면 읽지 않아도 된다.

## 언어

- 응답·코드 주석·커밋 메시지·문서: **한국어**
- 변수명·함수명·컴포넌트명: 영어

## 반드시 지킬 것

- **프로덕션 DB에 `prisma migrate dev` 금지.** 마이그레이션은 수작성 SQL(`apps/api/prisma/migrations/<timestamp>_<name>/migration.sql`) + 롤백 SQL(`apps/api/prisma/rollback/`)로 작성만 하고, `migrate deploy` 실행은 사용자가 직접 한다
- **막히면 우회하지 말고 보고한다.** 권한 거부·샌드박스 차단·인증 실패 등으로 실행이 막히면, 다른 방법으로 돌아가지 말고 무엇이 어떤 이유로 막혔는지 그대로 보고한다
- **비밀번호·API 키·시크릿을 채팅으로 주고받지 않는다.** 필요한 값은 어느 파일(`.env`, `.env.local`)의 어떤 키에 넣으면 되는지만 안내하고, 사용자가 직접 편집한다. `.env*` 파일은 커밋하지 않는다 (Public 레포). `.env.example`에는 키 이름과 설명만 쓴다
- **커밋·PR은 Codex용 프롬프트의 흐름 안에서만** 한다. 커밋 형식은 `source-command-git-commit`, PR은 `create-impl-pr` 스크립트로만 연다. 프롬프트 없이 받은 작업은 사용자가 요청할 때만 일반 브랜치(`feature/`·`fix/` 등, `spec/`·`impl/` 제외)에서 커밋·push·PR(`source-command-git-push`)을 한다. **PR 머지는 절대 하지 않는다**
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
