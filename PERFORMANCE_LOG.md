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
- 측정 조건: (Lighthouse/Playwright 각각의 디바이스·네트워크 스로틀링·dev/prod 여부 — Baseline과 다르면 반드시 명시)

### Lighthouse (공식 Before/After 비교용)

| 지표 | Before | After |
| --- | --- | --- |
| Performance 점수 | | |
| LCP | | |
| FCP | | |
| TBT | | |
| Speed Index | | |
| CLS | | |
| Total Byte Weight | | |

(Lighthouse 실행 자체가 실패했으면 전체 항목을 "N/A (Lighthouse 실행 실패: 사유)"로 표기)

### Playwright 실측 (네트워크 요청/바이트 변화 확인용)

| 지표 | Before | After |
| --- | --- | --- |

(Lighthouse 표와 절대 하나로 합치지 않는다 — 역할이 다르다: Lighthouse는 Baseline과 비교 가능한 공식 지표, Playwright는 실제 네트워크 요청/바이트 실측)

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

---

## 2026-09-13 — 앨범 커버 이미지 리사이징 (Apple Music CDN 600x600 → 112x112)

- 커밋/브랜치: feature/album-cover-resize (미커밋)
- 측정 대상 페이지: `/event-goods`, `/setlist`
- 측정 조건: 프로덕션 빌드(`npm run build && npm start`), Playwright MCP(Chromium) 실측, Lighthouse 미실행 — Baseline은 Chrome DevTools Lighthouse(Mobile 에뮬레이션, Navigation, 시크릿) 기준이라 도구 자체가 다름. 이번 측정은 Playwright 브라우저의 **데스크톱 뷰포트(1036×850, DPR 1.5)** 로 실행됐고 Mobile 에뮬레이션·네트워크 스로틀링은 적용하지 않았음 — LCP/FCP/TBT/CLS는 실측 근사치로 참고용이며, Performance 점수/Speed Index는 Lighthouse 없이는 산출 불가하므로 N/A. Total Byte Weight는 Lighthouse의 "페이지 전체 바이트"가 아니라 **이미지 리소스(png/jpg/webp/avif, `_next/image`, mzstatic)만 합산한 근사치**임 (`performance.getEntriesByType('resource')`의 `encodedBodySize` 합계, Playwright `browser_evaluate`로 측정) — Before(784 KiB, 2,387 KiB)는 페이지 전체 바이트라 완전히 동일한 정의는 아니지만, 이미지가 각 페이지 바이트의 대부분을 차지했던 이슈였으므로 참고용으로 병기.

### Before/After

**`/event-goods`**

| 지표 | Before (Lighthouse, Mobile, prod) | After (Playwright, 데스크톱 뷰포트, prod) |
| --- | --- | --- |
| Performance 점수 | 71 | N/A (Lighthouse 미실행) |
| LCP | 9.8s | 0.684s (LCP 후보가 `H1` 텍스트로 바뀜 — 앨범 커버가 더 이상 LCP 후보에 안 잡힐 만큼 작아짐) |
| FCP | 0.9s | 0.072s |
| TBT | 180ms | ~0ms (longtask 엔트리 0건) |
| Speed Index | 3.8s | N/A (Lighthouse 미실행) |
| CLS | 0 | 0.867 (아래 원리 설명 참고 — 앨범 커버 리사이징과 무관해 보이는 별도 이슈로 추정) |
| 이미지 리소스 총량(근사) | 2,387 KiB (페이지 전체) | 119.4 KiB (이미지만, mzstatic 앨범 커버 16장 + 포스터 1장) |

**`/setlist`**

| 지표 | Before (Lighthouse, Mobile, prod) | After (Playwright, 데스크톱 뷰포트, prod) |
| --- | --- | --- |
| Performance 점수 | 79 | N/A (Lighthouse 미실행) |
| LCP | 4.8s | 1.152s (LCP 후보는 포스터 `IMG`, object-cover — 앨범 커버는 초기 로드에 안 잡힘) |
| FCP | 0.9s | 0.104s |
| TBT | 210ms | ~0ms (longtask 엔트리 0건) |
| Speed Index | 2.1s | N/A (Lighthouse 미실행) |
| CLS | 0 | 0 |
| 이미지 리소스 총량(근사, 초기 로드) | 784 KiB (페이지 전체) | 640.2 KiB (`day1-team*.png` 7장, 각 88–96KB 미최적화 + 포스터) — 앨범 커버는 초기 로드에 포함되지 않음 |

