import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PROJECT_ROOT, describeError, describeErrorDetails } from './error-log.js';

/** 이 스펙 파일 자체가 프로젝트 루트 아래라서, 실제로 만든 오류의 첫 프레임은 이 파일이다 */
const THIS_FILE = 'src/common/error-log.spec.ts';

/** 프로젝트 안의 파일을 가리키는 프레임 줄. 형태(Windows 역슬래시 / 파일 URL / POSIX)만 바꿔 쓴다 */
const inRoot = (relative: string) => `${PROJECT_ROOT}/${relative}`;

function withStack(error: Error, frames: string[]): Error {
  error.stack = [`${error.name}: ${error.message}`, ...frames].join('\n');
  return error;
}

describe('describeErrorDetails — 허용 목록의 내장 오류: 메시지 + 첫 프로젝트 프레임', () => {
  it.each([
    ['TypeError', () => new TypeError("Cannot read properties of undefined (reading 'title')")],
    ['RangeError', () => new RangeError('Invalid array length')],
    ['ReferenceError', () => new ReferenceError('songId is not defined')],
    ['EvalError', () => new EvalError('eval failed')],
  ])('%s: 메시지와 이 파일의 상대 경로 프레임을 남긴다', (_name, make) => {
    const error = make();

    const details = describeErrorDetails(error);

    expect(details.startsWith(` | 메시지: ${error.message} | 위치: `)).toBe(true);
    expect(details).toContain(THIS_FILE);
    // 줄:열 형태
    expect(details).toMatch(/error-log\.spec\.ts:\d+:\d+\)?$/);
  });

  it('절대 경로가 어떤 형태로도 남지 않는다 (프로젝트 루트·드라이브·홈 디렉터리)', () => {
    const details = describeErrorDetails(new TypeError('x'));

    expect(details).not.toContain(PROJECT_ROOT);
    expect(details.replace(/\\/g, '/')).not.toContain(PROJECT_ROOT);
    expect(details).not.toMatch(/[A-Za-z]:[\\/]/);
    expect(details).not.toMatch(/\/(?:Users|home)\//);
    expect(details).not.toContain('file:');
  });

  it('describeError의 클래스명은 그대로다', () => {
    expect(describeError(new TypeError('x'))).toBe('TypeError');
  });
});

describe('describeErrorDetails — 허용 목록에 없는 것은 아무것도 붙이지 않는다', () => {
  it('일반 Error는 메시지도 위치도 남기지 않는다 (앱·라이브러리가 메시지에 값을 넣을 수 있다)', () => {
    expect(describeErrorDetails(new Error('MESSAGE_SECRET_VALUE'))).toBe('');
  });

  it('Prisma 모양의 오류(클래스명이 다르고 code가 있다)는 남기지 않는다', () => {
    class PrismaClientKnownRequestError extends Error {
      code = 'P2002';
    }
    expect(describeErrorDetails(new PrismaClientKnownRequestError('MESSAGE_SECRET_VALUE'))).toBe('');
  });

  it('내장 오류의 서브클래스는 제외한다 (라이브러리가 값을 담은 메시지를 만들 수 있다)', () => {
    class FooError extends TypeError {}
    expect(describeErrorDetails(new FooError('MESSAGE_SECRET_VALUE'))).toBe('');
  });

  it('이름만 TypeError로 위장한 오류는 제외한다 (이름이 아니라 프로토타입으로 판별)', () => {
    class Impostor extends Error {}
    Object.defineProperty(Impostor, 'name', { value: 'TypeError' });
    const error = new Impostor('MESSAGE_SECRET_VALUE');

    expect(describeError(error)).toBe('TypeError');
    expect(describeErrorDetails(error)).toBe('');
    expect(describeErrorDetails(Object.assign(new Error('MESSAGE_SECRET_VALUE'), { name: 'TypeError' }))).toBe('');
  });

  it('code가 있는 내장 오류(Node 내부 오류)는 제외한다 — 메시지에 받은 값이 실린다', () => {
    const error = Object.assign(new TypeError('The "path" argument must be of type string. Received \'MESSAGE_SECRET_VALUE\''), {
      code: 'ERR_INVALID_ARG_TYPE',
    });

    expect(describeErrorDetails(error)).toBe('');
    expect(describeError(error)).toBe('TypeError(code=ERR_INVALID_ARG_TYPE)');
  });

  it.each([
    ['문자열', 'MESSAGE_SECRET_VALUE'],
    ['null', null],
    ['undefined', undefined],
    ['일반 객체', { message: 'MESSAGE_SECRET_VALUE' }],
    ['숫자', 42],
  ])('오류 객체가 아닌 값(%s)은 제외한다', (_label, thrown) => {
    expect(describeErrorDetails(thrown)).toBe('');
  });
});

