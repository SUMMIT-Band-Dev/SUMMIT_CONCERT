import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import multer from 'multer';
import { toUploadException } from '../teams/card-image-upload.interceptor.js';
import { CARD_IMAGE_FIELD_NAME } from '../storage/storage.constants.js';
import {
  CONCERT_IMAGE_MAX_BYTES,
  CONCERT_IMAGE_TOO_LARGE_MESSAGE,
} from './concert-content.constants.js';

@Injectable()
export class ConcertImageUploadInterceptor implements NestInterceptor {
  private readonly parse = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: CONCERT_IMAGE_MAX_BYTES,
      files: 1,
      parts: 1,
      fields: 0,
      fieldSize: 1024,
    },
  }).single(CARD_IMAGE_FIELD_NAME);

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    return new Promise((resolve, reject) => {
      this.parse(http.getRequest(), http.getResponse(), (error?: unknown) => {
        if (error) {
          reject(toUploadException(error, CONCERT_IMAGE_TOO_LARGE_MESSAGE));
          return;
        }
        resolve(next.handle());
      });
    });
  }
}