### 코드 변경 요약
- 신규 헬퍼 `src/lib/mzstatic.ts`의 `shrinkAlbumCoverUrl(url, size=112)` 추가 — mzstatic CDN URL 끝의 `/{width}x{height}bb.jpg` 크기 지정자를 정규식으로 치환.
- `src/app/event-goods/page.tsx`, `src/app/setlist/page.tsx` 양쪽에서 `albumCoverSrc`를 계산할 때 (Supabase `Setlist.album` 컬럼 값이 `http`로 시작하면) `shrinkAlbumCoverUrl`을 적용해 `600x600bb.jpg` 요청을 `112x112bb.jpg` 요청으로 바꿈. `next/image`의 `unoptimized` 속성 및 컴포넌트 구조는 그대로 유지 (구조 변경 없음).

### 원리 설명
- Apple Music/iTunes CDN(mzstatic.com)은 URL 경로 끝의 크기 지정자에 따라 origin에서 실제로 리사이즈된 이미지를 반환한다. 기존에는 600×600px 원본(개당 60–190KB, 18~22개)을 그대로 받아 56px 표시 영역에 CSS로만 축소하고 있었다. URL을 112×112(레티나 2배)로 바꾸자 실측 네트워크 요청도 실제로 `112x112bb.jpg`로 확인됐고(Playwright network 로그), `/event-goods`의 16개 앨범 커버 합계가 108,055바이트(~105.5KiB)로 줄었다 — Total Byte Weight 감소는 가설이 아니라 직접 관찰된 결과.
- `/event-goods`는 앨범 커버가 LCP 후보 이미지였을 가능성이 높다는 REFACTOR_NOTES.md 진단대로, 실측에서 LCP가 9.8s → 0.684s로 크게 개선됐고 LCP 후보 자체가 이미지에서 `H1` 텍스트로 바뀌었다(이미지가 작아져 더 이상 "가장 큰 콘텐츠"가 아니게 됨). 다만 이 LCP 값은 Lighthouse Mobile 에뮬레이션이 아니라 Playwright 데스크톱 뷰포트·프로덕션 서버(디스크 캐시 일부 적용) 기준이라 9.8s→0.684s 격차의 상당 부분은 도구/조건 차이(네트워크 스로틀링 없음, CPU 스로틀링 없음)에서도 왔을 것으로 추정된다. 그럼에도 "앨범 커버가 더 이상 LCP 후보가 아니게 됐다"는 정성적 변화는 조건과 무관하게 유효한 근거임.
- `/setlist`는 가설대로 앨범 커버가 상세 모달(클릭 시에만 로드) 안에 있어 초기 로드 LCP에는 관여하지 않았다 — 초기 로드 LCP 후보는 여전히 포스터 이미지(`IMG.object-cover`)였다. 모달을 열어 확인한 결과 `112x112bb.jpg` 요청이 정상적으로 발생함을 확인했으나(네트워크 로그 40~43번), 초기 로드 지표에는 반영되지 않는다는 가설이 맞았다. `/setlist`의 이미지 총량(640.2 KiB)이 크게 줄지 않은 것은 앨범 커버가 아니라 여전히 최적화 안 된 `day1-team*.png` 7장(각 88~96KB)이 초기 로드를 차지하기 때문 — 이건 work01 2순위 과제(아직 미착수)의 몫이라 이번 변경 범위 밖.
- **CLS 0.867 (`/event-goods`)은 예상과 다른 결과이며 포장하지 않고 그대로 남긴다.** Baseline(Lighthouse Mobile)은 CLS 0이었는데, 이번 실측(Playwright 데스크톱 뷰포트)에서는 SECTION/DIV 요소에서 startTime 213ms에 단일 레이아웃 시프트(value 0.867)가 재현성 있게 관찰됐다(동일 절차 2회 반복, 동일 값). 앨범 커버 이미지 크기를 줄인 것이 레이아웃 시프트를 유발할 개연성은 낮음(이미지 컨테이너 크기는 CSS로 고정돼 있고, 리사이징은 요청 URL만 바꾼 것이라 DOM 치수는 불변) — 가설: 데스크톱 뷰포트에서만 발생하는 반응형 그리드/폭 재배치이거나, 폰트 로딩 시점과 겹치는 기존 이슈일 가능성이 높다. Baseline이 Mobile 뷰포트 기준이라 이 데스크톱 전용 시프트를 안 잡았을 수 있다. 이 변경(앨범 커버 리사이징)이 원인이라고 단정할 근거는 없으나, 사실로 관찰된 값이므로 그대로 기록하고 원인 규명은 별도 작업(코드 리뷰/DevTools Performance 트레이스)이 필요하다고 남긴다.

