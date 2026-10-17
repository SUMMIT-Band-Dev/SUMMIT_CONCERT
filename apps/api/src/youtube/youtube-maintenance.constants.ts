/**
 * 예약(`reserved`) 행이 이 시간을 넘기면 크래시 잔재로 보고 `failed`로 정리한다.
 * 타임아웃 5초의 120배 여유. 정리된 행은 `completedAt`이 NULL이라 곡별 연속 실패수에
 * 들어가지 않는다(미완료 예약의 판정 규칙).
 */
export const YOUTUBE_RESERVATION_STALE_MINUTES = 10;

/**
 * 후보 보관 상한(일).
 *
 * ⚠️ **해석 주의**: YouTube 개발자 정책이 비인증 데이터를 *"not longer than 30 calendar days"*
 * 보관하도록 하고 이후 *"must either delete or refresh"* 를 요구한다. 이 조항이 검색 결과
 * 메타데이터에 적용된다는 것은 **구현자의 해석이며 법적 확인을 받지 않았다.**
 */
export const YOUTUBE_RETENTION_DAYS = 30;
