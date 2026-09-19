-- 롤백 SQL — 20260920120000_add_youtube_review_status
--
-- ⚠️ 이 파일은 적용하지 않는다. 문제가 생겼을 때 참고할 절차만 기록해 둔 문서다.
-- Prisma는 이 디렉터리를 마이그레이션으로 인식하지 않는다 (prisma/migrations 밖).
--
-- ⛔ 안전 기간: **6단계 2/2(F011/F012)가 이 컬럼에 쓰기 시작하기 전까지만 안전하다.**
--    그 시점 이후의 DROP COLUMN은 관리자가 승인/반려한 검토 이력을 통째로 지우며,
--    youtube_url이 NULL인 곡의 "반려됨(재검색 제외)" 정보는 다른 어디에도 없어 복구할 수 없다.
--    2/2 착수 이후에 되돌려야 한다면, DROP 대신 컬럼을 남겨둔 채 애플리케이션 코드만
--    되돌리는 쪽을 먼저 검토한다.
--
-- 지금(1/2 완료 시점) 기준으로 DROP이 잃는 정보는 "URL 유무로 다시 계산할 수 있는 값"뿐이다:
--   approved = youtube_url 있음(5건) / pending = 없음(59건). 그래서 이 기간에는 되돌려도 손실이 없다.

-- 1) 스키마 되돌리기
ALTER TABLE "Setlist" DROP COLUMN "youtube_review_status";
DROP TYPE "youtube_review_status";

-- 2) Prisma 이력 정리 (SQL이 아니라 CLI로 실행)
--    적용이 "실패로 기록된" 경우:   npx prisma migrate resolve --rolled-back 20260920120000_add_youtube_review_status
--    적용이 "성공으로 기록된" 경우: 위 1)을 실행한 뒤 _prisma_migrations에서 해당 행을 직접 삭제한다.
--      DELETE FROM "_prisma_migrations" WHERE migration_name = '20260920120000_add_youtube_review_status';
--    (성공 기록에는 migrate resolve --rolled-back 이 동작하지 않는다)
--
-- 3) 코드 되돌리기: prisma/schema.prisma의 youtubeReviewStatus 필드와 YoutubeReviewStatus enum 제거 후
--    npx prisma generate. 마이그레이션 디렉터리도 함께 지운다(체크섬 불일치 방지).
