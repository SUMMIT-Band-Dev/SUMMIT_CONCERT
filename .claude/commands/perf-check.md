---
description: 성능 개선 작업 단위가 끝났을 때 수동으로 실행 — Playwright로 After 지표를 재측정하고 PERFORMANCE_LOG.md에 append한다.
---

이 커맨드는 사용자가 성능 관련 코드 변경을 끝내고 커밋 직전에 **수동으로만** 호출한다. 파일 저장이나 커밋에 자동으로 걸리지 않는다.

## 절차

1. **Before 확인**: `PERFORMANCE_LOG.md`를 읽고 가장 마지막 항목을 Before로 삼는다. 항목이 Baseline뿐이면 Baseline을 Before로 쓴다. 측정 조건(디바이스/네트워크/dev·prod)도 같이 확인해서 그대로 재현할 조건을 정한다.

2. **원리 분석 (오케스트레이터가 직접 수행)**: `git diff` / `git log`로 이번 작업 단위에서 실제로 무엇이 바뀌었는지 확인한다. 추측하지 말고 diff에 있는 근거로만 "코드 변경 요약"과 "원리 설명"을 작성한다. 지표가 왜 움직일 것으로 예상되는지 인과관계로 쓰고, 확신이 없는 부분은 "가설:"로 표기한다. 재사용 가능한 "개념 노트"(일반 개념 + 이 프로젝트 적용 사례)도 이 단계에서 같이 정리한다.

3. **After 측정 (qa-tester 에이전트에 위임)**: `qa-tester` 서브에이전트를 호출해 다음을 전달한다:
   - 측정 대상 페이지
   - Before 값과 Before 측정 조건 (동일 조건으로 재현해야 함)
   - 2단계에서 정리한 코드 변경 요약 / 원리 설명 / 개념 노트 텍스트
   - 지시 (Lighthouse — 공식 Before/After 비교용): 프로덕션 서버가 실제로 떠 있는지(단순 포트 응답이 아니라 dev 서버 마커 유무까지) 확인하고, 아니면 `npm run build && npm start`로 새로 띄운 뒤 `npx lighthouse [URL] --preset=perf --form-factor=mobile --screenEmulation.mobile --throttling-method=simulate --output=json --output-path=[경로]`를 실행할 것. 결과 JSON에서 `categories.performance.score`, LCP/FCP/TBT/Speed Index/CLS/Total Byte Weight를 추출할 것. 자신이 새로 띄운 서버는 측정 후 반드시 종료할 것.
   - 지시 (Playwright 실측 — 네트워크 요청/바이트 변화 확인용): 기존과 동일하게 Playwright MCP로 LCP/CLS/FCP/TBT(근사)와 실제 네트워크 요청/바이트를 실측할 것.
   - 지시 (기록): 두 결과를 **하나로 합치지 말고** `PERFORMANCE_LOG.md` 항목 템플릿의 Lighthouse 섹션 / Playwright 섹션에 각각 채워 파일 최하단에 append까지 완료할 것 (기존 항목 수정 금지).

4. **완료 확인**: qa-tester가 append를 완료하면 결과를 그대로 신뢰한다 (다시 읽어서 검증할 필요 없음 — Edit이 실패했다면 에러가 났을 것).

5. **대화창 출력**: 대화창에는 Before/After 표와 한두 줄 요약만 출력한다. 원리 설명, 개념 노트, 커밋/브랜치 정보 등 나머지 세부 내용은 전부 `PERFORMANCE_LOG.md`에 위임하고 대화창에 다시 나열하지 않는다.

## 하지 말 것

- 자동 실행 금지 — 사용자가 `/perf-check`를 명시적으로 호출했을 때만 동작한다. 파일 저장/커밋 훅에 연결하지 않는다.
- 측정 조건이 Before와 다른데 조용히 비교표만 채우는 것 금지 — 조건이 다르면 그 사실을 표/기록에 명시하고, 필요하면 사용자에게 조건을 맞출지 물어본다.
- 지표가 악화됐을 때 포장하거나 누락하는 것 금지 — 악화도 그대로 기록하고, 원리 설명에서 왜 악화됐는지(또는 원인 불명이면 그것도) 정직하게 남긴다.
- Performance 점수/Speed Index를 Lighthouse 리포트 없이 임의로 추정해서 채우는 것 금지.
- Lighthouse 실측과 Playwright 실측을 하나의 표로 통합하는 것 금지 — 역할(공식 비교용 vs 네트워크/바이트 실측용)이 다르므로 항상 별도 섹션에 남긴다.
