import 'reflect-metadata';
import {
  BadRequestException,
  HttpException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { HardenedExpressAdapter } from './hardened-express.adapter.js';
import {
  BODY_TOO_LARGE_MESSAGE,
  INVALID_BODY_MESSAGE,
  INVALID_URL_MESSAGE,
  UNSUPPORTED_ENCODING_MESSAGE,
} from './http-messages.js';

const adapter = new HardenedExpressAdapter();

/** body-parser(http-errors)가 만드는 오류와 같은 모양: 원본 메시지에 요청 값이 실린다 */
const bodyParserError = (type: string, status: number, base: Error = new Error('ORIGINAL_SECRET_VALUE')) =>
  Object.assign(base, { type, status, statusCode: status, expose: true });

describe('HardenedExpressAdapter.mapException — 본문 파서 유래 오류만 고정 문구로 치환', () => {
  it('깨진 JSON(SyntaxError + entity.parse.failed) → 400 고정 문구 (원본 메시지 없음)', () => {
    const error = bodyParserError('entity.parse.failed', 400, new SyntaxError('Unexpected token \'P\', "ORIGINAL_SECRET_VALUE"'));

    const mapped = adapter.mapException(error);

    expect(mapped).toBeInstanceOf(BadRequestException);
    expect((mapped as HttpException).getResponse()).toMatchObject({ message: INVALID_BODY_MESSAGE, statusCode: 400 });
    expect(JSON.stringify((mapped as HttpException).getResponse())).not.toContain('ORIGINAL_SECRET_VALUE');
  });

  it.each([
    ['entity.too.large', 413, PayloadTooLargeException, BODY_TOO_LARGE_MESSAGE],
    ['encoding.unsupported', 415, UnsupportedMediaTypeException, UNSUPPORTED_ENCODING_MESSAGE],
    ['charset.unsupported', 415, UnsupportedMediaTypeException, UNSUPPORTED_ENCODING_MESSAGE],
  ])('%s → %i 고정 문구', (type, status, cls, message) => {
    const mapped = adapter.mapException(bodyParserError(type, status));

    expect(mapped).toBeInstanceOf(cls);
    expect((mapped as HttpException).getStatus()).toBe(status);
    expect((mapped as HttpException).getResponse()).toMatchObject({ message });
  });

  it('URIError(경로의 잘못된 퍼센트 인코딩) → 400 고정 문구 (원본 메시지에 실린 값 없음)', () => {
    const mapped = adapter.mapException(new URIError("Failed to decode param 'ORIGINAL_SECRET_VALUE'"));

    expect(mapped).toBeInstanceOf(BadRequestException);
    expect((mapped as HttpException).getResponse()).toMatchObject({ message: INVALID_URL_MESSAGE });
    expect(JSON.stringify((mapped as HttpException).getResponse())).not.toContain('ORIGINAL_SECRET_VALUE');
  });
});

describe('HardenedExpressAdapter.mapException — 그 밖의 SyntaxError는 400으로 위장하지 않는다 (L1)', () => {
  it('type이 없는 SyntaxError는 변환 없이 같은 객체를 돌려준다 (부모는 이것을 400+원본 메시지로 바꾼다)', () => {
    const error = new SyntaxError('ORIGINAL_SECRET_VALUE');

    const mapped = adapter.mapException(error);

    expect(mapped).toBe(error);
    expect(mapped).not.toBeInstanceOf(HttpException);
  });

  it('부모 구현은 실제로 같은 입력을 400으로 바꾼다 (이 스펙이 부모 호출을 막았는지의 기준선)', () => {
    // 부모를 호출하는 쪽으로 되돌리면 위 테스트가 실패해야 한다는 것을, 부모 동작을 직접 보여 줘서 확인한다
    const viaParent = Object.getPrototypeOf(HardenedExpressAdapter.prototype).mapException.call(
      adapter,
      new SyntaxError('ORIGINAL_SECRET_VALUE'),
    );

    expect(viaParent).toBeInstanceOf(BadRequestException);
    expect(JSON.stringify(viaParent.getResponse())).toContain('ORIGINAL_SECRET_VALUE');
  });

  it('다른 type을 가진 SyntaxError도 파서 유래가 아니므로 그대로 통과한다', () => {
    const error = bodyParserError('something.else', 400, new SyntaxError('ORIGINAL_SECRET_VALUE'));

    expect(adapter.mapException(error)).toBe(error);
  });
});

describe('HardenedExpressAdapter.mapException — 그 밖의 입력', () => {
  it.each([
    ['일반 Error', new Error('x')],
    ['문자열', 'boom'],
    ['null', null],
    ['undefined', undefined],
  ])('%s는 그대로 돌려준다', (_label, thrown) => {
    expect(adapter.mapException(thrown)).toBe(thrown);
  });

  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'type이 Object.prototype의 이름(%s)이어도 치환 표에서 찾지 않는다',
    (type) => {
      const error = bodyParserError(type, 400);

      expect(adapter.mapException(error)).toBe(error);
    },
  );
});
