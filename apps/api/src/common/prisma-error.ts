import { ConflictException, NotFoundException } from '@nestjs/common';

/** Prisma가 던진 에러인지 코드로 판별한다. 예외 클래스를 직접 import하지 않아 생성 클라이언트 구조에 덜 묶인다. */
export function isPrismaErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}

/**
 * Prisma의 `P2025`(갱신 대상 레코드 없음)를 404로 바꾼다.
 *
 * 지금 구조에서는 갱신 직전에 존재를 확인하므로 정상 경로에서는 발생하지 않는다.
 * 그래도 감싸 두는 이유는, Supabase 콘솔처럼 API 밖에서 행이 사라졌을 때
 * `P2025`가 그대로 500으로 새어 나가면 원인을 알 수 없기 때문이다.
 */
export async function mapRecordNotFound<T>(
  operation: Promise<T>,
  message: string,
): Promise<T> {
  try {
    return await operation;
  } catch (error) {
    if (isPrismaErrorCode(error, 'P2025')) {
      throw new NotFoundException(message);
    }
    throw error;
  }
}

/**
 * Prisma의 `P2002`(unique 제약 위반)를 409로 바꾼다.
 *
 * `Line Up`에는 unique 인덱스가 PK뿐이라 "도달할 수 없는 분기"로 판단했었는데,
 * 실제 런타임 검증에서 **PK 자체가 터졌다**. 기존 행(1~15)이 Supabase 콘솔/CSV로
 * id를 명시해 들어가 BIGSERIAL 시퀀스가 전진하지 않았고, 그래서 `nextval`이 이미
 * 존재하는 id를 돌려준 것이다 (마이그레이션 `20260919210000_resync_id_sequences`로 교정).
 *
 * 시퀀스를 맞춘 지금은 정상 경로에서 발생하지 않지만, 같은 방식으로 데이터를
 * 직접 밀어 넣으면 언제든 재발할 수 있다. 그때 500 대신 원인을 말해 주도록 남겨 둔다.
 */
export async function mapUniqueViolation<T>(
  operation: Promise<T>,
  message: string,
): Promise<T> {
  try {
    return await operation;
  } catch (error) {
    if (isPrismaErrorCode(error, 'P2002')) {
      throw new ConflictException(message);
    }
    throw error;
  }
}

/**
 * Prisma의 `P2003`(FK 제약 위반)을 404로 바꾼다.
 *
 * 곡 등록에서 `Setlist.teamId`가 가리키는 팀이 없을 때 나는 코드다.
 * 4단계 현재 구조에서는 등록 트랜잭션이 대상 팀 행을 `FOR NO KEY UPDATE`로
 * 먼저 잠그므로(팀이 이미 없으면 그 시점에 404), **동시 삭제로 이 경로에
 * 도달할 수는 없다고 판단한다.**
 *
 * 그런데도 남겨 두는 이유는 §11에서 "`P2002`는 도달 불가"라고 단정했다가
 * 런타임 검증에서 실제로 터진 선례가 있기 때문이다. "제약을 확인했다"와
 * "위반될 경로가 없다"는 같은 말이 아니다 — 방어용으로 유지하고,
 * 만약 실제로 발생한다면 500이 아니라 원인을 말해 주게 한다.
 */
export async function mapForeignKeyViolation<T>(
  operation: Promise<T>,
  message: string,
): Promise<T> {
  try {
    return await operation;
  } catch (error) {
    if (isPrismaErrorCode(error, 'P2003')) {
      throw new NotFoundException(message);
    }
    throw error;
  }
}
