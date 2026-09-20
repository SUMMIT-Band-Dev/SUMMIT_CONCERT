import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  YOUTUBE_BATCH_MAX_LIMIT,
  YOUTUBE_BATCH_DEFAULT_LIMIT,
} from '../youtube-search.constants.js';

/**
 * 배치 실행 요청 (PRD F011).
 *
 * 곡 수를 상한으로 받는 이유는 **요청 타임아웃**이다. 배포 플랫폼이 아직 정해지지 않아
 * 허용 응답 시간을 모르는데, 곡당 최악 5초(검색 타임아웃)라 10곡이면 최악 50초가 된다.
 * 기본값을 5로 두고 상한을 10으로 막는다. 남은 곡은 "다시 실행"으로 이어서 처리한다 —
 * 시도 기록이 DB에 있어 재개 지점이 자동으로 복원되기 때문에 진행률 상태를 따로 들 필요가 없다.
 *
 * 곡을 직접 지정하는 파라미터는 **두지 않는다.** 대상 선정은 서버가 소유해야
 * "이미 열린 추천이 있는 곡", "결과 0건인 곡", "연속 실패 곡"을 건너뛰는 규칙이 지켜진다.
 * (검증용 단일 곡 경로는 라우트가 아니라 `YoutubeBatchService.searchForSong`이다.)
 */
export class RunBatchDto {
  @Max(YOUTUBE_BATCH_MAX_LIMIT, {
    message: `한 번에 처리할 수 있는 곡은 최대 ${YOUTUBE_BATCH_MAX_LIMIT}곡입니다.`,
  })
  @Min(1, { message: '처리할 곡 수는 1 이상이어야 합니다.' })
  @IsInt({ message: '처리할 곡 수는 정수여야 합니다.' })
  @IsOptional()
  @Type(() => Number)
  limit: number = YOUTUBE_BATCH_DEFAULT_LIMIT;
}
