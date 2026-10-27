# git-rules.md

이 저장소에서 Git을 사용할 때 따르는 규칙입니다.

## 브랜치 구조

- **`main`**: 배포용. 항상 안정 상태 유지 (Vercel 자동 배포 트리거). 직접 push 금지, `develop`에서 충분히 검증된 뒤에만 반영
- **`develop`**: 통합 브랜치. 기본 작업 브랜치이자 default branch. ruleset `develop-protection`으로 보호된다 — 직접 push·강제 push·삭제 금지, PR 필수, 필수 체크 `pr-gate` 통과, 머지 전 최신화(Update branch) 필요, 우회 없음
- **`feature/*`**: 기능 단위 브랜치. `develop`에서 분기, `develop`으로 머지
- 그 밖에 성격에 맞춰 `fix/*`, `hotfix/*`, `docs/*`, `chore/*`, `design/*`, `refactor/*` 등을 쓴다 (`.claude/commands/git/commit.md`)

## 파이프라인 예약 접두사: `spec/`, `impl/`

Claude·Codex 연결 흐름(`docs/workflow/claude-codex-plan.md`) 전용이다. **사람이 직접 작업할 때는 쓰지 않는다.** CI(`scripts/ai/classify-pr.mjs`)가 브랜치명과 실제 변경 경로를 대조하고, 형식이 틀리면 `pr-gate`가 실패한다.

| 접두사 | 형식 | 만드는 쪽 | 규칙 |
| --- | --- | --- | --- |
| `spec/` | `spec/<SPEC_ID>-r<revision>` | Claude (`/design-pr`) | 단위 명세 `docs/specs/<SPEC_ID>.md` 추가·보완만. `docs/specs/` 밖·정책 경로 변경 금지, revision은 이전 +1 |
| `impl/` | `impl/<SPEC_ID>-spec-<명세 PR 번호>` | Codex (`create-impl-pr`) | 머지된 명세의 구현. 정책 경로·`docs/specs/` 변경 금지, PR 본문 메타데이터 대조와 Claude 명세 대조 리뷰 통과 필요 |

- 예약 접두사가 아닌 브랜치(위의 `feature/` 등)는 **일반 PR**로 분류되어 CI만 통과하면 된다
- **정책 경로**: `.github/`, `.claude/`, `.codex/`, `.agents/`, `docs/ai/`, `docs/workflow/`, `scripts/ai/`, 모든 폴더의 `AGENTS.md`·`CLAUDE.md`. 리뷰 기준·자동화 자체를 바꾸므로 `spec/`·`impl/` PR에서는 바꿀 수 없고, 일반 PR로 올려 사람이 직접 검토한다

## 브랜치는 기능 단위로 나눈다

프론트/백엔드 기준(`feature/frontend-login`, `feature/backend-login`)이 아니라 **기능 단위**(`feature/login`)로 나눈다. 하나의 기능 브랜치 안에서 프론트(Next.js)와 백엔드(Nest.js)를 함께 작업한다. 파이프라인에서는 명세 하나가 이 기능 단위다.

- 이유: 프론트 폼을 만들면서 백엔드 응답 구조가 실시간으로 확정되는 게 자연스럽고, PR 하나가 "기능 전체"를 리뷰 단위로 만듦
- 예외: DB 마이그레이션만, UI 리팩토링만처럼 작업 특성상 한쪽만 건드리는 경우는 자연스럽게 그 폴더만 건드리는 브랜치가 됨 — 이건 억지로 나눈 게 아니라 결과일 뿐

## 인증/세션 관련 작업

`feature/auth-*`로 반드시 격리해서 작업한다 (파이프라인으로 진행하면 별도 명세로 분리하고 검증을 `[manual]` 수용 기준으로 적는다). 배포 전 충분한 테스트 없이는 사고 위험이 큰 영역이므로, `develop`에 머지하기 전 별도 검증 단계를 거친다.

## 커밋 메시지

한국어로 작성한다.

## 레포 구조

프론트/백엔드로 레포를 분리하지 않고 **모노레포**를 유지한다 (루트 공개 사이트, `apps/admin`, `apps/api`). 이유와 재검토 조건은 `.claude/rules/history/work-02-nest.js.md` 참조 — 요약하면 1인 풀스택 + 결합도 높은 프로젝트에서는 레포 분리로 얻는 이점이 없고, 팀원이 프론트/백으로 역할이 명확히 나뉘는 시점에 재검토한다.

## PR / 머지

- PR은 기능 단위로 열고, `develop`으로 머지한다
- **머지는 항상 사용자가 직접 한다.** Claude·Codex는 PR을 머지하지 않고, 자동 머지도 쓰지 않는다. `impl/` PR은 `pr-gate`, Claude 리뷰 요약(Actions 잡 요약), `[manual]` 체크리스트를 확인한 뒤 머지한다
- `develop`이 앞서가 있으면 PR의 **Update branch**를 눌러 검사를 다시 돌린 뒤 머지한다
- `main` 머지는 배포 시점에만, `develop`이 충분히 검증된 뒤 진행한다
