/**
 * `AbortSignal.timeout()`이 끊은 요청인지 판별한다.
 *
 * Node의 fetch는 타임아웃 시 `TimeoutError`라는 이름의 `DOMException`으로 거부하는데,
 * 구현/버전에 따라 그 예외가 `TypeError`의 `cause`에 감싸여 오기도 한다. 한쪽만 보면
 * "타임아웃(504)"으로 분류해야 할 실패가 "그 외 실패(502)"로 새기 때문에 둘 다 확인한다.
 *
 * `AbortError`도 함께 보는 이유는 수동 abort와 타임아웃을 구분할 필요가 없기 때문이다 —
 * 지금 구조에서 signal을 끊는 주체는 타임아웃뿐이다.
 */
export function isTimeoutError(error: unknown): boolean {
  return hasAbortName(error) || hasAbortName((error as { cause?: unknown })?.cause);
}

function hasAbortName(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || !('name' in value)) {
    return false;
  }

  const name = (value as { name?: unknown }).name;
  return name === 'TimeoutError' || name === 'AbortError';
}