describe('describeErrorDetails — SyntaxError는 위치만 남긴다', () => {
  it('메시지(입력 조각이 실릴 수 있다)는 빼고 프레임만 남긴다', () => {
    const error = new SyntaxError('Unexpected token \'M\', "MESSAGE_SECRET_VALUE" is not valid JSON');

    const details = describeErrorDetails(error);

    expect(details).toContain(` | 위치: `);
    expect(details).toContain(THIS_FILE);
    expect(details).not.toContain('메시지');
    expect(details).not.toContain('MESSAGE_SECRET_VALUE');
  });
});

describe('describeErrorDetails — 메시지 정리', () => {
  it('줄바꿈·제어문자·줄 구분자를 공백 하나로 바꿔 한 줄로 만든다 (로그 위조 방지)', () => {
    const error = new TypeError('first\nFORGED LOG LINE\r\n\tthird\u2028fourth\u0007bell');

    expect(describeErrorDetails(error)).toContain('메시지: first FORGED LOG LINE third fourth bell |');
  });

  it('제어문자 제거가 일반 글자(p, {, })를 건드리지 않는다', () => {
    expect(describeErrorDetails(new TypeError('p{Cc} plain'))).toContain('메시지: p{Cc} plain |');
  });

  it('200자를 넘으면 자르고 말줄임표를 붙인다', () => {
    const details = describeErrorDetails(new RangeError('a'.repeat(500)));

    expect(details).toContain(`메시지: ${'a'.repeat(200)}… |`);
    expect(details).not.toContain('a'.repeat(201));
  });

  it('메시지 속 절대 경로를 가린다 (드라이브·파일 URL·POSIX)', () => {
    const details = describeErrorDetails(
      new TypeError(
        `bad C:\\Users\\PC\\secret\\a.js and file:///home/app/b.js and /home/ubuntu/app/c.js and (D:/x/y.ts)`,
      ),
    );

    expect(details).toContain('메시지: bad <경로> and <경로> and <경로> and (<경로>) |');
    for (const leak of ['C:\\Users', 'secret', '/home/', 'file:///']) {
      expect(details).not.toContain(leak);
    }
  });

  it('프로젝트 안의 경로는 루트를 떼고 상대 경로로 보여 준다 (슬래시·역슬래시 모두)', () => {
    const slash = describeErrorDetails(new TypeError(`Cannot find ${inRoot('dist/x.js')}`));
    const backslash = describeErrorDetails(
      new TypeError(`Cannot find ${inRoot('dist/x.js').replace(/\//g, '\\')}`),
    );

    expect(slash).toContain('메시지: Cannot find dist/x.js |');
    expect(backslash).toContain('메시지: Cannot find dist\\x.js |');
  });

  it('슬래시가 들어 있어도 경로가 아닌 값은 가리지 않는다', () => {
    expect(describeErrorDetails(new TypeError('expected text/plain or application/json'))).toContain(
      '메시지: expected text/plain or application/json |',
    );
  });

  it('메시지가 비어 있으면 메시지 항목은 붙이지 않는다', () => {
    const details = describeErrorDetails(new TypeError(''));

    expect(details).not.toContain('메시지');
    expect(details).toContain('위치: ');
  });
});

