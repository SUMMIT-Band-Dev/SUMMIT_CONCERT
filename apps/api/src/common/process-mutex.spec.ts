import { describe, expect, it } from 'vitest';
import { ProcessMutex } from './process-mutex.js';

const defer = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });

  return { promise, resolve };
};

describe('ProcessMutex', () => {
  it('비어 있으면 작업을 실행하고 결과를 돌려준다', async () => {
    const mutex = new ProcessMutex();

    await expect(mutex.tryRun(async () => 42)).resolves.toEqual({ ran: true, value: 42 });
  });

  it('이미 잡혀 있으면 기다리지 않고 거절한다', async () => {
    // 대기열을 두면 배치 버튼을 두 번 누른 관리자에게 같은 작업이 두 번 돌아간다.
    const mutex = new ProcessMutex();
    const gate = defer();

    const first = mutex.tryRun(() => gate.promise);
    const second = await mutex.tryRun(async () => 'should not run');

    expect(second).toEqual({ ran: false });

    gate.resolve();
    await first;
  });

  it('작업이 끝나면 다시 잡을 수 있다', async () => {
    const mutex = new ProcessMutex();

    await mutex.tryRun(async () => 1);

    await expect(mutex.tryRun(async () => 2)).resolves.toEqual({ ran: true, value: 2 });
  });

  it('작업이 예외를 던져도 잠금이 풀린다', async () => {
    // finally로 풀지 않으면 한 번 실패한 뒤 배치가 영영 막힌다.
    const mutex = new ProcessMutex();

    await expect(
      mutex.tryRun(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(mutex.isLocked).toBe(false);
    await expect(mutex.tryRun(async () => 'ok')).resolves.toEqual({ ran: true, value: 'ok' });
  });

  it('isLocked가 실행 중에만 true다', async () => {
    const mutex = new ProcessMutex();
    const gate = defer();

    expect(mutex.isLocked).toBe(false);
    const running = mutex.tryRun(() => gate.promise);
    expect(mutex.isLocked).toBe(true);

    gate.resolve();
    await running;
    expect(mutex.isLocked).toBe(false);
  });
});
