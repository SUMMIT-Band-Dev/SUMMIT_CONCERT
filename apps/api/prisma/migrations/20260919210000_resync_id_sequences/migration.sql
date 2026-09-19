-- id 시퀀스를 실제 최대 id에 맞춘다.
--
-- 배경: "Line Up"(15행)과 "Setlist"(64행)의 기존 데이터는 Supabase 콘솔/CSV로
-- id를 명시해 넣어져서 BIGSERIAL 시퀀스가 함께 전진하지 않았다. 그 결과
-- nextval()이 이미 존재하는 id를 돌려주고, INSERT가 PK 중복으로 실패한다.
--
-- 2026-09-19 work02-3 런타임 검증 중 실측한 상태:
--   "Line Up"   max(id)=15 인데 시퀀스 last_value=7  (is_called=true)  → 다음 id 8  충돌
--   "Setlist"   max(id)=64 인데 시퀀스 last_value=1  (is_called=false) → 다음 id 1  충돌
--   "AdminUser" max(id)=1  시퀀스 last_value=1       (is_called=true)  → 정상(Prisma로 삽입)
--
-- 이 마이그레이션은 **행을 전혀 건드리지 않는다**. 시퀀스 위치만 앞으로 옮기므로
-- 이미 쓰인 id가 재사용될 위험도 없다.
--
-- 시퀀스 이름을 직접 쓰지 않고 pg_get_serial_sequence로 찾는 이유:
-- "Line Up"의 시퀀스는 테이블이 Setlist에서 개명된 흔적이라 이름이 setlist_id_seq다
-- (PK 제약 이름이 setlist_pkey인 것과 같은 이유).
--
-- COALESCE/세 번째 인자(is_called) 조합은 빈 테이블도 안전하게 처리하기 위한 표준 관용구다.
-- 행이 없으면 setval(seq, 1, false) → 다음 nextval이 1이 된다.

SELECT setval(
  pg_get_serial_sequence('"Line Up"', 'id'),
  COALESCE(MAX(id), 1),
  MAX(id) IS NOT NULL
) FROM "Line Up";

SELECT setval(
  pg_get_serial_sequence('"Setlist"', 'id'),
  COALESCE(MAX(id), 1),
  MAX(id) IS NOT NULL
) FROM "Setlist";