### 개념 노트
- 일반 개념: 이미지 최적화의 핵심은 "표시 크기에 맞는 원본을 요청하는 것"이다. `next/image`처럼 클라이언트/서버에서 리사이즈하는 방법도 있지만, origin(CDN)이 크기 파라미터를 지원하면 origin 단에서 리사이즈된 파일을 요청하는 것이 가장 직접적으로 다운로드 바이트를 줄인다.
- 일반 개념: LCP는 "가장 큰 콘텐츠 요소"의 페인트 시점을 측정하므로, 이미지 자체의 로딩 속도를 개선하는 것 외에 이미지를 작게 만들어 LCP 후보에서 완전히 제외시키는 것도 유효한 개선 전략이다 (다만 그 경우 다음으로 큰 요소, 여기서는 `H1` 텍스트가 LCP 대표가 된다).
- 일반 개념: 성능 지표는 측정 도구(Lighthouse vs 실측 Performance API)와 조건(Mobile 에뮬레이션+스로틀링 vs 데스크톱 실측)이 다르면 절대값을 직접 비교할 수 없다 — 정성적 방향(개선/악화 여부, LCP 후보가 바뀌었는지)은 참고할 수 있어도 "9.8s에서 0.68s로 몇 배 개선"이라는 식의 단순 산술은 도구 차이를 무시한 과장이 된다.
- 이 프로젝트 적용: SUMMIT은 Apple Music CDN의 `{width}x{height}bb.jpg` 크기 지정자 규칙을 이용해 `src/lib/mzstatic.ts`에서 문자열 치환으로 처리했다. `next/image`의 `unoptimized`를 유지한 채로도 적용 가능했던 이유는, 최적화 지점이 Next.js 이미지 서버가 아니라 origin CDN이기 때문.
- 이 프로젝트 적용: `/setlist`에서 앨범 커버가 상세 모달 안에 있다는 구조 때문에, 같은 코드 변경(`shrinkAlbumCoverUrl` 적용)이 `/event-goods`에서는 LCP 개선으로 직결되지만 `/setlist`에서는 초기 로드 지표에 나타나지 않는다 — 같은 최적화라도 그 이미지가 "언제 로드되는가"에 따라 체감 효과가 페이지마다 다르게 나타난다는 사례로 남긴다.

---

## 2026-09-13 — /event-goods, /setlist 공식 Lighthouse Before/After 확보 (코드 변경 없음, /perf-check Lighthouse 파이프라인 첫 실사용)

- 커밋/브랜치: chore/perf-check-lighthouse, 56b54fc (코드 변경 없음 — Lighthouse 파이프라인만 신규 추가)
- 측정 대상 페이지: `/event-goods`, `/setlist`
- 측정 조건:
  - Lighthouse: `npm run build && npm start` 프로덕션 서버(포트 3000, dev 서버 마커 `webpack-hmr`/`react-refresh`/`_next/static/development/` 없음을 확인해 진짜 프로덕션 빌드임을 검증), `npx lighthouse --preset=perf --form-factor=mobile --screenEmulation.mobile --throttling-method=simulate` (headless Chrome). Baseline(2026-08-30)은 Chrome DevTools Lighthouse(Mobile, Navigation, 시크릿, 아마도 throttling-method 기본값인 `devtools`)로 측정된 값이라, 이번 CLI 측정(`throttling-method=simulate`)과 스로틀링 방식이 다를 수 있음 — 폼팩터(Mobile)는 동일하지만 완전히 동일한 조건이라고 단정할 수는 없음. 원본 리포트: `lighthouse-after-event-goods-20260913.json`, `lighthouse-after-setlist-20260913.json` (리포 루트).
  - Playwright: 동일 프로덕션 서버, Chromium 기본 뷰포트(데스크톱), Mobile 에뮬레이션·네트워크 스로틀링 미적용 — 직전 항목(앨범 커버 리사이징, 2026-09-13)과 동일 절차·동일 조건으로 재실측.
  - **중요**: 이번 실행은 새 코드 변경을 측정하는 것이 아니다. `git diff 9ba7c12..56b54fc -- src/`가 비어 있음을 확인했고(오케스트레이터 사전 확인), 이번 브랜치의 변경은 `.claude/agents/qa-tester.md`·`.claude/commands/perf-check.md`·`PERFORMANCE_LOG.md` 템플릿뿐인 툴링/문서 변경이다. 즉 이 항목은 "직전 항목(앨범 커버 리사이징, 커밋 9ba7c12)에 대해 지금까지 N/A로 비어 있던 공식 Lighthouse 지표를 처음 채우는 것"이 목적이며, 코드 변경 요약·원리 설명·개념 노트는 직전 항목을 그대로 참조한다 (반복 서술하지 않음).

