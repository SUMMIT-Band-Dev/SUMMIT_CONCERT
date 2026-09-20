/**
 * 프로세스 안에서 한 번에 하나만 실행되게 하는 최소 mutex.
 *
 * ## 왜 DB advisory lock이 아닌가
 *
 * 세션 레벨 `pg_try_advisory_lock`은 **이 코드베이스에서 안전하지 않다.**
 * `PrismaService`는 `PrismaPg`에 connectionString만 넘기므로 어댑터가 `pg.Pool`
 * (기본 크기 10)을 만들고, 트랜잭션 밖의 `$queryRaw`는 매번 풀에서 커넥션을 빌렸다
 * 반납한다(`@prisma/adapter-pg`의 `PgQueryable.performIO` → `pool.query`).
 * 즉 잠금을 잡은 커넥션과 푸는 커넥션이 다를 수 있고, 그러면 `pg_advisory_unlock`이
 * false를 돌려주며 잠금이 남는다. 커넥션을 고정하는 `startTransaction` 경로를 쓰면
 * 해결되지만, 그건 **외부 I/O 동안 트랜잭션을 열어 두는 것**이라 원칙에 어긋난다.
 *
 * ## 전제와 한계
 *
 * ⚠️ **단일 상주 인스턴스 전제다.** 프로세스가 둘이면 서로의 mutex를 보지 못한다.
 * `OutboundRateLimiter`(§13)가 인메모리인 것과 같은 전제이며, 스케일아웃이 논의되는
 * 시점에 두 가지를 **함께** 공유 저장소 기반으로 옮긴다.
 * 검증 중에는 같은 DB에 다른 서버 인스턴스를 띄우지 않는다.
 *
 * 다중 프로세스에서 실제로 위험한 것은 "같은 곡 중복 예약"이 아니라 **일일 상한 초과**인데,
 * 그건 두 프로세스가 사용량 COUNT를 동시에 읽는 TOCTOU라 곡 단위 부분 유니크 인덱스로는
 * 막히지 않는다. 구멍 하나만 막는 비대칭 방어를 하지 않기로 한 판단이다.
 */
export class ProcessMutex {
  private locked = false;

  /** 지금 누가 잡고 있는지. 두 번째 요청을 409로 떨어뜨리는 판단에 쓴다. */
  get isLocked(): boolean {
    return this.locked;
  }

  /**
   * 잠금을 잡고 `task`를 실행한다. 이미 잡혀 있으면 **기다리지 않고** null을 돌려준다.
   *
   * 대기열을 두지 않는 이유는 이 mutex의 목적이 "직렬화"가 아니라 "중복 실행 거부"이기
   * 때문이다. 배치 버튼을 두 번 누른 관리자를 기다리게 하면 같은 작업이 두 번 돌아간다.
   */
  async tryRun<T>(task: () => Promise<T>): Promise<{ ran: true; value: T } | { ran: false }> {
    if (this.locked) {
      return { ran: false };
    }

    this.locked = true;
    try {
      return { ran: true, value: await task() };
    } finally {
      this.locked = false;
    }
  }
}