describe('describeErrorDetails — 스택 프레임 선택', () => {
  it('node 내부·프로젝트 밖 프레임을 건너뛰고 첫 프로젝트 프레임을 고른다 (함수 이름 포함)', () => {
    const error = withStack(new TypeError('boom'), [
      '    at Module._compile (node:internal/modules/cjs/loader:1554:14)',
      '    at foo (C:\\Other\\project\\lib.js:1:1)',
      `    at SongsService.update (${inRoot('dist/songs/songs.service.js')}:42:13)`,
      `    at later (${inRoot('dist/other.js')}:1:1)`,
    ]);

    expect(describeErrorDetails(error)).toBe(
      ' | 메시지: boom | 위치: SongsService.update (dist/songs/songs.service.js:42:13)',
    );
  });

  it('Windows 역슬래시 경로, 파일 URL, async 접두사, 함수 없는 프레임을 모두 상대 경로로 바꾼다', () => {
    const windows = withStack(new TypeError('a'), [
      `    at handler (${inRoot('src/a.ts').replace(/\//g, '\\')}:10:5)`,
    ]);
    const fileUrl = withStack(new TypeError('b'), [
      `    at file (${pathToFileURL(inRoot('dist/b.js')).href}:3:4)`,
    ]);
    const asyncFrame = withStack(new TypeError('c'), [
      `    at async Runner.run (${inRoot('dist/c.js')}:7:8)`,
    ]);
    const noFunction = withStack(new TypeError('d'), [`    at ${inRoot('dist/d.js')}:1:2`]);

    expect(describeErrorDetails(windows)).toContain('위치: handler (src/a.ts:10:5)');
    expect(describeErrorDetails(fileUrl)).toContain('위치: file (dist/b.js:3:4)');
    expect(describeErrorDetails(asyncFrame)).toContain('위치: Runner.run (dist/c.js:7:8)');
    expect(describeErrorDetails(noFunction)).toContain('위치: dist/d.js:1:2');
  });

  it('프로젝트 밖 프레임뿐이면 위치를 붙이지 않는다 (다른 경로를 절대 경로로 남기지 않는다)', () => {
    const error = withStack(new TypeError('boom'), [
      '    at x (C:\\Other\\project\\lib.js:1:1)',
      '    at y (/opt/other/app.js:2:2)',
      '    at node:internal/process/task_queues:105:5',
    ]);

    const details = describeErrorDetails(error);

    expect(details).toBe(' | 메시지: boom');
    expect(details).not.toContain('Other');
    expect(details).not.toContain('/opt/');
  });

  it('함수 이름에 경로나 이상한 문자가 있으면 이름은 버리고 위치만 남긴다', () => {
    const error = withStack(new TypeError('boom'), [
      `    at C:\\Users\\PC\\weird name;rm -rf (${inRoot('dist/e.js')}:1:2)`,
    ]);

    expect(describeErrorDetails(error)).toContain('위치: dist/e.js:1:2');
    expect(describeErrorDetails(error)).not.toContain('Users');
  });

  it('스택이 없거나 문자열이 아니면 위치 없이 메시지만 남긴다', () => {
    const noStack = new TypeError('boom');
    delete (noStack as { stack?: string }).stack;
    const weirdStack = Object.assign(new TypeError('boom'), { stack: 42 as unknown as string });

    expect(describeErrorDetails(noStack)).toBe(' | 메시지: boom');
    expect(describeErrorDetails(weirdStack)).toBe(' | 메시지: boom');
  });

  it('프레임이 아주 많아도 앞쪽만 훑는다 (프로젝트 프레임이 뒤에 있으면 못 찾을 수 있다)', () => {
    const noise = Array.from({ length: 100 }, () => '    at x (node:internal/a:1:1)');
    const error = withStack(new TypeError('boom'), [...noise, `    at late (${inRoot('dist/late.js')}:1:1)`]);

    expect(describeErrorDetails(error)).toBe(' | 메시지: boom');
  });
});

describe('로깅이 다시 실패하지 않는다', () => {
  it('접근하면 던지는 객체(Proxy)를 받아도 던지지 않는다', () => {
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error('trap');
        },
        getPrototypeOf() {
          throw new Error('trap');
        },
      },
    );

    expect(() => describeError(hostile)).not.toThrow();
    expect(describeError(hostile)).toBe('UnknownError');
    expect(() => describeErrorDetails(hostile)).not.toThrow();
    expect(describeErrorDetails(hostile)).toBe('');
  });

  it('message 접근자가 던지는 내장 오류도 던지지 않는다', () => {
    const error = new TypeError('x');
    Object.defineProperty(error, 'message', {
      get() {
        throw new Error('trap');
      },
    });

    expect(() => describeErrorDetails(error)).not.toThrow();
  });
});