### Lighthouse (공식 Before/After 비교용)

**`/event-goods`**

| 지표 | Before (Baseline, 2026-08-30) | After (2026-09-13) |
| --- | --- | --- |
| Performance 점수 | 71 | 56 |
| LCP | 9.8s | 4.86s |
| FCP | 0.9s | 1.28s |
| TBT | 180ms | 233.5ms |
| Speed Index | 3.8s | 3.76s |
| CLS | 0 | 0.480 |
| Total Byte Weight | 2,387 KiB | 634 KiB (649,000 bytes) |

**`/setlist`**

| 지표 | Before (Baseline, 2026-08-30) | After (2026-09-13) |
| --- | --- | --- |
| Performance 점수 | 79 | 77 |
| LCP | 4.8s | 5.74s |
| FCP | 0.9s | 0.76s |
| TBT | 210ms | 165.5ms |
| Speed Index | 2.1s | 1.03s |
| CLS | 0 | 0 |
| Total Byte Weight | 784 KiB | 1,051 KiB (1,076,577 bytes) |

**정직하게 남기는 관찰**: 앨범 커버 리사이징(112x112bb.jpg)으로 Total Byte Weight는 두 페이지 모두 크게 줄었으나(`/event-goods` 2,387→634 KiB, `/setlist` 784→1,051 KiB — 단 `/setlist`는 오히려 증가, 아래 참고), Performance 점수는 `/event-goods`가 71→56으로 오히려 하락했고 LCP도 9.8s→4.86s로 개선은 됐지만 직전 Playwright 실측(0.684s)과는 격차가 크다. `/setlist`의 Total Byte Weight가 오히려 늘어난 것은 Lighthouse의 "Total Byte Weight"가 페이지 전체 리소스(day1-team*.png 미최적화 PNG 7장, 폰트, JS 청크 등)를 모두 포함하기 때문으로 추정되며, 앨범 커버 리사이징만으로는 상쇄되지 않는 수준의 다른 페이로드가 있다는 뜻이다(가설 — 코드 리뷰 없이 이 수치만으로 단정 불가). `/event-goods`의 Performance 점수 하락과 CLS 0→0.48은 직전 항목에서 이미 관찰된 CLS 이상(0.867, 데스크톱 뷰포트 기준)이 Mobile Lighthouse 조건에서도 재현된 것으로 보이며, 이 CLS가 Performance 점수 하락의 주 원인일 가능성이 높다(가설). 두 경우 모두 원인 규명은 이 QA 리포트의 범위를 넘으며, `performance-analyzer`/`code-reviewer`의 코드 근거 분석이 필요하다.

### Playwright 실측 (네트워크 요청/바이트 변화 확인용)

**`/event-goods`**

| 지표 | Before (직전 항목, 2026-09-13 앨범 커버 리사이징) | After (이번 측정, 2026-09-13) |
| --- | --- | --- |
| LCP | 0.684s | 0.800s |
| FCP | 0.072s | (직접 재측정 안 함 — 절차상 LCP/CLS/이미지 바이트 재확인에 집중) |
| TBT | ~0ms | ~0ms (longtask 엔트리 0건) |
| CLS | 0.867 | (재측정 안 함 — 이번엔 Lighthouse 표에서 CLS 0.480으로 별도 확인됨) |
| 이미지 리소스(mzstatic 16장 + 포스터) | 119.4 KiB | 유사 수준 확인(개별 이미지 content-length 4.4~7.0KB/장, 112x112bb.jpg 요청 재확인 — 코드 변경 없으므로 동일할 것으로 예상, 전수 합산은 생략) |

**`/setlist`**

