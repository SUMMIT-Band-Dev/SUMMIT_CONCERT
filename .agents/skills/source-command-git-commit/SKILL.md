---
name: "source-command-git-commit"
description: "이모지와 컨벤셔널 커밋 메시지로 잘 포맷된 커밋을 생성합니다"
---

# source-command-git-commit

Use this skill when the user asks to run the migrated source command `git-commit`.

## Command Template

# Codex 명령어: Commit

이모지와 컨벤셔널 커밋 메시지로 잘 포맷된 커밋을 생성합니다.

## 사용법

```
/commit
```

## 프로세스

1. 스테이지된 파일 확인, 스테이지된 파일이 있으면 해당 파일만 커밋
2. 여러 논리적 변경사항에 대한 diff 분석
3. 필요시 분할 제안
4. 이모지 컨벤셔널 포맷으로 커밋 생성

## 브랜치 점검

커밋 전에 현재 브랜치가 이번 변경사항에 적합한지 먼저 확인합니다.

**새 브랜치가 필요한 경우**

- 현재 브랜치가 `main` 또는 `develop`인 경우 (직접 커밋 금지)
- 현재 브랜치의 작업 목적과 이번 변경사항이 무관한 경우 (예: `maint/ci-cache` 브랜치에서 화면 수정)
- 이미 머지된 브랜치이거나 PR이 이미 머지된 브랜치인 경우

**새 브랜치 생성 절차**

1. 브랜치명을 정한다
   - 접두사는 `spec/`·`impl/`·`maint/`만 쓴다 (`.claude/rules/git-rules.md`). 명세 없이 하는 작업은 `maint/<영문-kebab-case>` — 예) `maint/ci-cache`, `maint/hero-spacing`
   - `spec/`·`impl/` 브랜치는 이 절차로 만들지 않는다 (`/design-pr`, Codex 프롬프트가 만든다)
2. 기준 브랜치는 `develop`. 최신 `develop`에서 분기하는 것이 원칙이며, 작업 중인 변경사항은 `git switch -c <브랜치명>`으로 그대로 가져온다
3. 브랜치명을 사용자에게 알린 뒤 새 브랜치에서 커밋을 진행한다
4. 현재 브랜치가 적합하다면 브랜치를 바꾸지 않고 그대로 커밋한다

**주의**

- 브랜치 전환 시 기존 변경사항(스테이지/미스테이지)이 유실되지 않도록 한다. 충돌로 전환이 불가능하면 임의로 처리하지 말고 사용자에게 알린다
- 새 브랜치를 만들지 판단이 애매하면 사용자에게 먼저 확인한다

## 커밋 포맷

`<이모지> <타입>: <설명>`

**타입:**

- `feat`: 새로운 기능
- `fix`: 버그 수정
- `docs`: 문서화
- `style`: 포맷팅
- `refactor`: 코드 리팩토링
- `perf`: 성능 개선
- `test`: 테스트
- `chore`: 빌드/도구

**규칙:**

- 명령형 어조 ("추가" not "추가됨")
- 첫 줄 72자 미만
- 원자적 커밋 (단일 목적)
- 관련 없는 변경사항 분할

## 이모지 맵

✨ feat | 🐛 fix | 📝 docs | 💄 style | ♻️ refactor | ⚡ perf | ✅ test | 🔧 chore | 🚀 ci | 🚨 warnings | 🔒️ security | 🚚 move | 🏗️ architecture | ➕ add-dep | ➖ remove-dep | 🌱 seed | 🧑‍💻 dx | 🏷️ types | 👔 business | 🚸 ux | 🩹 minor-fix | 🥅 errors | 🔥 remove | 🎨 structure | 🚑️ hotfix | 🎉 init | 🔖 release | 🚧 wip | 💚 ci-fix | 📌 pin-deps | 👷 ci-build | 📈 analytics | ✏️ typos | ⏪️ revert | 📄 license | 💥 breaking | 🍱 assets | ♿️ accessibility | 💡 comments | 🗃️ db | 🔊 logs | 🔇 remove-logs | 🙈 gitignore | 📸 snapshots | ⚗️ experiment | 🚩 flags | 💫 animations | ⚰️ dead-code | 🦺 validation | ✈️ offline

## 분할 기준

다른 관심사 | 혼합된 타입 | 파일 패턴 | 큰 변경사항

## 참고사항

- 스테이지된 파일이 있으면 해당 파일만 커밋
- 분할 제안을 위한 diff 분석
- **커밋에 Codex 서명 절대 추가하지 않음**
