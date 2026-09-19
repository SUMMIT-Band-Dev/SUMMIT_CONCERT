import { randomUUID } from 'node:crypto';
import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { isPrismaErrorCode } from '../common/prisma-error.js';
import { detectImageFormat } from '../storage/image-type.js';
import {
  STORAGE_CLIENT,
  StorageTimeoutError,
  type StorageClient,
} from '../storage/storage.client.js';
import {
  CARD_IMAGE_CACHE_CONTROL_SECONDS,
  CARD_IMAGE_REQUIRED_MESSAGE,
  CARD_IMAGE_UNSUPPORTED_MESSAGE,
  STORAGE_FAILED_MESSAGE,
  STORAGE_TIMEOUT_MESSAGE,
} from '../storage/storage.constants.js';
import { TEAM_NOT_FOUND_MESSAGE } from './teams.constants.js';
import { toTeamResponse, type TeamResponse } from './dto/team-response.js';
import type { UploadedImageFile } from './card-image-upload.interceptor.js';

@Injectable()
export class TeamCardImageService {
  private readonly logger = new Logger(TeamCardImageService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_CLIENT) private readonly storage: StorageClient,
  ) {}

  /**
   * 팀 카드뉴스 이미지 교체 (PRD F007).
   *
   * 처리 순서: 검증 → 팀 존재 확인 → 업로드 → DB 반영 → (실패 시) 보상 삭제.
   *
   * **외부 I/O 동안 DB 잠금을 잡지 않는다.** 곡 등록(§12)이 팀 행을 `FOR NO KEY UPDATE`로
   * 잠근 것은 "같은 팀 안 중복 검사"라는 읽기-쓰기 원자성이 필요했기 때문인데, 여기엔 그런
   * 불변식이 없다 — 단일 컬럼 덮어쓰기다. 잠금을 쥔 채 저장소를 기다리면 같은 팀에 대한
   * 다른 요청이 네트워크 지연만큼 통째로 막힌다.
   *
   * 그래서 남는 레이스: 같은 팀에 동시 업로드가 들어오면 두 객체가 모두 올라가고 DB는
   * 나중에 커밋한 쪽이 이긴다. 진 쪽 객체는 아무도 참조하지 않는 고아로 남는다.
   * 이전 객체를 지우지 않는 정책(아래 참조)이라 이건 용량 낭비이지 데이터 사고가 아니다.
   */
  async replace(
    teamId: bigint,
    file: UploadedImageFile | undefined,
  ): Promise<TeamResponse> {
    if (!file || file.size === 0) {
      throw new BadRequestException(CARD_IMAGE_REQUIRED_MESSAGE);
    }

    const format = detectImageFormat(file.buffer);
    if (!format) {
      throw new BadRequestException(CARD_IMAGE_UNSUPPORTED_MESSAGE);
    }

    const team = await this.prisma.lineUp.findUnique({
      where: { id: teamId },
      select: { id: true },
    });
    if (!team) {
      throw new NotFoundException(TEAM_NOT_FOUND_MESSAGE);
    }

    // 업로드마다 새 경로. 덮어쓰지 않는 이유는 CDN 때문이다 — 이 프로젝트는 Storage의
    // purgeCache가 비활성이라 같은 경로를 덮으면 엣지에 남은 옛 이미지를 비울 방법이 없다.
    // Supabase 공식 문서도 upsert 대신 새 경로를 권한다.
    const path = `${teamId}/${randomUUID()}.${format.extension}`;
    await this.upload(path, file.buffer, format.mimeType);
    const publicUrl = this.storage.getPublicUrl(path);

    try {
      const updated = await this.prisma.lineUp.update({
        where: { id: teamId },
        data: { cardImageUrl: publicUrl },
      });

      return toTeamResponse(updated);
    } catch (error) {
      await this.compensate(error, teamId, path, publicUrl);

      // `mapRecordNotFound`를 쓰지 않고 직접 처리한다 — 보상 삭제가 먼저 끝나야 하고,
      // 그 판단에 원본 에러 코드가 필요하기 때문이다.
      //
      // 이 P2025는 "도달 불가"가 아니다. 존재 확인과 갱신 사이에 Supabase 콘솔 등
      // API 밖에서 팀이 삭제되면 실제로 여기로 온다 (§11에서 P2002를 도달 불가로
      // 단정했다가 런타임에 터진 전례가 있어 경로를 명시해 둔다).
      if (isPrismaErrorCode(error, 'P2025')) {
        throw new NotFoundException(TEAM_NOT_FOUND_MESSAGE);
      }

      throw error;
    }
  }

  private async upload(
    path: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    try {
      await this.storage.upload({
        path,
        body,
        contentType,
        cacheControlSeconds: CARD_IMAGE_CACHE_CONTROL_SECONDS,
      });
    } catch (error) {
      if (error instanceof StorageTimeoutError) {
        // 타임아웃은 "실패"가 아니라 "결과를 모름"이다. 객체가 올라갔을 수 있는데
        // 지우려 들면 성공한 업로드를 지울 위험이 있다. 경로만 남기고 손대지 않는다.
        this.logger.error(
          `업로드 타임아웃 — 저장소에 객체가 남아 있을 수 있습니다: ${path}`,
        );
        throw new GatewayTimeoutException(STORAGE_TIMEOUT_MESSAGE);
      }

      throw new BadGatewayException(STORAGE_FAILED_MESSAGE);
    }
  }

  /**
   * DB 반영이 실패했을 때 방금 올린 객체를 정리한다.
   *
   * **"미반영이 확정된 경우"에만 지운다.** DB 오류에는 두 종류가 있다 —
   * `P2025`처럼 갱신이 일어나지 않은 것이 확실한 경우와, 타임아웃·연결 끊김처럼
   * **커밋 여부를 알 수 없는** 경우다. 후자에서 바로 지우면, 실제로는 커밋된
   * 이미지의 객체를 지워 공개 페이지에 깨진 이미지가 뜬다.
   *
   * 그래서 불명확한 오류에서는 먼저 `image_src`를 다시 읽어 본다. 방금 올린 URL이
   * 들어가 있으면 반영은 성공한 것이므로 객체를 그대로 둔다. 재조회마저 실패하면
   * 판단할 근거가 없으므로 **지우지 않고** 고아로 남기고 경로만 기록한다 —
   * 살아 있는 이미지를 지우는 것보다 객체 하나가 남는 편이 낫다.
   */
  private async compensate(
    error: unknown,
    teamId: bigint,
    path: string,
    publicUrl: string,
  ): Promise<void> {
    if (isPrismaErrorCode(error, 'P2025')) {
      await this.safeRemove(path);
      return;
    }

    let current: { cardImageUrl: string | null } | null;
    try {
      current = await this.prisma.lineUp.findUnique({
        where: { id: teamId },
        select: { cardImageUrl: true },
      });
    } catch {
      this.logger.error(
        `DB 반영 결과를 확인하지 못해 보상 삭제를 건너뜁니다. 고아일 수 있는 객체: ${path}`,
      );
      return;
    }

    if (current?.cardImageUrl === publicUrl) {
      this.logger.warn(
        `DB 오류가 났지만 반영은 완료돼 있어 객체를 유지합니다: ${path}`,
      );
      return;
    }

    // 행이 없거나(팀 삭제) 다른 URL이면(동시 업로드에서 밀림) 이 객체는 아무도 참조하지
    // 않는다 — 지워도 안전하다.
    await this.safeRemove(path);
  }

  /**
   * 보상 삭제. 실패해도 예외를 올리지 않는다.
   *
   * 여기서 던지면 원래 원인(DB 오류)이 삭제 실패로 덮여, 클라이언트가 전혀 다른 문제를
   * 보게 된다. 삭제가 안 되면 객체가 남을 뿐이므로 경로만 남기고 원인 에러를 살린다.
   */
  private async safeRemove(path: string): Promise<void> {
    try {
      await this.storage.remove([path]);
    } catch {
      this.logger.error(`보상 삭제에 실패했습니다. 고아 객체: ${path}`);
    }
  }
}