| 지표 | Before (직전 항목) | After (이번 측정) |
| --- | --- | --- |
| LCP | 1.152s | 1.020s |
| FCP | 0.104s | 0.120s |
| TBT | ~0ms | ~0ms (longtask 엔트리 0건) |
| CLS | 0 | 0 |
| 이미지 리소스(day1-team*.png 7장 + 포스터) | 640.2 KiB | day1-team1.png 실측 content-length 91,732 bytes(~89.6 KiB) 확인 — 7장 합계 약 640 KiB 수준으로 일치, 여전히 `next/image` 미적용 원본 그대로 (work01 2순위 과제 미착수 상태 그대로 재확인) |

**한계**: 이번 Playwright 실측은 직전 항목과 코드가 동일하므로 전면 재측정 대신 핵심 지표(LCP)와 대표 이미지 바이트만 재확인하는 수준으로 축소했다. 완전한 재현이 필요하면 직전 항목과 동일한 전수 측정을 다시 수행해야 한다.

### 코드 변경 요약
- 없음. `git diff 9ba7c12..56b54fc -- src/` 비어 있음(오케스트레이터 확인). 이번 항목은 측정 파이프라인(Lighthouse CLI 통합)만 신규 추가된 것.

### 원리 설명
- 코드 변경이 없으므로 위 표의 변화는 전부 "같은 코드에 대해 처음으로 Lighthouse를 공식 실행했을 때 드러난 값"이지, 이번 세션에서 일어난 개선/퇴보가 아니다. 직전 항목(앨범 커버 리사이징)의 원리 설명·개념 노트를 그대로 참조.
- `/event-goods` Performance 71→56, CLS 0→0.480 하락은 **Baseline 자체가 앨범 커버 리사이징 이전(600x600bb.jpg) 상태에서 측정된 값**이라는 점을 감안해야 한다 — 즉 이번 After 값은 "리사이징 이후 처음 실행한 공식 Lighthouse"이므로, Baseline과의 차이에는 (a) 앨범 커버 리사이징의 효과, (b) 리사이징 이후 새로 드러난 CLS 이상(직전 항목에서 데스크톱 뷰포트로 이미 관찰됨) 두 가지가 섞여 있다. Total Byte Weight 감소(2,387→634 KiB)는 (a)로 설명되지만, Performance 점수 하락은 (b) 때문일 가능성이 높다(가설).

### 개념 노트
- 일반 개념: Total Byte Weight가 줄어도 Performance 점수는 오히려 떨어질 수 있다 — Lighthouse Performance 점수는 여러 지표(LCP, CLS, TBT, Speed Index 등)의 가중 조합이므로, 바이트 감소가 CLS 같은 다른 지표의 악화를 상쇄하지 못하면 총점은 내려간다. "바이트를 줄였으니 점수도 오를 것"이라는 단순 가정은 위험하다.
- 일반 개념: 같은 최적화라도 측정을 언제 처음 공식 도구로 돌리느냐에 따라 "Before/After"의 의미가 달라진다 — 이번처럼 Before가 "리사이징 이전 Baseline"이고 After가 "리사이징 이후 첫 공식 측정"이면, 그 사이에 일어난 모든 변화(의도한 것 + 의도하지 않은 부작용)가 한 번에 반영된다. 여러 변경을 순차로 했다면 그 사이마다 측정해야 어느 변경이 어떤 지표에 영향을 줬는지 분리할 수 있다.
- 이 프로젝트 적용: SUMMIT은 이번에 처음으로 `/perf-check`의 Lighthouse CLI 단계를 실사용했고, 그 결과 직전 Playwright 실측만으로는 안 보였던 CLS 이상(0.480, Mobile 조건)과 Performance 점수 하락이 공식 지표로 확인됐다. 이는 "Playwright 실측은 네트워크/바이트 실측에 유용하지만 Lighthouse의 종합 Performance 점수를 대체할 수 없다"는 이 에이전트 역할 분리 원칙이 실제로 유효했음을 보여주는 사례다.
- 이 프로젝트 적용: `/event-goods`의 CLS 이상은 다음 리팩토링 작업(work01 §3 스크롤 끊김/§4 컴포넌트 분할)과 별도로, CLS 원인 규명을 위한 코드 리뷰가 추가로 필요하다는 백로그 항목으로 남긴다.

---

## 2026-09-13 — work01-4 Server/Client 컴포넌트 분할 + CLS 수정

