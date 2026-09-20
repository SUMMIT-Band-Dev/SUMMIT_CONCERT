import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ParseBigIntPipe } from '../common/parse-bigint.pipe.js';
import { YoutubeBatchService, type BatchSummary } from './youtube-batch.service.js';
import { YoutubeQuotaService, type QuotaStatus } from './youtube-quota.service.js';
import { YoutubeReviewService } from './youtube-review.service.js';
import { RunBatchDto } from './dto/run-batch.dto.js';
import {
  ApproveRecommendationDto,
  ListRecommendationsQuery,
  RejectRecommendationDto,
} from './dto/review-recommendation.dto.js';
import type { RecommendationListResponse } from './dto/recommendation-response.js';
import type { SongResponse } from '../songs/dto/song-response.js';

/**
 * 유튜브 연결 관리 (PRD F011/F012).
 *
 * 경로를 `songs/:id/...` 아래가 아니라 최상위 `youtube/`에 둔 것은, 이 기능들이 **곡 하나가
 * 아니라 여러 곡을 가로지르는 리소스**를 다루기 때문이다 — 배치는 대상을 스스로 고르고,
 * 목록은 곡을 가로질러 조회한다. F013(`PUT /songs/:id/youtube-url`)만 곡 하나에 대한
 * 조작이라 그쪽에 남아 있다(§14 컨트롤러 주석이 예고한 구조).
 *
 * 전부 POST 200이다. 승인·반려·재큐는 자원을 만드는 게 아니라 기존 자원의 상태를 바꾸므로
 * 201이 아니다 (§10에서 `POST /auth/login`을 200으로 둔 것과 같은 기준).
 *
 * `@Public()`을 붙이지 않는다 — `AuthModule`이 등록한 전역 Guard가 기본으로 인증을 요구한다.
 */
@Controller('youtube')
export class YoutubeRecommendationsController {
  constructor(
    private readonly batchService: YoutubeBatchService,
    private readonly reviewService: YoutubeReviewService,
    private readonly quotaService: YoutubeQuotaService,
  ) {}

  /**
   * 남은 쿼터 현황.
   *
   * 배치를 누르기 전에 "오늘 몇 곡이나 더 되는지" 알 수 있어야 한다. 관리자 UI가 이 값을
   * 보여 주지 않으면 배치가 중간에 멈춘 이유를 설명할 방법이 없다.
   */
  @Get('quota')
  getQuota(): Promise<QuotaStatus> {
    return this.quotaService.getStatus();
  }

  /**
   * 배치 추천 검색 실행 (PRD F011).
   *
   * `recommendations/batch`를 `recommendations/:attemptId/...`보다 **먼저 선언**한다.
   * 지금은 세그먼트 수가 달라 충돌하지 않지만, 경로가 늘어날 때 순서 의존이 생기는 지점이라
   * §11의 `PATCH /teams/reorder`와 같은 방침으로 순서를 고정하고 테스트로 잠근다.
   */
  @Post('recommendations/batch')
  @HttpCode(HttpStatus.OK)
  runBatch(@Body() dto: RunBatchDto): Promise<BatchSummary> {
    return this.batchService.runBatch(dto.limit);
  }

  /** 추천 목록 (PRD F012). 기본은 리뷰 대기(`open`)다. */
  @Get('recommendations')
  list(@Query() query: ListRecommendationsQuery): Promise<RecommendationListResponse> {
    return this.reviewService.list(query);
  }

  /** 후보 하나를 승인해 곡에 연결한다. 응답은 F010·F013과 같은 `SongResponse`다. */
  @Post('recommendations/:attemptId/approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @Param('attemptId', ParseBigIntPipe) attemptId: bigint,
    @Body() dto: ApproveRecommendationDto,
  ): Promise<SongResponse> {
    return this.reviewService.approve(attemptId, dto.videoId);
  }

  /** 추천을 반려한다. 해당 곡은 이후 자동 재검색 대상에서 빠진다. */
  @Post('recommendations/:attemptId/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @Param('attemptId', ParseBigIntPipe) attemptId: bigint,
    @Body() dto: RejectRecommendationDto,
  ): Promise<SongResponse> {
    return this.reviewService.reject(attemptId, dto.reason);
  }

  /** 반려됐거나 결과가 0건이었던 곡을 다시 배치 대상으로 되돌린다. */
  @Post('songs/:songId/requeue')
  @HttpCode(HttpStatus.OK)
  requeue(@Param('songId', ParseBigIntPipe) songId: bigint): Promise<SongResponse> {
    return this.reviewService.requeue(songId);
  }
}
