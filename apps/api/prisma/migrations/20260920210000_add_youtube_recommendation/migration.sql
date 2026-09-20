-- 유튜브 배치 추천 검색 결과 저장 구조 (PRD F011/F012, work02-6 2/2)
--
-- [배경]
-- 6단계 1/2은 Setlist.youtube_review_status(pending/approved/rejected) 하나만 추가했다.
-- 값이 3개뿐이라 "아직 검색하지 않음"과 "검색했으나 결과 0건"과 "검색됐고 리뷰 대기"를
-- 구분하지 못한다(§14 "남겨둔 결정"). 그래서 시도 기록과 후보를 별도 테이블로 나눈다.
--
-- [테이블 2개로 나눈 이유]
-- 곡당 후보 N행짜리 단일 테이블로는 "검색했는데 결과가 0건"을 표현할 행이 없다.
-- YoutubeSearchAttempt가 "시도했다"는 사실을, YoutubeRecommendation이 "무엇을 찾았나"를 갖는다.
--
-- [예약 기록]
-- outcome 기본값이 'reserved'인 것은 크래시 대비다. 외부 호출 '전에' 행을 커밋해 두면,
-- 호출 도중 프로세스가 죽어도 그 행이 남아 일일 쿼터 집계에 포함된다.
-- 쿼터를 실제보다 적게 세는 것이 많이 세는 것보다 위험하다(하루 100회뿐이다).
-- 10분 넘게 reserved로 남은 행은 배치 시작 시 failed로 정리한다(타임아웃 5초의 120배 여유).
--
-- [CHECK 제약을 여기에는 거는 이유]
-- §14는 Setlist에 CHECK를 걸지 않았다. work03의 콘솔/CSV 대량 삽입이 통째로 실패하기
-- 때문이었다. 이 두 테이블은 work03이 삽입하지 않고 우리 서비스 코드만 쓰므로 그 비용이 없다.
-- 같은 판단 기준에서 결론만 반대로 나온 것이다.
--
-- [approvedVideoId가 없는 이유]
-- YouTube 개발자 정책이 비인증 API 데이터의 보관을 30일로 제한하고 이후 삭제 또는 갱신을
-- 요구한다(해석은 구현자의 것이며 법적 확인을 받지 않았다 — REFACTOR_NOTES 참조).
-- 그래서 후보 행은 리뷰가 끝나는 순간 전량 삭제하고, 시도 행에는 등수(approvedRank)만 남긴다.
-- 승인된 videoId는 Setlist.youtube_url에만 존재한다. 30일이 지나면 이 두 테이블에
-- YouTube가 준 문자열(videoId/title/channelTitle/thumbnailUrl)은 하나도 남지 않는다.
--
-- [원자성] 이 파일은 통째로 하나의 암묵적 트랜잭션에서 실행된다 (§14에서 실측 확인).
-- 도중 실패하면 앞 문장까지 자동 롤백되므로 "테이블만 생기고 REVOKE가 빠진 상태"는 없다.
--
-- [lock_timeout] 아래 FK 생성이 참조 대상인 Setlist에 SHARE ROW EXCLUSIVE 락을 잡는다.
-- 이 락은 ACCESS SHARE(공개 프론트의 SELECT)와 충돌하지 않으므로 방문자 조회는 막히지 않고,
-- 관리자 쓰기만 잠깐 대기한다. 그래도 못 잡으면 차라리 실패하고 다시 시도한다.
SET LOCAL lock_timeout = '5s';

-- CreateEnum
-- reserved = 외부 호출 직전에 예약된 상태(아직 결과 없음). 위 [예약 기록] 참조.
CREATE TYPE "youtube_search_outcome" AS ENUM ('reserved', 'searched', 'no_results', 'failed');

-- CreateEnum
-- closed = 리뷰 대상이 아님(볼 후보가 존재하지 않음). expired = 30일 경과로 정리됨.
CREATE TYPE "youtube_review_state" AS ENUM ('open', 'approved', 'rejected', 'superseded', 'expired', 'closed');

