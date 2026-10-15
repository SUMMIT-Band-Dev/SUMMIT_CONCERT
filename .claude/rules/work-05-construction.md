# work05 — 공연 콘텐츠 관리 확장 + 유튜브 연결 관리 단순화

> 이 문서는 **어드민 페이지 기능 수정·확장 작업(work05)을 시작할 때만** 참조합니다.
> 상세 기능 명세는 `.claude/docs/prd-construction.md`를 기준으로 합니다.

## 상태

착수 (2026-10-15). 문서 작업(PRD 작성)부터 시작.

## 배경

- work02(Nest.js 백엔드 + 로그인 + 팀/곡 CRUD 어드민)와 work04(어드민 기능 수정)는 종료됨 — 이력은 `.claude/rules/history/` 참조
- 기존 어드민 PRD(`.claude/docs/prd-admin.md`)의 범위(팀 관리 · 곡 관리 · 유튜브 연결 관리)는 구현 완료로 종료하고, 이번 work05는 그 위에서 **기능을 수정·디벨롭**하는 작업
- 현재 어드민에서 다룰 수 있는 것은 팀/곡/유튜브 링크뿐이고, 나머지 공연 정보(포스터, 공연명, 장소, 날짜, 타임 테이블, 티켓, 유의사항, 예매 링크 등)는 **전부 공개 사이트 코드에 하드코딩**돼 있음 → 공연이 바뀔 때마다 코드 수정 + 재배포가 필요

### 하드코딩 현황 (2026-10-15 기준 코드 조사)

| 공개 페이지 | 하드코딩된 값 | 위치 |
| --- | --- | --- |
| Home | 메인 배경(`concert-poster-latest.png`), 타이틀 이미지(`hero-hanja.png`, `hero-subtitle.png`), 공연 제목, 장소, 날짜 | `src/app/page.tsx` |
| Stage Info | 공연장 외부 URL(`flexlounge.creatorlink.net`) | `src/components/sections/facility-service-section.tsx` |
| Time Table | 1·2일차 타임 테이블 이미지 2장 (`public/time-table-day*.png`) | `src/app/time-table/page.tsx` |
| Ticket Info | 티켓 앞/뒤 이미지, 요금 안내 · 여분 티켓 안내 · 공연 기본 정보 텍스트 | `src/app/ticket-info/page.tsx` |
| Contact Us (오시는 길) | 네이버 지도 링크, 주소 텍스트, 지도 좌표, 지도 말풍선(장소명/주소) | `src/app/location/page.tsx`, `src/components/common/naver-map.tsx` |
| 관람 유의사항 | 관객 안전 안내 · 주차 안내 항목 배열 | `src/app/notice/page.tsx` |
| 예매하기 | 일차별 날짜 라벨, 출연 팀 텍스트, 예매 링크(Google Forms) | `src/app/book/page.tsx` |

- 같은 정보가 여러 곳에 흩어져 있어 이미 **불일치가 발생한 상태**: 오시는 길 주소는 "마포구 양화로 100-10"인데 `naver-map.tsx` 말풍선 주소는 "관악구 남부순환로 1937". 포스터 이미지도 6개 페이지 배경에서 각각 경로를 직접 참조함
- 즉 이번 작업의 핵심은 "어드민 화면 추가"보다 **공연 정보를 한 곳(DB)에서 관리하는 단일 출처로 옮기는 것**

## 목표

1. **공연 콘텐츠 관리 확장** — 공개 사이트의 모든 공연 요소(이미지 + 텍스트 + 링크)를 어드민에서 수정하면 재배포 없이 사이트에 반영
2. **유튜브 연결 관리 단순화** — 리뷰 대기/승인/반려 상태 기반 워크플로우를 걷어내고, "곡별로 어떤 영상이 연결돼 있는지 보고 → 수정 버튼 → URL 입력 → 저장"만 남김

## 작업 범위

### A. 공연 콘텐츠 관리 (신규)

| 대상 | 관리 항목 |
| --- | --- |
| Home | 메인 배경 이미지, 공연 제목, 공연 장소, 공연 날짜 |
| Stage Info | 공연장 외부 링크 URL |
| Time Table | 일차별 타임 테이블 이미지 교체 |
| Ticket Info | 티켓 앞/뒤 이미지, 요금 안내 상세 설명 |
| Contact Us | 장소명, 주소, 지도 좌표, 네이버 지도 링크 (장소 변경 시 지도까지 함께 바뀜) |
| 관람 유의사항 | 섹션별 안내 항목 작성·수정 → 사이트 자동 반영 |
| 예매하기 | 일차별 예매 링크, 날짜/출연진 텍스트 |

### B. 유튜브 연결 관리 개편 (수정)

- 곡 목록에서 **현재 연결된 영상**(없으면 "미연결")을 한눈에 확인
- **수정하기** 버튼 → URL 입력 → 저장으로 끝나는 단일 플로우
- 리뷰 대기/승인됨/반려됨 탭, 배치 추천 검색, 반려 사유, 재검토 대기열 등 상태 기반 UI는 제거 대상

## 판단 기준 / 주의사항

- **공개 사이트 성능 회귀 금지**: 지금은 정적 이미지(`public/`) + Server Component라 빠름. DB 조회로 바꾸면서 LCP가 나빠지면 work01 성과를 깎아먹음 → 콘텐츠는 Server Component에서 조회하고, 캐시/재검증 전략을 구현 단계에서 먼저 정한다 (`next/image` 최적화 유지, 메인 배경 `priority` 유지)
- **저장 즉시 반영의 의미를 구현 전에 확정**: "자동으로 변경"을 실시간으로 볼지, 저장 시 재검증(on-demand revalidation)으로 볼지 결정 필요
- **유튜브 개편 시 DB 정리 범위 확인**: `youtube_review_status` 컬럼, `youtube_review_state` 등 리뷰용 테이블/enum과 배치·쿼터 서비스(`apps/api/src/youtube/`)를 바로 삭제할지, 쓰지 않는 상태로 남길지 결정. 프로덕션 DB 변경은 기존 원칙대로 신중하게 (migrate dev 금지)
- **새 API는 PRD 범위만**: 공연 콘텐츠 관리에 필요한 것 외의 권한 세분화·버전 관리·승인 플로우는 만들지 않음 (과설계 방지)
- **좌표 입력 방식**: 임원진이 위도/경도를 직접 입력하기 어려우므로, 주소 → 좌표 변환 방식을 구현 단계에서 검토
- 기술 스택은 기존 어드민과 동일 (`apps/admin` + `apps/api`, Supabase Storage). 이미지 업로드는 work02-5 카드뉴스 업로드(`apps/api/src/storage/`) 구조를 재사용

## 관련 문서

- `.claude/docs/prd-construction.md` — work05 PRD (상세 기능 명세)
- `.claude/docs/prd-admin.md` — 종료된 이전 어드민 PRD (기존 기능 참고용)
- `.claude/rules/history/work-04-admin.md` — 종료된 work04
- `REFACTOR_NOTES.md` §13(이미지 업로드), §14·§15(유튜브 검토 상태·배치 추천)
