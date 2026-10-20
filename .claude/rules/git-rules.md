# git-rules.md

이 저장소에서 Git을 사용할 때 따르는 규칙입니다. Claude·Codex 연결 흐름의 상세는 `docs/workflow/claude-codex-plan.md`를 따릅니다.

## 브랜치 구조

- **`main`**: 배포용. 항상 안정 상태 유지 (Vercel 자동 배포 트리거). 직접 push 금지, `develop`에서 충분히 검증된 뒤에만 반영
- **`develop`**: 통합 브랜치이자 default branch. ruleset `develop-protection`으로 보호된다 — 직접 push·강제 push·삭제 금지, PR 필수, 필수 체크 `pr-gate`, 머지 전 최신화(Update branch) 필요, 우회 없음
- 작업 브랜치는 `develop`에서 분기하고 `develop`으로 머지한다. **접두사는 아래 세 가지만 쓴다** (2026-10-20부터. 다른 접두사의 PR은 `pr-gate`에서 실패한다)

| 접두사 | 형식 | 누가 | 내용 |
| --- | --- | --- | --- |
| `spec/` | `spec/<SPEC_ID>-r<revision>` | Claude (`/design-pr`) | 단위 명세 `docs/specs/<SPEC_ID>.md` 추가·보완. `docs/specs/` 밖은 바꿀 수 없다 |
| `impl/` | `impl/<SPEC_ID>-spec-<명세 PR 번호>` | Codex (`create-impl-pr`) | 머지된 명세의 구현. 정책 경로·`docs/specs/`는 바꿀 수 없다 |
| `maint/` | `maint/<영문-kebab-case>` | 사람·Claude | 명세 없이 하는 작업 전부: 정책 경로(CI·에이전트 규칙·프롬프트) 변경, 디자인·핫픽스·문서 정리 등 |

- **정책 경로**: `.github/`, `.claude/`, `.codex/`, `.agents/`, `docs/ai/`, `docs/workflow/`, `scripts/ai/`, 모든 폴더의 `AGENTS.md`·`CLAUDE.md`. 리뷰 기준·자동화 자체를 바꾸므로 `maint/` PR에서만 바꾸고 사람이 직접 검토한다
- 기존 `feature/ fix/ docs/ chore/ design/ refactor/ hotfix/`는 은퇴했다. 커밋 타입(`feat`, `fix` 등)은 그대로 쓴다

## 브랜치는 기능 단위로 나눈다

프론트/백엔드 기준이 아니라 **기능(명세) 단위**로 나눈다. 하나의 `impl/` 브랜치 안에서 프론트(Next.js)와 백엔드(Nest.js)를 함께 작업한다.

- 이유: 프론트 폼을 만들면서 백엔드 응답 구조가 실시간으로 확정되는 게 자연스럽고, PR 하나가 "기능 전체"를 리뷰 단위로 만듦
- 인증·세션 관련 작업은 명세를 따로 두고(예: `AUTH-0001`), 배포 전 별도 검증 단계를 명세의 `[manual]` 수용 기준으로 적는다

## 커밋 메시지

한국어로 작성한다. 형식은 `<이모지> <타입>: <설명>` (`.claude/commands/git/commit.md`).

## 레포 구조

프론트/백엔드로 레포를 분리하지 않고 **모노레포**를 유지한다 (루트 공개 사이트, `apps/admin`, `apps/api`). 1인 풀스택 + 결합도 높은 프로젝트에서는 레포 분리로 얻는 이점이 없고, 팀원이 프론트/백으로 역할이 명확히 나뉘는 시점에 재검토한다 (`.claude/rules/history/work-02-nest.js.md`).

## PR / 머지

- 모든 PR의 base는 `develop`이다. PR은 브랜치를 만든 쪽이 연다 — `spec/`은 Claude, `impl/`은 Codex(`create-impl-pr` 실행은 사용자 승인), `maint/`은 사람 또는 Claude
- **머지는 항상 사용자가 직접 한다.** Claude·Codex는 PR을 머지하지 않고, 자동 머지도 쓰지 않는다
- 머지 전에 사용자가 확인할 것: `pr-gate` 통과, `impl/` PR이면 Claude 리뷰 요약(Actions 잡 요약)과 `[manual]` 체크리스트
- `develop`이 앞서가 있으면 PR의 **Update branch**를 눌러 검사를 다시 돌린 뒤 머지한다
- `main` 머지는 배포 시점에만, `develop`이 충분히 검증된 뒤 진행한다
