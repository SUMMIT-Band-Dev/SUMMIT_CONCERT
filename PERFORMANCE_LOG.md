# PERFORMANCE_LOG.md

> SUMMIT Web 성능 지표 누적 기록
> 작성 시작일: 2026-09-13
> 목적: 성능 개선 작업 단위가 끝날 때마다 `/perf-check`로 측정한 결과와, 그 변화가 왜 일어났는지의 원리를 시간순으로 쌓는다.

**원칙**: 기존 항목은 절대 수정하지 않는다. 새 측정은 항상 파일 최하단에 새 항목으로 append한다 — 과거 기록을 고쳐서 서사를 매끄럽게 만들지 않는다. 지표가 악화됐어도 그대로 기록한다.

**신규 측정은 `/perf-check`로만 진행한다.** 수동으로 이 파일에 항목을 추가하지 않는다 (측정 조건 누락, 원리 설명 생략 등 형식 붕괴 방지).

---

## Baseline (2026-08-30)

`REFACTOR_NOTES.md` §2의 최초 측정값을 그대로 가져온 기준선. work01 착수 전, 원본 상태.

측정 조건: Chrome DevTools Lighthouse, Mobile, Navigation 모드, 시크릿 모드

| 페이지         | Performance 점수 | LCP  | FCP  | TBT   | Speed Index | CLS | Total Byte Weight |
| -------------- | ---------------- | ---- | ---- | ----- | ----------- | --- | ----------------- |
| `/` (홈)       | 78               | 4.4s | 1.0s | 300ms | 1.5s        | 0   | 974 KiB           |
| `/setlist`     | 79               | 4.8s | 0.9s | 210ms | 2.1s        | 0   | 784 KiB           |
| `/event-goods` | 71               | 9.8s | 0.9s | 180ms | 3.8s        | 0   | 2,387 KiB         |

원본 리포트: `lighthouse-before-{home,setlist,event}-0831.{html,json}`

---

## 항목 템플릿

새 측정마다 아래 형식으로 append. 해당 없는 항목은 비워두지 말고 "N/A"와 이유를 남긴다.

```
## [날짜] — [작업 요약 한 줄]

- 커밋/브랜치: (예: feature/event-goods-image-resize, 커밋 해시)
- 측정 대상 페이지: (예: /event-goods)
- 측정 조건: (디바이스/네트워크 스로틀링/dev·prod 여부 — Baseline과 다르면 반드시 명시)

### Before/After

| 지표 | Before | After |
| --- | --- | --- |
| Performance 점수 | | |
| LCP | | |
| FCP | | |
| TBT | | |
| Speed Index | | |
| CLS | | |

(Performance 점수/Speed Index는 Lighthouse 리포트가 없으면 "N/A (Lighthouse 미실행)"으로 표기)

### 코드 변경 요약
- (git diff 근거로 무엇을 바꿨는지 1~3줄)

### 원리 설명
- (왜 이 변경이 이 지표를 움직였는지 인과관계. 확실하지 않으면 "가설:"로 표기. 지표가 악화됐으면 그 이유도 그대로 기록)

### 개념 노트
- 일반 개념: (재사용 가능한 원리, 프로젝트에 종속되지 않는 설명)
- 이 프로젝트 적용: (SUMMIT 코드베이스에서 구체적으로 어디에 어떻게 적용됐는지)
```

---

## 2026-09-13 — /perf-check 메커니즘 드라이런 (실제 코드 변경 없음)

- 커밋/브랜치: develop, a78bc8d (`/perf-check` 커맨드 및 qa-tester 책임 확장 추가 커밋 — `src/` 페이지 코드 변경 없음)
- 측정 대상 페이지: `/` (홈)
- 측정 조건: `npm run dev` 로컬 dev 서버, Playwright MCP(Chromium) 실측, Lighthouse 미실행. **Baseline(2026-08-30)은 프로덕션 빌드 기준 Chrome DevTools Lighthouse 측정값이라 조건이 다름 — 이번 측정은 Before/After 비교가 아니라 `/perf-check` 파이프라인(측정→기록)이 정상 동작하는지 확인하는 드라이런임.**

### Before/After

| 지표             | Before | After                                                 |
| ---------------- | ------ | ----------------------------------------------------- |
| Performance 점수 | 78     | N/A (Lighthouse 미실행)                               |
| LCP              | 4.4s   | 1.48s (dev 서버 실측, Playwright PerformanceObserver) |
| FCP              | 1.0s   | 0.49s (dev 서버 실측)                                 |
| TBT              | 300ms  | ~0ms (longtask 엔트리 0건, dev 서버 실측 근사치)      |
| Speed Index      | 1.5s   | N/A (Lighthouse 미실행)                               |
| CLS              | 0      | 0 (layout-shift 엔트리 0건)                           |

**주의**: After 값은 dev 서버(HMR, 미압축 번들, 최적화 비활성)에서 실측한 것으로, 프로덕션 빌드 기준인 Baseline과 조건이 달라 수치 자체를 "개선"으로 해석하면 안 됨. dev 서버가 로컬에서 오히려 더 빠르게 보이는 것은 흔한 왜곡(예: 캐시된 리소스, 압축 생략에 따른 반대 효과, 네트워크 스로틀링 없음)이며, 실제 개선 검증 시에는 반드시 `npm run build && npm start` 기준으로 재측정해야 함.

### 코드 변경 요약

- 없음. 이번 커밋(a78bc8d)은 `/perf-check` 커맨드와 qa-tester 책임 확장, `PERFORMANCE_LOG.md` 신설 등 툴링/문서 추가일 뿐 `src/` 하위 페이지 코드는 건드리지 않았음. 홈페이지 성능에 영향을 줄 변경 없음.

### 원리 설명

- 해당 없음 (코드 변경이 없으므로 지표 변화가 있다면 그건 실제 개선이 아니라 dev/prod 조건 차이 또는 측정 노이즈로 봐야 함).

### 개념 노트

- 일반 개념: 성능 측정은 반드시 동일 조건(디바이스/네트워크/dev vs prod 빌드)에서 비교해야 의미가 있다. dev 서버는 HMR·미압축 번들 등으로 인해 프로덕션 대비 지표가 왜곡된다.
- 이 프로젝트 적용: SUMMIT의 Baseline은 프로덕션 빌드 기준 Lighthouse 값이므로, 앞으로 실제 리팩토링 후 After 측정은 `npm run build && npm start`로 조건을 맞춰야 Baseline과 유효하게 비교 가능하다. 이번 드라이런은 그 규칙이 왜 필요한지 보여주는 사례로 로그에 남긴다.
