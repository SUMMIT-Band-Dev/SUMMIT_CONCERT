import {
  Controller,
  Param,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ParseBigIntPipe } from '../common/parse-bigint.pipe.js';
import { TeamCardImageService } from './team-card-image.service.js';
import {
  CardImageUploadInterceptor,
  type UploadedImageFile,
} from './card-image-upload.interceptor.js';
import type { TeamResponse } from './dto/team-response.js';

/**
 * 팀 카드뉴스 이미지 업로드 (PRD F007).
 *
 * `TeamsController`와 분리한 이유는 이 라우트만 multipart를 다루기 때문이다 —
 * 파서 인터셉터와 파일 전용 검증이 팀 CRUD 쪽으로 섞이지 않게 한다.
 * (컨트롤러를 둘로 나누는 것은 `SongsModule`에서 이미 쓴 방식이다)
 *
 * `@Public()`을 붙이지 않는다 — 전역 Guard가 기본으로 인증을 요구한다.
 * Guard는 인터셉터보다 먼저 실행되므로, 미인증 요청은 파일이 파싱되기 전에 끊긴다.
 */
@Controller('teams')
export class TeamCardImageController {
  constructor(private readonly cardImageService: TeamCardImageService) {}

  /**
   * `TeamsController`의 `@Patch(':id')`와 경로 모양이 겹치지만 메서드(PUT)와 하위 세그먼트가
   * 달라 충돌하지 않는다. 이미지 삭제는 MVP 스코프 밖이라 만들지 않는다(교체로 대응).
   */
  @Put(':id/card-image')
  @UseInterceptors(CardImageUploadInterceptor)
  upload(
    @Param('id', ParseBigIntPipe) id: bigint,
    @UploadedFile() file?: UploadedImageFile,
  ): Promise<TeamResponse> {
    return this.cardImageService.replace(id, file);
  }
}
