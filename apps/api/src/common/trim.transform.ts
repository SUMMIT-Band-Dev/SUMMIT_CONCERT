import { Transform } from 'class-transformer';

/**
 * 문자열 입력의 앞뒤 공백을 제거한다.
 *
 * 공백만 들어온 값은 빈 문자열이 되어 `@IsNotEmpty`에 걸린다 —
 * `"   "`이 팀명으로 저장되는 것을 막는 것이 목적이다.
 * 전역 `ValidationPipe`의 `transform: true` 덕분에 검증보다 먼저 실행된다.
 */
export const TrimString = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