-- CreateTable
CREATE TABLE "YoutubeSearchAttempt" (
    "id" BIGSERIAL NOT NULL,
    "songId" BIGINT NOT NULL,
    -- 실제로 보낸 검색어. 우리 입력이라 30일 보관 제한 대상이 아니다.
    "query" TEXT NOT NULL,
    -- 예약 시각 = 쿼터 집계의 유일한 원천. 태평양 시간 자정 경계로 센다.
    "searchedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),
    "outcome" "youtube_search_outcome" NOT NULL DEFAULT 'reserved',
    "reviewState" "youtube_review_state" NOT NULL DEFAULT 'closed',
    "candidateCount" SMALLINT NOT NULL DEFAULT 0,
    -- 승인한 후보의 등수. 후보 행은 승인 시점에 삭제되므로 참조 대상이 없는 기록값이다.
    "approvedRank" SMALLINT,
    "rejectedReason" TEXT,
    "reviewedAt" TIMESTAMPTZ(6),
    -- 곡 제목/가수가 실제로 바뀌었거나 관리자가 재큐하면 찍힌다. 찍힌 행은 배치 선정에서
    -- 제외 판단에 쓰이지 않는다(= 곡이 대상으로 복귀한다). 쿼터 집계에는 계속 포함된다.
    "invalidatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "YoutubeSearchAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YoutubeRecommendation" (
    "id" BIGSERIAL NOT NULL,
    "attemptId" BIGINT NOT NULL,
    "rank" SMALLINT NOT NULL,
    "score" INTEGER NOT NULL,
    "videoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "channelTitle" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,

    CONSTRAINT "YoutubeRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- 배치 선정의 "마지막 시도 시각" 계산과 곡별 이력 조회에 쓴다.
CREATE INDEX "YoutubeSearchAttempt_songId_searchedAt_idx" ON "YoutubeSearchAttempt"("songId", "searchedAt" DESC);

-- CreateIndex
-- 리뷰 대기 목록 조회.
CREATE INDEX "YoutubeSearchAttempt_reviewState_idx" ON "YoutubeSearchAttempt"("reviewState");

-- CreateIndex
-- 일일 쿼터 집계와 30일 경과 정리.
CREATE INDEX "YoutubeSearchAttempt_searchedAt_idx" ON "YoutubeSearchAttempt"("searchedAt");

-- CreateIndex
-- 같은 시도 안에서 등수가 겹치지 않게 한다. attemptId가 선두라 조인 인덱스도 겸한다.
CREATE UNIQUE INDEX "YoutubeRecommendation_attemptId_rank_key" ON "YoutubeRecommendation"("attemptId", "rank");

-- AddForeignKey
-- 곡 삭제 API가 없으므로 NO ACTION (§11·§12의 Setlist.teamId와 같은 방침).
ALTER TABLE "YoutubeSearchAttempt" ADD CONSTRAINT "YoutubeSearchAttempt_songId_fkey"
    FOREIGN KEY ("songId") REFERENCES "Setlist"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
-- 시도가 후보를 소유하는 관계라 CASCADE. 후보만 남는 고아 행이 생길 수 없다.
ALTER TABLE "YoutubeRecommendation" ADD CONSTRAINT "YoutubeRecommendation_attemptId_fkey"
    FOREIGN KEY ("attemptId") REFERENCES "YoutubeSearchAttempt"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddCheckConstraint
-- outcome과 reviewState의 조합을 DB가 강제한다.
-- searched면 볼 후보가 있었다는 뜻이라 closed일 수 없고,
-- reserved/no_results/failed면 볼 것이 없으므로 항상 closed다.
ALTER TABLE "YoutubeSearchAttempt" ADD CONSTRAINT "YoutubeSearchAttempt_state_valid" CHECK (
    CASE WHEN "outcome" = 'searched'
         THEN "reviewState" <> 'closed'
         ELSE "reviewState" = 'closed'
    END
);

-- AddCheckConstraint
-- 승인이면 등수가 반드시 있고, 승인이 아니면 반드시 없다.
ALTER TABLE "YoutubeSearchAttempt" ADD CONSTRAINT "YoutubeSearchAttempt_approved_rank_valid" CHECK (
    ("reviewState" = 'approved') = ("approvedRank" IS NOT NULL)
);

-- AddCheckConstraint
-- 반려 사유는 반려일 때만 남는다.
ALTER TABLE "YoutubeSearchAttempt" ADD CONSTRAINT "YoutubeSearchAttempt_rejected_reason_valid" CHECK (
    "rejectedReason" IS NULL OR "reviewState" = 'rejected'
);

-- AddCheckConstraint
-- 등수는 1부터. 상한(후보 수)은 애플리케이션이 소유한다 — 후보 수를 바꿀 때마다
-- 프로덕션 마이그레이션이 필요해지지 않게 한다.
ALTER TABLE "YoutubeRecommendation" ADD CONSTRAINT "YoutubeRecommendation_rank_positive" CHECK ("rank" >= 1);

-- Supabase는 public 스키마의 신규 테이블/시퀀스에 anon·authenticated 권한을 기본 부여한다
-- (pg_default_acl 실측: 테이블 arwdDxtm, 시퀀스 rwU). §9와 같은 이유로 RLS를 켜되,
-- RLS는 TRUNCATE에 적용되지 않으므로 권한 자체도 회수한다 — AdminUser에는 비어 있는
-- 방어 계층이고(§10 "7단계 전 확인 항목"), 새 테이블은 지금 닫는 비용이 0이다.
-- Nest.js가 쓰는 postgres 롤은 rolbypassrls=true이고 소유자라 영향받지 않는다.
ALTER TABLE "YoutubeSearchAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "YoutubeRecommendation" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "YoutubeSearchAttempt" FROM anon, authenticated;
REVOKE ALL ON TABLE "YoutubeRecommendation" FROM anon, authenticated;

-- 시퀀스 이름은 하드코딩하지 않는다. "Line Up"의 시퀀스가 개명 흔적 때문에
-- setlist_id_seq였던 선례(§11)가 있어, 이름을 가정하면 조용히 빗나갈 수 있다.
-- 찾지 못하면 예외를 던져 파일 전체를 롤백시킨다 — 권한이 열린 채로 넘어가지 않게.
DO $$
DECLARE
    attempt_seq TEXT;
    recommendation_seq TEXT;
BEGIN
    attempt_seq := pg_get_serial_sequence('"YoutubeSearchAttempt"', 'id');
    recommendation_seq := pg_get_serial_sequence('"YoutubeRecommendation"', 'id');

    IF attempt_seq IS NULL OR recommendation_seq IS NULL THEN
        RAISE EXCEPTION '신규 테이블의 id 시퀀스를 찾지 못했습니다. 권한 회수를 건너뛸 수 없어 중단합니다.';
    END IF;

    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM anon, authenticated', attempt_seq);
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM anon, authenticated', recommendation_seq);
END
$$;
