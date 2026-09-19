-- 유튜브 추천 검토 상태 컬럼 추가 (PRD F011~F013, work02-6 1/2)
--
-- [배경]
-- PRD 데이터 모델의 youtubeReviewStatus를 이제야 추가한다. 2~5단계에서는 계속 보류했는데,
-- 컬럼만 먼저 만들면 아무도 읽지 않는 상태 값이 프로덕션 스키마에 남기 때문이었다
-- (REFACTOR_NOTES §9·§10·§12·§13). 이번 단계에서 F013이 이 컬럼에 쓰기 시작하므로 함께 추가한다.
--
-- [타입 선택] text + CHECK가 아니라 Postgres enum이다.
-- Prisma가 TS 유니온 타입을 생성해 상태 전이 코드가 컴파일 타임에 검증되고, 값 오타가
-- DB에 닿기 전에 걸린다. 값 추가는 ALTER TYPE ADD VALUE로 가능하고(단 같은 트랜잭션에서
-- 그 값을 쓸 수 없어 별도 마이그레이션이 필요하다), 제거·개명은 어렵다.
-- PRD가 정한 닫힌 집합(pending/approved/rejected)이라 이 비용을 감수한다.
--
-- [CHECK 제약을 걸지 않은 이유]
-- "approved면 youtube_url이 있어야 한다"는 불변식을 DB 제약으로 걸고 싶어지지만 걸지 않는다.
-- work03에서 콘텐츠를 콘솔/CSV로 대량 삽입할 때 기본값이 pending이라 URL이 있는 행도
-- pending으로 들어가는데, CHECK가 있으면 그 삽입이 통째로 실패한다. 불변식은 서비스 코드로 지킨다.
--
-- [원자성] 이 파일은 통째로 하나의 트랜잭션에서 실행된다 — 실측으로 확인했다.
-- Prisma의 apply_migrations는 파일 전문을 한 문자열로 connector.apply_script에 넘기고,
-- quaint의 postgres raw_cmd는 tokio-postgres simple_query를 호출한다. Postgres는 세미콜론으로
-- 구분된 멀티스테이트먼트 simple Query를 암묵적 트랜잭션 블록으로 실행하며, 도중 실패하면
-- 앞 문장까지 자동 롤백한다. 따라서 "컬럼만 생기고 백필이 빠진 상태"는 발생하지 않는다.
--
-- [lock_timeout] 위 암묵적 트랜잭션 블록 덕분에 SET LOCAL이 유효하고, 블록이 끝나면
-- 자동으로 원복되어 세션에 남지 않는다(같은 DIRECT_URL 경로에서 실측 확인).
-- 락 대기로 공개 프론트의 조회가 밀리는 것을 막되, 못 잡으면 차라리 실패하고 다시 시도한다.
SET LOCAL lock_timeout = '5s';

-- CreateEnum
CREATE TYPE "youtube_review_status" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable
-- Postgres 11+에서 상수 DEFAULT의 ADD COLUMN은 테이블을 재작성하지 않고 메타데이터만 바꾼다.
-- ACCESS EXCLUSIVE 락을 잡지만 64행/96kB라 점유 시간은 무시할 수 있다.
ALTER TABLE "Setlist" ADD COLUMN     "youtube_review_status" "youtube_review_status" NOT NULL DEFAULT 'pending';

-- 백필: 기존에 사람이 검토해 채운 링크는 approved로 본다 (예상 5건, 나머지 59건은 기본값 pending).
-- 이 5건은 1학기에 수동으로 확인해 넣은 값이라 "추천 대기" 상태로 두면 6단계 2/2의 배치
-- 재검색 대상에 잘못 포함된다. 빈 문자열은 현재 0건이지만 방어적으로 함께 제외한다.
UPDATE "Setlist"
SET "youtube_review_status" = 'approved'
WHERE "youtube_url" IS NOT NULL
  AND btrim("youtube_url") <> '';
