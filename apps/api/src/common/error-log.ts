import { fileURLToPath } from 'node:url';

/**
 * 예외 로그에 남길 수 있는 정보를 **허용 목록 방식**으로 정한다.
 *
 * 기본은 "클래스명 + 오류 코드"뿐이다(Prisma·연결 오류는 메시지에 호출 인자나 접속 호스트가 실린다).
 * 다만 그러면 `TypeError` 같은 **코드 버그**는 어디서 났는지 알 수 없으므로, 아래 조건을 모두 만족하는
 * 내장 오류에만 메시지와 첫 프로젝트 스택 프레임을 함께 남긴다.
 *
 * 1. **정확히 내장 클래스**여야 한다 — 이름이 아니라 프로토타입이 `TypeError.prototype` 등과 같아야 한다.
 *    서브클래스(예: 라이브러리가 만든 `FooError extends TypeError`)와 이름 위장은 제외된다
 * 2. **`code`가 없어야 한다** — Node 내부 오류(`ERR_INVALID_ARG_TYPE` 등)는 메시지에 받은 값을 싣는다
 * 3. `SyntaxError`는 메시지에 입력 조각이 실리므로(`JSON.parse`, `BigInt("…")`) **위치만** 남긴다
 *
 * 남는 위험: V8 내장 메시지는 대부분 식별자·속성명이지만, 드물게 값이 실린다(예: 숫자 값을 담은 `RangeError`).
 * 그래서 메시지는 제어문자 제거·경로 마스킹·길이 제한을 거친다. 그래도 값을 완전히 배제하지는 못한다.
 */

/** 이 파일이 `<root>/src/common` 또는 `<root>/dist/common` 아래에 있다는 전제(두 단계 위가 프로젝트 루트) */
export const PROJECT_ROOT = normalizeSlashes(fileURLToPath(new URL('../../', import.meta.url))).replace(/\/$/, '');

const MAX_MESSAGE_LENGTH = 200;
const MAX_FRAME_SCAN = 40;
const CLASS_NAME_PATTERN = /^[A-Za-z0-9_]{1,80}$/;
const ERROR_CODE_PATTERN = /^(P\d{4}|[A-Z][A-Z0-9_]{1,40})$/;
const FUNCTION_NAME_PATTERN = /^[\w$.<>[\] ]{1,80}$/;

/** 메시지와 위치를 함께 남기는 내장 오류 */
const MESSAGE_SAFE_CLASSES: readonly Function[] = [TypeError, RangeError, ReferenceError, EvalError];
/** 위치만 남기는 내장 오류 */
const FRAME_ONLY_CLASSES: readonly Function[] = [SyntaxError];

function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, '/');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `클래스명` 또는 `클래스명(code=P2002)`. 메시지·스택·meta는 포함하지 않는다 */
export function describeError(exception: unknown): string {
  try {
    if (typeof exception !== 'object' || exception === null) {
      return 'NonObjectThrown';
    }

    const name = exception.constructor?.name;
    const className = typeof name === 'string' && CLASS_NAME_PATTERN.test(name) ? name : 'UnknownError';

    const code = (exception as { code?: unknown }).code;
    return typeof code === 'string' && ERROR_CODE_PATTERN.test(code)
      ? `${className}(code=${code})`
      : className;
  } catch {
    // 접근하면 던지는 객체(Proxy 등)를 던지는 코드가 있어도 로깅이 다시 실패하지 않게 한다
    return 'UnknownError';
  }
}

/**
 * 허용 목록에 든 내장 오류에 한해 ` | 메시지: … | 위치: …` 형태의 추가 정보를 돌려준다. 아니면 빈 문자열.
 */
export function describeErrorDetails(exception: unknown): string {
  try {
    const kind = builtinKind(exception);
    if (kind === undefined) {
      return '';
    }

    const parts: string[] = [];
    if (kind === 'message') {
      const message = sanitizeMessage((exception as { message?: unknown }).message);
      if (message) {
        parts.push(`메시지: ${message}`);
      }
    }

    const frame = firstProjectFrame((exception as { stack?: unknown }).stack);
    if (frame) {
      parts.push(`위치: ${frame}`);
    }

    return parts.length > 0 ? ` | ${parts.join(' | ')}` : '';
  } catch {
    return '';
  }
}

