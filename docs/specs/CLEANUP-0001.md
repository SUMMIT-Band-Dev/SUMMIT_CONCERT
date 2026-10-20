---
spec_id: CLEANUP-0001
revision: 1
---

# CLEANUP-0001 — 중복 Supabase 클라이언트 파일 삭제

> Claude·Codex 연결 흐름의 **파일럿 명세**입니다 (`docs/workflow/claude-codex-plan.md` 세팅 순서 Step 4). 범위를 일부러 작게 잡아 명세 → 구현 → 검증 → 머지 전 과정을 한 번 끝까지 확인하는 것이 목적입니다.

## 배경

- `lib/src/lib/supabase.ts`는 공개 사이트의 실제 클라이언트 `src/lib/supabase.ts`와 같은 역할의 **옛 사본**이다. 캐시 비활성화(`no-store`) 래핑이 없고, 환경변수에 non-null 단언(`!`)을 쓴다
- 저장소 어디에서도 import하지 않는다 (2026-10-20 확인). 그런데 루트 `tsconfig.json`의 타입 검사 범위에는 들어가 있어, 잘못 import될 여지만 남아 있다
- work01 리팩토링 잔여 항목 #5 "정리 작업"의 일부다 (`.claude/rules/history/work-01-refactoring.md`)

## 범위

**포함**

- `git rm lib/src/lib/supabase.ts`로 파일을 삭제하고 그 삭제를 스테이지한다. 그 결과 비게 되는 `lib/` 디렉터리도 저장소에서 사라진다

**제외**

- `src/lib/supabase.ts`(실제 클라이언트) 수정
- `dist/` 정리 등 work01 #5의 나머지 항목
- 이 파일을 언급하는 문서(`CLAUDE.md` 알려진 이슈 표, `REFACTOR_NOTES.md`, `.claude/`·`.codex/` 에이전트 설정, `shrimp-rules.md`)의 갱신 — 정책 경로가 섞여 있어 머지 후 사람이 일반 브랜치 PR로 따로 정리한다

## 수용 기준

- AC-01 `lib/src/lib/supabase.ts`의 삭제가 인덱스에 반영되어(스테이지 또는 커밋), `git ls-files lib`의 결과가 비어 있다
- AC-02 `origin/develop` 대비 변경은 `lib/src/lib/supabase.ts` 삭제(`D`) 하나뿐이다 (범위 밖 변경 없음)
- AC-03 앱 코드(`src/`, `apps/`)와 설정 파일에 삭제된 파일을 가리키는 import·경로 참조가 없다
- AC-04 [manual] 이 PR의 Vercel 프리뷰(`summit-concert`)에서 홈(`/`)과 세트리스트(`/setlist`)가 이전과 같이 데이터와 함께 표시된다

## 테스트 계획

`git rm`으로 삭제를 스테이지한 뒤, **커밋하기 전에** 루트에서 아래를 실행하고 명령과 결과를 보고한다. 모두 스테이지된 상태(인덱스)를 기준으로 하므로 커밋 전에 판정할 수 있다.

```bash
git ls-files lib                                   # 출력 없음 (AC-01)
git diff --cached --name-status origin/develop     # "D	lib/src/lib/supabase.ts" 한 줄만 (AC-02)
git status --short                                 # 스테이지된 삭제 한 줄 외에 다른 변경 없음 (AC-02)
npm run lint                                       # 통과
npm run typecheck                                  # 통과
```

브랜치는 `origin/develop`에서 만든 직후이므로 위 비교 기준(`origin/develop`)과 분기점이 같다.

[manual] 기준(AC-04)은 PR이 생성된 뒤 Vercel 프리뷰가 올라와야 확인할 수 있으므로, PR 생성 후 사용자에게 확인을 요청한다.
