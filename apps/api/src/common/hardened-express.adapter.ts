import {
  BadRequestException,
  HttpException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import {
  BODY_TOO_LARGE_MESSAGE,
  INVALID_BODY_MESSAGE,
  INVALID_URL_MESSAGE,
  UNSUPPORTED_ENCODING_MESSAGE,
} from './http-messages.js';

/** body-parser가 오류에 붙이는 `type` 값 중 우리가 고정 문구로 바꾸는 것들 */
const BODY_PARSER_ERROR_TYPES: Readonly<Record<string, () => HttpException>> = {
  'entity.parse.failed': () => new BadRequestException(INVALID_BODY_MESSAGE),
  'entity.too.large': () => new PayloadTooLargeException(BODY_TOO_LARGE_MESSAGE),
  'encoding.unsupported': () => new UnsupportedMediaTypeException(UNSUPPORTED_ENCODING_MESSAGE),
  'charset.unsupported': () => new UnsupportedMediaTypeException(UNSUPPORTED_ENCODING_MESSAGE),
};

/**
 * 본문 파서·URL 오류의 원본 메시지가 응답으로 나가지 않게 하는 Express 어댑터.
 *
 * ## 왜 필터가 아니라 어댑터인가
 * 깨진 JSON을 받으면 body-parser가 `SyntaxError`를 던지고, Nest의 `ExpressAdapter.mapException()`이
 * 이를 `new BadRequestException(error.message)`로 **바꾼 뒤에야** 예외 필터에 넘긴다. 이 시점에는
 * `type: 'entity.parse.failed'`가 이미 사라져 필터가 "본문 파서 오류"를 식별할 수 없고, 메시지에는
 * 본문 앞 10자가 실려 있다. `mapException`은 어댑터의 공개 확장점이라 여기서 먼저 가로챈다.
 *
 * 몽키패치 대신 상속을 쓰는 이유는 Nest 버전이 바뀌어 시그니처가 달라졌을 때 컴파일 단계에서 드러나기 때문이다.
 */
export class HardenedExpressAdapter extends ExpressAdapter {
  override mapException(error: unknown): unknown {
    const type = (error as { type?: unknown } | null)?.type;
    if (typeof type === 'string' && Object.hasOwn(BODY_PARSER_ERROR_TYPES, type)) {
      return BODY_PARSER_ERROR_TYPES[type]();
    }

    // 부모는 SyntaxError/URIError의 원본 메시지를 그대로 400 응답에 싣는다
    if (error instanceof SyntaxError) {
      return new BadRequestException(INVALID_BODY_MESSAGE);
    }
    if (error instanceof URIError) {
      return new BadRequestException(INVALID_URL_MESSAGE);
    }

    return super.mapException(error);
  }
}
