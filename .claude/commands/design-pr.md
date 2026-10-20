---
description: 단위 명세를 작성·보완하고 spec/ 브랜치 PR을 엽니다 (Claude·Codex 흐름 1~2단계)
argument-hint: <요구사항 설명 | Codex 보완 요청문 | 명세 ID>
---

# /design-pr — 명세 작성·보완 → spec PR

입력: $ARGUMENTS

`docs/workflow/claude-codex-plan.md`의 5장 1~2단계다. 이 커맨드는 **명세 PR을 여는 데까지만** 한다. 머지는 사용자가 하고, 머지되면 Actions가 Codex용 프롬프트를 PR 코멘트로 게시한다.

## 0. 작업 위치

- **Claude 전용 워크트리 `C:\Users\PC\worktrees\summit-claude`에서만 작업한다.** Codex와 공유하는 OneDrive 체크아웃에서는 파일 수정·브랜치 전환·커밋을 하지 않는다
- `git status`가 깨끗한지 확인하고 `git fetch origin --prune`

## 1. 명세 ID와 revision 정하기

- **새 명세**: ID를 정해 사용자에게 확인받는다. 형식은 대문자로 시작하는 `<묶음>-<번호>` (예: `WORK05-T2`, `CLEANUP-0002`, `FEATURE-0001`)
- **보완 요청문**(`[명세 보완 요청 — <ID> r<N>]`)을 받았으면 그 ID를 쓴다
- revision: `git show origin/develop:docs/specs/<ID>.md`가 있으면 그 frontmatter의 revision + 1, 없으면 0
- **revision이 2를 넘게 되면 멈춘다.** 서로 다른 명세 회차는 최대 3개(0·1·2)다. 범위를 줄이거나 명세를 나누는 방안을 사용자와 정한다

## 2. 명세 쓰기

1. `git switch -c spec/<ID>-r<N> origin/develop`
2. 새 명세는 `docs/ai/spec-template.md`를 `docs/specs/<ID>.md`로 복사해 채운다 (템플릿의 주석 블록은 지운다). 보완이면 기존 파일을 고치고 frontmatter의 revision만 올린다
3. 쓰기 전에 관련 코드·문서를 직접 읽고 사실을 확인한다. 추측한 파일 경로·API를 적지 않는다
4. 수용 기준 규칙
   - 목록 형식 `- AC-01 ...`, 번호 두 자리 이상, 중복 없음. 줄 맨 앞의 `- AC-xx`만 정의로 센다
   - 코드를 읽거나 명령을 실행해 참·거짓을 가릴 수 있게 쓴다
   - 사람이 직접 확인해야 하면 `[manual]`을 붙이고, 무엇을 어떻게 확인하는지 테스트 계획에 적는다
5. 구현 PR은 정책 경로(`.github/`, `.claude/`, `.codex/`, `.agents/`, `docs/ai/`, `docs/workflow/`, `scripts/ai/`, `AGENTS.md`·`CLAUDE.md`)와 `docs/specs/`를 바꿀 수 없다. 필요하면 범위의 "제외"에 "머지 후 maint/로 처리"라고 적는다
6. 이 PR에서는 `docs/specs/` 아래만 바꾼다. 다른 단위 명세 파일(`docs/specs/<다른 ID>.md`)은 같이 바꾸지 않는다

## 3. 로컬 검사

```bash
node scripts/ai/classify-pr.mjs --base origin/develop --head HEAD   # 커밋 후 실행, kind=spec · ok=true
node scripts/ai/spec-check.mjs --branch spec/<ID>-r<N> --base origin/develop --head HEAD   # ok=true
```

## 4. 사용자 확인 → 커밋·PR

1. 명세 요약(범위, 수용 기준 목록, `[manual]` 항목)을 보여주고 **사용자 확인을 받는다**
2. 확인을 받으면 `📝 docs: <ID> 명세 추가` (보완이면 `📝 docs: <ID> 명세 보완 (r<N>)`)로 커밋하고, 3의 검사를 다시 실행한다
3. `git push -u origin spec/<ID>-r<N>`
4. `gh pr create --base develop --label spec`으로 PR을 연다. 본문은 `.github/PULL_REQUEST_TEMPLATE.md` 형식(작업 유형 `docs`)이고, 보완이면 받은 보완 요청문을 "관련 이슈"에 요약한다
5. PR URL을 알려주고 끝낸다. **머지하지 않는다**
