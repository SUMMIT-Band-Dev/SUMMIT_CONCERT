import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/** Postgres int8의 최댓값. 이 범위를 넘는 값은 DB까지 보내지 않고 여기서 걸러낸다. */
const MAX_INT8 = 9223372036854775807n;

/** MAX_INT8의 자릿수. 길이부터 잘라내지 않으면 거대한 숫자 문자열을 그대로 BigInt로 변환하게 된다. */
const MAX_INT8_DIGITS = 19;

/**
 * 문자열을 1 이상의 BigInt id로 변환한다. 형식이나 범위가 맞지 않으면 null.
 *
 * `BigInt("reorder")`는 SyntaxError를 던지는데, 그대로 두면 400이어야 할 요청이
 * 500으로 새어 나간다. 재정렬 본문의 `teamIds`에도 같은 규칙이 필요해서
 * 파이프가 아니라 함수로 분리했다.
 */
export function parseBigIntId(value: unknown): bigint | null {
  if (typeof value !== 'string') return null;
  if (!/^\d+$/.test(value)) return null;
  if (value.length > MAX_INT8_DIGITS) return null;

  const parsed = BigInt(value);
  if (parsed < 1n || parsed > MAX_INT8) return null;

  return parsed;
}

/**
 * `:id` 경로 파라미터를 BigInt로 바꾼다.
 *
 * 기본 제공 `ParseIntPipe`를 쓰지 않는 이유는 id가 int8이라 number로 받으면
 * 2^53을 넘는 값에서 정밀도를 잃기 때문이다. 4단계(Setlist)에서도 그대로 쓴다.
 */
@Injectable()
export class ParseBigIntPipe implements PipeTransform<string, bigint> {
  transform(value: string): bigint {
    const parsed = parseBigIntId(value);
    if (parsed === null) {
      throw new BadRequestException('id는 1 이상의 정수여야 합니다.');
    }

    return parsed;
  }
}