function builtinKind(exception: unknown): 'message' | 'frame' | undefined {
  if (typeof exception !== 'object' || exception === null) {
    return undefined;
  }
  // Node 내부 오류·Prisma 등 코드가 있는 오류는 메시지에 값이 실릴 수 있다
  if (typeof (exception as { code?: unknown }).code === 'string') {
    return undefined;
  }

  const prototype = Object.getPrototypeOf(exception);
  if (MESSAGE_SAFE_CLASSES.some((cls) => cls.prototype === prototype)) {
    return 'message';
  }
  if (FRAME_ONLY_CLASSES.some((cls) => cls.prototype === prototype)) {
    return 'frame';
  }
  return undefined;
}

/** 제어문자를 없애고, 절대 경로를 가리고, 길이를 제한한 한 줄 메시지 */
function sanitizeMessage(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || raw.length === 0) {
    return undefined;
  }

  // 제어문자(Cc)와 줄·문단 구분자(Zl, Zp)를 공백으로 바꿔 한 줄로 만든다
  let message = raw.replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, ' ');
  message = maskPaths(message).replace(/\s+/g, ' ').trim();
  if (message.length > MAX_MESSAGE_LENGTH) {
    message = `${message.slice(0, MAX_MESSAGE_LENGTH)}…`;
  }
  return message.length > 0 ? message : undefined;
}

/** 프로젝트 안의 경로는 상대 경로로, 그 밖의 절대 경로(파일 URL·드라이브·POSIX)는 `<경로>`로 바꾼다 */
function maskPaths(text: string): string {
  // 루트의 각 구간을 이스케이프하고, 구간 사이는 슬래시·역슬래시 모두 허용한다
  const rootPattern = new RegExp(`${PROJECT_ROOT.split('/').map(escapeRegExp).join('[\\\\/]')}[\\\\/]?`, 'gi');

  return text
    .replace(rootPattern, '')
    .replace(/file:\/\/\/[^\s'")\]]+/gi, '<경로>')
    .replace(/[A-Za-z]:[\\/][^\s'")\]]*/g, '<경로>')
    .replace(/(?<![\w:.])\/(?:[\w.@~-]+\/)+[\w.@~-]*/g, '<경로>');
}

/**
 * 스택에서 **프로젝트 루트 아래에 있는 첫 프레임**을 `함수 (상대경로:줄:열)`로 돌려준다.
 * 프로젝트 밖의 프레임(node 내부·다른 경로)은 건너뛰고, 절대 경로는 어떤 형태로도 남기지 않는다.
 */
function firstProjectFrame(stack: unknown): string | undefined {
  if (typeof stack !== 'string') {
    return undefined;
  }

  const rootLower = PROJECT_ROOT.toLowerCase();
  const frames = stack.split('\n').filter((line) => /^\s+at /.test(line)).slice(0, MAX_FRAME_SCAN);

  for (const line of frames) {
    const match = /^\s+at (?:async )?(?:(.+?) \()?(.+?):(\d+):(\d+)\)?\s*$/.exec(line);
    if (!match) {
      continue;
    }

    const [, functionName, rawPath, lineNo, columnNo] = match;
    const filePath = toFilePath(rawPath);
    if (filePath === undefined || !filePath.toLowerCase().startsWith(`${rootLower}/`)) {
      continue;
    }

    const relative = `${filePath.slice(PROJECT_ROOT.length + 1)}:${lineNo}:${columnNo}`;
    return functionName && FUNCTION_NAME_PATTERN.test(functionName)
      ? `${functionName} (${relative})`
      : relative;
  }

  return undefined;
}

/** 프레임의 경로 부분을 슬래시 형태의 파일 경로로 바꾼다. 파일이 아닌 것(`node:` 등)은 undefined */
function toFilePath(raw: string): string | undefined {
  if (raw.startsWith('file:')) {
    try {
      return normalizeSlashes(fileURLToPath(raw));
    } catch {
      return undefined;
    }
  }
  if (raw.startsWith('node:')) {
    return undefined;
  }
  return normalizeSlashes(raw);
}