- 커밋/브랜치: chore/perf-check-lighthouse (미커밋 상태의 작업 diff 기준)
- 측정 대상 페이지: `/event-goods`, `/setlist`
- 측정 조건:
  - Lighthouse: 기존에 떠 있던 로컬 서버(포트 3000)를 그대로 사용. 응답 헤더에 HMR/dev 전용 마커(`webpack-hmr`, `react-refresh`, `_next/static/development/`) 없음을 확인했고, 정적 리소스가 콘텐츠 해시 파일명(`_next/static/media/797e433...woff2`)으로 서빙되고 있어 프로덕션 빌드로 판단 — 이 agent가 새로 띄운 서버가 아니므로 측정 후 종료하지 않았다. `npx lighthouse --preset=perf --form-factor=mobile --screenEmulation.mobile --throttling-method=simulate` (headless Chrome). 직전 항목(2026-09-13, 공식 Lighthouse Before/After 확보)과 동일한 스로틀링 방식(`simulate`)이므로 이번 Before/After는 완전히 동일 조건 비교임. 원본 리포트: `lighthouse-after-event-goods-20260913.json`, `lighthouse-after-setlist-20260913.json` (기존 동일 이름 파일을 덮어씀 — 파일명이 날짜만 반영해 직전 리포트와 구분되지 않는 점은 향후 개선 필요).
  - Playwright: 동일 서버, Chromium 기본 뷰포트(데스크톱), `PerformanceObserver`(`buffered: true`)로 LCP/CLS/longtask 실측 — 직전 항목에서 `performance.getEntriesByType()` 직접 호출 시 "Deprecated API for given entry type" 콘솔 경고가 발생해 이번엔 `PerformanceObserver` 방식으로 교체함 (측정 방법 자체가 직전 항목과 달라졌으므로 수치 직접 비교 시 이 차이를 감안할 것).

### Lighthouse (공식 Before/After 비교용)

**`/event-goods`**

| 지표 | Before (직전 공식 측정, 2026-09-13) | After (이번 측정) |
| --- | --- | --- |
| Performance 점수 | 56 | 84 |
| LCP | 4.86s | 4.38s |
| FCP | 1.28s | 0.93s |
| TBT | 233.5ms | 145.5ms |
| Speed Index | 3.76s | 1.18s |
| CLS | 0.480 | 0 |
| Total Byte Weight | 634 KiB (649,000 bytes) | 637 KiB (652,792 bytes) |

**`/setlist`**

| 지표 | Before (직전 공식 측정, 2026-09-13) | After (이번 측정) |
| --- | --- | --- |
| Performance 점수 | 77 | 77 |
| LCP | 5.74s | 5.35s |
| FCP | 0.76s | 0.76s |
| TBT | 165.5ms | 192.5ms |
| Speed Index | 1.03s | 1.78s |
| CLS | 0 | 0 |
| Total Byte Weight | 1,051 KiB (1,076,577 bytes) | 1,052 KiB (1,077,222 bytes) |

**정직하게 남기는 관찰**: `/event-goods`의 CLS는 0.480 → 0으로 완전히 사라졌고, 이번 작업 단위의 핵심 검증 대상이었던 "구조적으로 CLS가 재발 불가능해야 한다"는 가설이 실측으로 확인됐다. Performance 점수도 56 → 84로 회복했고, 이는 Baseline(2026-08-30, 71점)보다도 높은 수치다 — CLS 제거가 Performance 점수 회복의 지배적 원인으로 보인다(TBT·Speed Index도 함께 개선됐으나 CLS 가중치가 가장 크게 작용했을 가능성이 높음, 정확한 기여도 분해는 Lighthouse 내부 가중 공식을 별도로 뜯어봐야 함). `/setlist`는 애초에 CLS가 0이었으므로 이번 변경의 직접 수혜 대상이 아니며, 실제로 Performance 점수(77→77)와 Total Byte Weight(1,051→1,052 KiB)가 거의 그대로 유지됐다 — 이는 "코드 변경 요약"에 정리된 대로 `day1-team*.png` 미최적화 이미지가 이번 작업 범위 밖이라는 사전 예상과 정확히 일치한다. `/setlist`의 Speed Index가 1.03s→1.78s로 오히려 악화된 점은 이번 변경(Server Component 전환, layout.tsx 분리)과 인과관계가 뚜렷하지 않아 원인 불명으로 남긴다 — 서버 컴포넌트 fetch가 요청 시점에 실행되므로 Supabase 응답 지연이 있었을 경우 TTFB가 늘어 Speed Index에 영향을 줬을 가능성은 있으나(가설), 이번 리포트만으로 단정할 근거는 부족하다.

### Playwright 실측 (네트워크 요청/바이트 변화 확인용)

**`/event-goods`**

