---
spec_id: <SPEC_ID>
revision: 0
---

# <SPEC_ID> — <한 줄 제목>

<!--
단위 명세 템플릿 (docs/workflow/claude-codex-plan.md 6.1). /design-pr 커맨드가 이 파일을 복사해 docs/specs/<SPEC_ID>.md를 만든다.

형식 규칙 (scripts/ai/spec-check.mjs가 PR에서 검사한다)
- frontmatter의 spec_id는 브랜치 spec/<SPEC_ID>-r<N>과 같고, revision은 develop에 있는 이전 revision + 1 (처음이면 0)
- 수용 기준은 목록 형식 "- AC-01 ..."으로 정의한다. 번호는 두 자리 이상, 중복 금지
  본문에서 기준을 가리킬 때는 문장 맨 앞이 아닌 곳에 쓰거나 "(AC-01)"처럼 괄호로 감싼다 — 줄 맨 앞의 "- AC-01"만 정의로 센다
- 사람이 직접 확인해야 하는 기준은 ID 뒤에 [manual]을 붙인다. Codex는 그 지점에서 멈추고 사용자에게 확인을 요청하고,
  Claude 리뷰는 판정하지 않고 PR 체크리스트로 남긴다
- 수용 기준은 코드를 읽거나 명령을 실행해 참·거짓을 가릴 수 있게 쓴다 ("잘 동작한다" 대신 "X를 저장하면 Y가 반환된다")

이 주석 블록은 명세를 만들 때 지운다.
-->

## 배경

- 왜 이 작업이 필요한가, 지금 상태는 어떤가 (관련 파일·문서 경로 포함)

## 범위

**포함**

- 

**제외**

- 이번에 하지 않는 것과 그 이유. 정책 경로(`.github/`, `.claude/`, `.codex/`, `.agents/`, `docs/ai/`, `docs/workflow/`, `scripts/ai/`, `AGENTS.md`, `CLAUDE.md`)와 `docs/specs/`는 구현 PR에서 바꿀 수 없으므로, 필요하면 여기에 "머지 후 maint/로 처리"라고 적는다

## 설계 결정

- 구현자가 임의로 정하면 안 되는 결정 (API 형태, 데이터 구조, 파일 위치 등). 없으면 이 절을 지운다

## 수용 기준

- AC-01 
- AC-02 
- AC-03 [manual] 

## 테스트 계획

구현 후 아래를 실행하고 명령과 결과를 PR 본문에 남긴다.

```bash
# 예) 해당 앱 폴더에서
npm run lint
npm run typecheck
npm test
```

[manual] 기준은 무엇을 어떻게 확인하는지 적는다 (예: PR의 Vercel 프리뷰에서 /setlist 표시 확인).
