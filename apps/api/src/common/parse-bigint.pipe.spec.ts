import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ParseBigIntPipe, parseBigIntId } from './parse-bigint.pipe.js';

describe('parseBigIntId', () => {
  it('양의 정수 문자열을 BigInt로 바꾼다', () => {
    expect(parseBigIntId('1')).toBe(1n);
    expect(parseBigIntId('15')).toBe(15n);
    expect(parseBigIntId('9223372036854775807')).toBe(9223372036854775807n);
  });

  it('숫자가 아니면 null (BigInt 변환 예외가 새어 나가지 않는다)', () => {
    expect(parseBigIntId('reorder')).toBeNull();
    expect(parseBigIntId('1.5')).toBeNull();
    expect(parseBigIntId('1e3')).toBeNull();
    expect(parseBigIntId(' 1')).toBeNull();
    expect(parseBigIntId('')).toBeNull();
  });

  it('0 이하이거나 int8 범위를 넘으면 null', () => {
    expect(parseBigIntId('0')).toBeNull();
    expect(parseBigIntId('-1')).toBeNull();
    expect(parseBigIntId('9223372036854775808')).toBeNull();
    // 자릿수 상한에 먼저 걸려 거대한 문자열을 BigInt로 변환하지 않는다
    expect(parseBigIntId('9'.repeat(10_000))).toBeNull();
  });

  it('문자열이 아닌 값도 예외 없이 null', () => {
    expect(parseBigIntId(undefined)).toBeNull();
    expect(parseBigIntId(null)).toBeNull();
    expect(parseBigIntId(1)).toBeNull();
  });
});

describe('ParseBigIntPipe', () => {
  const pipe = new ParseBigIntPipe();

  it('유효한 id는 BigInt로 통과시킨다', () => {
    expect(pipe.transform('15')).toBe(15n);
  });

  it('잘못된 id는 500이 아니라 400으로 막는다', () => {
    // 'reorder'는 라우트 선언 순서가 뒤집혔을 때 실제로 들어올 수 있는 값이다
    expect(() => pipe.transform('reorder')).toThrow(BadRequestException);
    expect(() => pipe.transform('0')).toThrow(BadRequestException);
    expect(() => pipe.transform('99999999999999999999')).toThrow(BadRequestException);
  });
});