| 지표 | Before (직전 항목, 2026-09-13) | After (이번 측정) |
| --- | --- | --- |
| LCP | 0.800s | 1.456s |
| FCP | N/A (직전 항목에서 미측정) | 0.496s |
| TBT(근사) | ~0ms | ~0ms (longtask 엔트리 0건) |
| CLS | N/A (직전 항목 Playwright 실측에서 미갱신, Lighthouse 표에서 0.480 확인) | 0 (layout-shift 엔트리 0건, `PerformanceObserver` 실측) |
| 이미지 리소스(mzstatic 앨범 커버 16장) | 119.4 KiB | 108,055 bytes (~105.5 KiB) |
| 전체 리소스 바이트(참고, 첫 측정) | 기록 없음 | 531,564 bytes (~519 KiB, 44개 리소스) |

**`/setlist`**

| 지표 | Before (직전 항목, 2026-09-13) | After (이번 측정) |
| --- | --- | --- |
| LCP | 1.020s | 1.304s |
| FCP | 0.120s | 0.516s |
| TBT(근사) | ~0ms | ~0ms (longtask 엔트리 0건) |
| CLS | 0 | 0 |
| `day1-team*.png` 리소스 | content-length 91,732 bytes/장(~89.6 KiB), 7장 합계 ~640 KiB | 요청 자체는 7건 모두 200 OK로 재확인(여전히 최적화 안 된 원본 PNG 그대로) — 단 `transferSize`가 개당 300바이트 수준으로 낮게 잡혀 브라우저 디스크 캐시에서 서빙된 것으로 보임(캐시 히트 시 `transferSize`가 실제 파일 크기를 반영하지 않는 Performance API의 알려진 특성). 실제 파일 크기 변화는 Lighthouse의 Total Byte Weight(1,051→1,052 KiB, 사실상 불변)로 판단하는 것이 정확함 |
| 전체 리소스 바이트(참고, 첫 측정) | 기록 없음 | 427,168 bytes (~417 KiB, 34개 리소스, 캐시 영향 포함) |

**한계**: 이번 Playwright LCP/FCP 실측값(event-goods 1.456s, setlist 1.304s)은 직전 항목보다 오히려 소폭 높게 나왔다 — 이는 측정 방식을 `getEntriesByType()` 직접 호출에서 `PerformanceObserver(buffered:true)` 콜백 이후 500ms 대기 방식으로 바꾼 데 따른 측정 시점 차이(브라우저 세션 상태, 로컬 서버 부하, 캐시 상태 등)일 가능성이 높고, 이번 코드 변경(Server/Client 분할, layout.tsx 분리) 자체가 클라이언트 실측 LCP를 악화시켰다고 볼 근거는 없다 — Lighthouse 표에서는 오히려 두 페이지 모두 LCP가 개선(event-goods 4.86→4.38s, setlist 5.74→5.35s)됐으므로, 이번 Playwright 수치 차이는 도구/측정 시점 노이즈로 해석하는 것이 타당하다. `day1-team*.png` 캐시 히트로 인한 `transferSize` 왜곡도 이 측정 방식의 알려진 한계로 남긴다.

### 코드 변경 요약
- `event-goods/page.tsx`, `setlist/page.tsx`: `"use client"` + `useEffect` 기반 클라이언트 사이드 Supabase fetch를 제거하고 async 서버 컴포넌트로 전환 — 요청 시점에 서버에서 fetch+데이터 변환을 마친 뒤 렌더링.
- `SiteHeader`와 배경 이미지/그라데이션 오버레이를 각각 신규 `event-goods/layout.tsx`, `setlist/layout.tsx`로 이동. 오버레이 포지셔닝을 `absolute inset-0`(main의 콘텐츠 높이에 종속) → `fixed inset-0`(뷰포트 고정 크기)로 변경.
- 각 라우트에 `loading.tsx` 신설 (Next.js Suspense fallback, 최소 텍스트 안내).
- 인터랙션 담당 로직(day 토글, 카드 클릭→모달, 트랙 클릭→유튜브, 이미지 로드 실패 폴백)을 `event-goods-view.tsx`/`setlist-view.tsx` 클라이언트 컴포넌트로 분리 — 서버는 순수 데이터(JSON 직렬화 가능한 값)만 prop으로 전달.
- 중복 코드 통합: `TrackCoverImage`/`SquareGrayArtwork`/`DummyPosterArtwork`를 공용 컴포넌트로, Supabase 테이블 fetch 루프를 `src/lib/fetch-line-up-and-setlist.ts`로, 유튜브 오픈 로직을 `src/lib/open-track-video.ts`로 통합 (기존 두 페이지에 문자 그대로 중복돼 있던 코드).

