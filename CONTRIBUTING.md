# Contributing Guide

SUMMIT 웹페이지 프로젝트의 협업 규칙입니다.
프론트엔드/백엔드 모두 작업 전 이 문서를 한 번씩 읽어주세요.

## 브랜치 전략

```
main
 └─ develop
     ├─ spec/<SPEC_ID>-r<revision>       명세 (Claude)
     ├─ impl/<SPEC_ID>-spec-<명세 PR>     구현 (Codex)
     └─ maint/<설명>                      그 외 모든 작업 (사람·Claude)
```

- **main**: 배포(운영) 브랜치. 직접 커밋 금지, `develop`에서 병합된 안정 버전만 올라옵니다.
- **develop**: 통합 개발 브랜치. 모든 작업 브랜치는 여기서 분기하고 여기로 병합합니다. 직접 push가 막혀 있고, 필수 체크 `pr-gate`를 통과한 PR만 머지됩니다.
- **spec / impl / maint**: 이 세 접두사만 씁니다. 다른 접두사(`feature/`, `hotfix/` 등)의 PR은 `pr-gate`에서 실패합니다. 상세는 [`.claude/rules/git-rules.md`](./.claude/rules/git-rules.md), 명세→구현 흐름은 [`docs/workflow/claude-codex-plan.md`](./docs/workflow/claude-codex-plan.md)를 참고해주세요.

### 브랜치 생성 예시 (명세 없이 하는 작업)

```bash
git switch develop
git pull --ff-only origin develop
git switch -c maint/설명
```

## 커밋 컨벤션

| 타입       | 설명                                                  |
| ---------- | ----------------------------------------------------- |
| `feat`     | 새로운 기능 추가                                      |
| `fix`      | 버그 수정                                             |
| `docs`     | 문서 수정                                             |
| `style`    | 코드 스타일 수정 (포맷팅, 세미콜론 등 로직 변경 없음) |
| `design`   | 사용자 UI 디자인 변경                                 |
| `refactor` | 리팩토링                                              |
| `test`     | 테스트 코드 추가/수정                                 |
| `build`    | 빌드 파일 수정                                        |
| `ci`       | CI 설정 파일 수정                                     |
| `perf`     | 성능 개선                                             |
| `chore`    | 설정, 빌드, 패키지 수정                               |
| `rename`   | 파일 혹은 폴더명만 수정한 경우                        |
| `remove`   | 파일 삭제                                             |

**형식**

```
<타입>: <변경 내용 요약>

예)
feat: 칸반 보드 드래그 앤 드롭 기능 추가
fix: 마감일 정렬 오류 수정
design: 슬라이드 패널 레이아웃 조정
chore: prettier 설정 추가
```

- 제목은 50자 이내, 명령문 형태로 간결하게 작성
- 하나의 커밋에는 하나의 논리적 변경만 포함

## 코드 컨벤션

폴더 구조(feature-based), 네이밍 규칙, 코드 스타일, 주석 작성법, API 연동 규칙(공통 응답 타입, ID 문자열 처리, enum 유니온 타입, 에러 코드 분기 처리)은 별도 문서를 따릅니다. PR 작성 전 한 번씩 확인해주세요.

## Pull Request 워크플로우

PR 생성 시 base 브랜치는 **반드시 `develop`** 으로 설정합니다.
(`main`은 배포 브랜치이므로 기능/문서 PR의 병합 대상이 아닙니다.)

PR 본문은 [`.github/PULL_REQUEST_TEMPLATE.md`](./.github/PULL_REQUEST_TEMPLATE.md)를 따릅니다.

### GitHub 저장소 설정 (최초 1회, 관리자)

| 설정                                 | 권장값         | 이유                                        |
| ------------------------------------ | -------------- | ------------------------------------------- |
| **Default branch for pull requests** | `develop`      | PR 생성 시 base가 `main`으로 잡히는 것 방지 |
| **Default branch**                   | `develop` 권장 | PR 템플릿 자동 적용 조건 충족 (아래 참고)   |

> **PR 템플릿 자동 적용 조건**  
> GitHub는 PR 템플릿을 **저장소 default branch**(`main` 또는 `develop`)에 있는 파일만 읽습니다.  
> feature 브랜치에만 있으면 PR 생성 화면에 자동으로 채워지지 않습니다.  
> `develop`에 머지된 뒤에도 default branch가 `main`이면, `develop → main` 병합 전까지는 자동 적용되지 않습니다.  
> git-flow를 쓰는 경우 default branch를 `develop`으로 두는 것을 권장합니다.

### 1. PR 생성 전 체크리스트

- [ ] `develop` 브랜치 최신 내용을 받아서 충돌을 미리 확인했는가
- [ ] 불필요한 `console.log`, 주석 처리된 코드가 남아있지 않은가
- [ ] 로컬에서 정상 동작 확인했는가
- [ ] PR 템플릿 항목을 빠짐없이 작성했는가

### 2. 리뷰 및 머지 규칙

| 구분                             | 규칙                        |
| -------------------------------- | --------------------------- |
| **프론트엔드 및 백엔드 PR 모두** | 셀프 리뷰 후 셀프 머지 가능 (`pr-gate` 통과 필수) |

- 머지 방식은 **Squash and merge**를 기본값으로 사용합니다. (커밋 히스토리를 깔끔하게 유지하기 위함)
- `develop`이 앞서 있으면 **Update branch**로 최신화한 뒤 검사가 다시 통과해야 머지할 수 있습니다.

### 3. 병합 순서

```
spec/·impl/·maint/ → develop → (일정 도달 시) main
```
