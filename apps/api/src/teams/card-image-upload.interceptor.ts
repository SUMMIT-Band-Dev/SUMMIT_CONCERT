import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import multer from 'multer';
import {
  CARD_IMAGE_FIELD_MESSAGE,
  CARD_IMAGE_FIELD_NAME,
  CARD_IMAGE_INVALID_UPLOAD_MESSAGE,
  CARD_IMAGE_MAX_BYTES,
  CARD_IMAGE_SINGLE_FILE_MESSAGE,
  CARD_IMAGE_TOO_LARGE_MESSAGE,
} from '../storage/storage.constants.js';

/**
 * multer가 memoryStorage에 채워 주는 필드 중 **실제로 쓰는 것만** 추린 타입.
 *
 * `Express.Multer.File` 전체를 쓰지 않는 이유는 테스트 때문이다 — 이 모양이면
 * 대역 파일을 `{ buffer, size }` 두 줄로 만들 수 있다. 구조적 타이핑이라
 * 실제 multer 파일 객체도 그대로 할당된다.
 */
export interface UploadedImageFile {
  buffer: Buffer;
  size: number;
}

/**
 * multer 업로드 제한.
 *
 * 하나도 지정하지 않으면 `fileSize`/`files`/`parts`가 전부 `Infinity`다.
 * `parts: 1`이라 파일 외 텍스트 필드가 하나라도 섞이면 그 자리에서 거부된다 —
 * 이 엔드포인트는 `@Body()`를 받지 않으므로 추가 필드는 전부 오용이다.
 */
const CARD_IMAGE_LIMITS = {
  fileSize: CARD_IMAGE_MAX_BYTES,
  files: 1,
  parts: 1,
  fields: 0,
  fieldSize: 1024,
} as const;

/**
 * multer 에러를 우리 예외로 바꾼다. **multer가 던진 것만 손댄다.**
 *
 * 상태코드로 판별하지 않고 `MulterError` 인스턴스인지로 판별하는 것이 핵심이다.
 * 상태코드 기준이었다면 `:id` 파싱 400(`ParseBigIntPipe`)이나 팀 404처럼 전혀 다른
 * 출처의 예외까지 메시지가 덮어써진다. 여기서는 출처가 확정된 예외만 통과한다.
 *
 * 분기 기준도 메시지가 아니라 `code`다 — Nest의 `transformException`은 영어 메시지
 * 문자열로 분기하는데, 그건 multer가 문구를 바꾸면 조용히 깨진다.
 */
export function toUploadException(error: unknown): unknown {
  if (!(error instanceof multer.MulterError)) {
    // 출처가 multer가 아니면 원본 그대로 돌려보낸다 (메시지를 건드리지 않는다)
    return error;
  }

  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      return new PayloadTooLargeException(CARD_IMAGE_TOO_LARGE_MESSAGE);
    case 'LIMIT_UNEXPECTED_FILE':
      return new BadRequestException(CARD_IMAGE_FIELD_MESSAGE);
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_PART_COUNT':
    case 'LIMIT_FIELD_COUNT':
      return new BadRequestException(CARD_IMAGE_SINGLE_FILE_MESSAGE);
    default:
      return new BadRequestException(CARD_IMAGE_INVALID_UPLOAD_MESSAGE);
  }
}

/**
 * 카드뉴스 이미지 업로드용 multipart 파서 (PRD F007).
 *
 * Nest의 `FileInterceptor`를 쓰지 않고 multer를 직접 감싼다. `FileInterceptor`는
 * multer 에러를 **영어 메시지의 HttpException으로 이미 변환해서** 던지기 때문에,
 * 그 뒤에서는 "이 400이 multer에서 왔는지 파이프에서 왔는지"를 구분할 방법이 없다.
 * 직접 감싸면 콜백에 들어온 에러가 multer 것임이 호출 지점에서 확정된다.
 *
 * 인터셉터는 전역 Guard보다 **나중에** 실행되므로, 미인증 요청의 본문은 여기까지
 * 오지 않는다 (파일이 파싱되지도, 저장소로 나가지도 않는다).
 */
@Injectable()
export class CardImageUploadInterceptor implements NestInterceptor {
  private readonly parse = multer({
    storage: multer.memoryStorage(),
    limits: CARD_IMAGE_LIMITS,
  }).single(CARD_IMAGE_FIELD_NAME);

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const http = context.switchToHttp();

    return new Promise((resolve, reject) => {
      this.parse(http.getRequest(), http.getResponse(), (error?: unknown) => {
        if (error) {
          reject(toUploadException(error));
          return;
        }

        resolve(next.handle());
      });
    });
  }
}