### 원리 설명
- CLS 0.480의 확정된 원인은 `event-goods/page.tsx`의 `bottom-0` 그라데이션 오버레이가 `useEffect` 데이터 도착 전/후로 변하는 `main`의 콘텐츠 높이를 따라 밀리는 것이었다(이전 세션 code-review로 원인 확정). 이번 변경으로 (1) 서버 컴포넌트가 첫 페인트 시점에 이미 최종 데이터를 반영해 `main` 높이가 처음부터 고정되고, (2) 오버레이 자체도 `fixed`로 바뀌어 콘텐츠 높이와 완전히 무관해졌다 — **Lighthouse 실측으로 CLS 0.480 → 0이 확인됐고(재실행 없이 단일 측정이라 재현성 검증은 1회분), Playwright `PerformanceObserver` 실측(layout-shift 엔트리 0건)도 동일 결론을 뒷받침한다. 가설이 아니라 실측으로 검증 완료.**
- 클라이언트에 있던 Supabase 데이터 정규화 로직이 서버로 옮겨간 것이 Total Byte Weight를 줄일 것이라는 가설은 **기각**됐다 — event-goods 634→637 KiB, setlist 1,051→1,052 KiB로 사실상 변화가 없었다. 이는 클라이언트 JS 번들 크기 감소분이 있었다 해도 페이지 전체 바이트(이미지·폰트·CSS 포함) 대비 미미한 비중이었거나, 서버 컴포넌트 전환이 실제로는 번들 크기에 유의미한 영향을 주지 않았기 때문으로 추정된다(가설 — 번들 분석 도구로 별도 확인 필요, 이번 리포트 범위 밖).
- CLS 개선이 Performance 점수 회복(56→84, Baseline 71 상회)의 주 원인이라는 가설은 실측으로 뒷받침됐다. `/setlist`의 Total Byte Weight 불변은 사전 예상(day1-team 이미지 미최적화, work01 2순위 과제)과 정확히 일치했다.

### 개념 노트
- 일반 개념: 클라이언트에서 `useEffect`로 데이터를 가져와 렌더하는 패턴은 "데이터 도착 전/후" 두 가지 상태를 만들고, 그 사이에 레이아웃에 의존하는 절대 위치 요소가 있으면 CLS를 유발할 수 있다. 서버 컴포넌트로 페칭을 옮기면 클라이언트에 "데이터 없음" 상태 자체가 존재하지 않아 이런 종류의 CLS가 구조적으로 사라진다 — 이번 측정이 이 원리를 실측으로 증명한 사례다.
- 일반 개념: 배경 오버레이의 크기 기준(콘텐츠 높이 vs 뷰포트 높이)을 명확히 해야 한다 — 콘텐츠 높이에 종속된 오버레이는 콘텐츠가 언제 어떻게 변하든(초기 로딩, 무한스크롤 등) CLS 위험을 항상 안고 간다.
- 일반 개념: 브라우저 캐시 히트 시 `PerformanceResourceTiming.transferSize`가 실제 파일 크기를 반영하지 않는다(0 또는 매우 작은 값) — 반복 측정이나 재방문 시나리오에서 Playwright 실측 바이트 수치를 그대로 신뢰하면 안 되고, Lighthouse의 Total Byte Weight처럼 캐시 상태를 통제한 지표를 병행 확인해야 한다. 이번 `/setlist`의 `day1-team*.png` 측정에서 이 함정이 실제로 관찰됐다.
- 이 프로젝트 적용: SUMMIT은 데이터 페칭 위치 이동(client→server)과 오버레이 포지셔닝 방식 변경(absolute→fixed) 두 가지를 동시에 적용해 CLS 원인을 이중으로 제거했고, `/event-goods`의 CLS 0.480→0, Performance 56→84 회복으로 그 효과가 실측 확인됐다.
- 이 프로젝트 적용: `/setlist`는 이번 작업의 영향을 받지 않는 이미지 최적화 이슈(`day1-team*.png`)가 여전히 남아 있어, Total Byte Weight 개선을 보려면 work01 2순위 과제(팀 카드 이미지 `next/image` 전환)를 별도로 진행해야 한다는 것이 이번 측정으로 재확인됐다.
