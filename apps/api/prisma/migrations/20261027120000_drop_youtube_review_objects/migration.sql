-- 유튜브 리뷰 DB 객체 제거 (work05 T7)
--
-- [배경] PRD 확정 사항 #6에 따라 T1에서 미사용으로 남긴 리뷰 객체를 배포·안정화 후 제거한다.
-- [배포 순서] 구현 PR 머지 → Lightsail API 재배포 → 사용자가 이 마이그레이션 적용.
-- 기존 Prisma 클라이언트는 Setlist 조회 시 검토 상태 컬럼도 읽으므로 반드시 코드부터 배포한다.
-- [원자성] 파일 전문은 하나의 암묵적 트랜잭션으로 실행된다. 도중 실패하면 앞 문장도 롤백된다.
-- 근거는 20260920120000_add_youtube_review_status/migration.sql의 실측 주석을 따른다.
-- [lock_timeout] 시도 테이블 제거는 FK 때문에 참조 대상 Setlist에도 ACCESS EXCLUSIVE를 잡는다.
-- Setlist 컬럼 제거도 ACCESS EXCLUSIVE를 잡아 공개 사이트 조회가 잠깐 막힐 수 있다.
-- 메타데이터 변경으로 짧게 끝나지만, 락을 5초 안에 얻지 못하면 실패시켜 대기를 제한한다.
-- [데이터 손실] 2026-10-27 명세 작성 시 두 테이블이 0행임을 확인했다. 실행 직전에도 검사한다.
-- 검토 상태 값은 지워지지만 T1 이후 읽거나 쓰는 코드가 없다. 실제 유튜브 URL 컬럼은 유지한다.
SET LOCAL lock_timeout = '5s';

DO $$
DECLARE
    has_rows BOOLEAN;
BEGIN
    SELECT EXISTS (SELECT 1 FROM "YoutubeSearchAttempt")
        OR EXISTS (SELECT 1 FROM "YoutubeRecommendation")
      INTO has_rows;

    IF has_rows THEN
        RAISE EXCEPTION '행이 남아 있어 DROP을 중단합니다. apps/api/prisma/rollback/20261027120000_drop_youtube_review_objects.rollback.sql을 참고하고 상태를 확인하세요.';
    END IF;
END
$$;

DROP TABLE "YoutubeRecommendation";
DROP TABLE "YoutubeSearchAttempt";
ALTER TABLE "Setlist" DROP COLUMN "youtube_review_status";
DROP TYPE "youtube_review_state";
DROP TYPE "youtube_search_outcome";
DROP TYPE "youtube_review_status";
