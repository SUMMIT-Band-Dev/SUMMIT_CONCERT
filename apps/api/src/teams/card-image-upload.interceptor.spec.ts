import {
  BadRequestException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import multer from 'multer';
import { toUploadException } from './card-image-upload.interceptor.js';
import {
  CARD_IMAGE_FIELD_MESSAGE,
  CARD_IMAGE_SINGLE_FILE_MESSAGE,
  CARD_IMAGE_TOO_LARGE_MESSAGE,
} from '../storage/storage.constants.js';

const multerError = (code: string, field?: string) =>
  new multer.MulterError(
    code as ConstructorParameters<typeof multer.MulterError>[0],
    field,
  );

describe('toUploadException — multer 에러 매핑', () => {
  it('용량 초과는 413이다', () => {
    const mapped = toUploadException(multerError('LIMIT_FILE_SIZE'));

    expect(mapped).toBeInstanceOf(PayloadTooLargeException);
    expect((mapped as PayloadTooLargeException).message).toBe(
      CARD_IMAGE_TOO_LARGE_MESSAGE,
    );
  });

  it('필드명이 다르면 400이고 필드명을 안내한다', () => {
    const mapped = toUploadException(
      multerError('LIMIT_UNEXPECTED_FILE', 'image'),
    );

    expect(mapped).toBeInstanceOf(BadRequestException);
    expect((mapped as BadRequestException).message).toBe(
      CARD_IMAGE_FIELD_MESSAGE,
    );
  });

  it.each(['LIMIT_FILE_COUNT', 'LIMIT_PART_COUNT', 'LIMIT_FIELD_COUNT'])(
    '%s는 400이다 (다중 파일·추가 텍스트 필드)',
    (code) => {
      const mapped = toUploadException(multerError(code));

      expect(mapped).toBeInstanceOf(BadRequestException);
      expect((mapped as BadRequestException).message).toBe(
        CARD_IMAGE_SINGLE_FILE_MESSAGE,
      );
    },
  );

  it('알 수 없는 multer 코드도 400으로 떨어지고 500으로 새지 않는다', () => {
    expect(toUploadException(multerError('LIMIT_FIELD_KEY'))).toBeInstanceOf(
      BadRequestException,
    );
  });

  it('메시지 문자열이 아니라 code로 분기한다', () => {
    // multer가 영어 문구를 바꿔도 매핑이 깨지지 않아야 한다
    const error = multerError('LIMIT_FILE_SIZE');
    error.message = '문구가 바뀐 경우';

    expect(toUploadException(error)).toBeInstanceOf(PayloadTooLargeException);
  });
});

describe('toUploadException — 출처가 multer가 아니면 손대지 않는다', () => {
  // 상태코드로 판별했다면 아래 예외들의 메시지가 업로드 안내문으로 덮어써진다.
  // 판별 기준이 "MulterError 인스턴스인가"라는 것을 고정한다.
  it.each([
    [
      ':id 파싱 400 (ParseBigIntPipe)',
      new BadRequestException('id는 1 이상의 정수여야 합니다.'),
    ],
    ['팀 404', new NotFoundException('해당 팀을 찾을 수 없습니다.')],
    ['일반 Error', new Error('알 수 없는 오류')],
    ['문자열', 'not an error'],
  ])('%s는 원본 그대로 돌아온다', (_name, error) => {
    expect(toUploadException(error)).toBe(error);
  });

  it('다른 출처의 400 메시지가 보존된다', () => {
    const original = new BadRequestException('id는 1 이상의 정수여야 합니다.');

    expect((toUploadException(original) as BadRequestException).message).toBe(
      'id는 1 이상의 정수여야 합니다.',
    );
  });
});
