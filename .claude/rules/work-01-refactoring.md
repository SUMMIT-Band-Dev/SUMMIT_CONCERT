# work01 — 리팩토링 (웹 성능 지표 개선)

> 이 문서는 **리팩토링/성능 개선(work01) 작업을 시작할 때만** 참조합니다.

## 상태

진행 중. Before 측정 및 원인 진단 완료 (`REFACTOR_NOTES.md`, `REFACTOR_HYPOTHESIS_LOG.md` 참조). 실제 수정 작업은 아직 미착수.

## 왜 최우선인가

산업기능요원 포트폴리오 지원 사이클(9~10월)에 직결되는 작업. Lighthouse 수치 자체는 "증빙"일 뿐 메인 스토리가 아니며, 진짜 가치는 **왜 문제가 발생했는지, 최초 가설이 왜 틀렸고 어떻게 수정됐는지를 설명할 수 있는 능력**에 있음 (`REFACTOR_HYPOTHESIS_LOG.md` 참조 — "public 폴더 문제"라는 최초 가설이 실제로는 외부 CDN 원본 이미지 문제로 판명된 과정).

## 서사 원칙

- SWYP와 서사 축이 겹치면 안 됨 — SUMMIT은 "AI 생성 코드 판단·재구조화" 축, SWYP는 "팀 환경 단독 오너십 + 데이터 기반 의사결정" 축
- "구축·운영했다"는 실제로 완료한 것만. 아직 측정 안 한 Result는 공란으로 남김
- 숫자만 나열하지 않고 인과관계(피드백 → 진단 → 원인 확정 → 개선)로 서술

## 작업 범위 (우선순위 순, `REFACTOR_NOTES.md` §5 기준)

1. **`/event-goods` 앨범 커버 이미지 리사이징** — 최우선. Apple Music CDN에서 600×600px 원본을 그대로 받고 있음(개당 60–190KB, 18개 합계 ~1.9MB). 실제 표시는 40–60px 썸네일. iTunes/Apple Music API의 작은 사이즈 파라미터(`100x100bb.jpg`) 사용 또는 `next/image` 프록시로 리사이징
2. **`public` 폴더 팀 카드 이미지 → `next/image` 전환** — `day{1,2}-team*.png` 14개, 각 85–94KB. 현재 `next/image` 미적용 (일부 이미지는 이미 적용돼 있음, 팀 카드만 누락)
3. **스크롤 끊김 원인 특정** — DevTools Performance 탭으로 실제 스크롤 녹화. CLS는 0으로 측정되어 레이아웃 시프트가 원인이 아님은 확인됨. 이미지 디코딩 비용 또는 `FadeInUp`(framer-motion) 애니메이션의 메인 스레드 점유가 유력 후보
4. **Server/Client 컴포넌트 분할** — `setlist/page.tsx`(654줄), `event-goods/page.tsx`(539줄) 전부 `"use client"` + `useEffect` 데이터 페칭. `location/page.tsx` 패턴 참고해 데이터 페칭을 Server Component로 이동
5. **정리 작업** — `lib/src/lib/supabase.ts` 중복 파일 삭제, `dist/` 폴더 `.gitignore` 처리 후 레포에서 제거
6. **`@vercel/analytics` 설치** — 1학기엔 analytics 자체가 없어서 "실사용자에게 미친 영향"을 증명할 데이터가 없었음. 12월 정기공연 전 선반영 필요 (work03과도 연결)
7. **`/event-goods` 라우트 리네이밍** — 실제 콘텐츠는 셋리스트 전체보기라 `/setlist/all` 등으로 변경 검토 (우선순위 낮음)

## 정량 데이터 확보 원칙

- **Before**: 2026-08-30 기준선 확보 완료 (`lighthouse-before-*.{html,json}`, `REFACTOR_NOTES.md` §2)
- **After**: 리팩토링 완료 후 동일 조건(Mobile, Navigation, Incognito)으로 재측정, `REFACTOR_NOTES.md`에 기록
- PostHog/Vercel Analytics로 12월 정기공연 시점 방문자 흐름(전환율, 이탈 지점) 추적 — 가능하면 지원 시점 전에도 일부 정량 근거 확보

## 판단 기준

- 백엔드(work02) Phase 1(최소 API 1개)은 이 작업과 병행 가능하지만, 조금이라도 이 작업의 진행을 늦추면 즉시 중단하고 work02 Phase 2로 이월
- 추측으로 바로 실행하지 말 것 — 계측(Lighthouse, Network 탭) 먼저, 실행은 그다음. `REFACTOR_HYPOTHESIS_LOG.md`가 이 원칙이 실제로 어떻게 적용됐는지 보여주는 근거 문서
