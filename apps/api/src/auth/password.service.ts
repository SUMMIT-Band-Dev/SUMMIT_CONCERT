import { Injectable, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { type Algorithm, hash, verify } from '@node-rs/argon2';

// @node-rs/argon2의 Algorithm은 ambient const enum이라 isolatedModules 환경에서는
// 값으로 참조할 수 없다(런타임 export도 비어 있음). 타입만 빌려오고 값은
// 선언된 멤버 값(Argon2id = 2)을 리터럴로 고정한다.
const ARGON2ID: Algorithm = 2;

// OWASP Password Storage Cheat Sheet의 Argon2id 권장 파라미터를 명시적으로 고정한다.
// 라이브러리 기본값과 현재는 같지만, 버전이 올라가면서 기본값이 바뀌어도
// 해싱 비용이 조용히 달라지지 않도록 코드에 박아 둔다.
// (m=19MiB, t=2, p=1 — 이 장비 기준 1회 해싱 약 15ms)
const ARGON2_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19456, // KiB 단위 = 19MiB
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * 비밀번호 해싱/검증을 한 곳에 모아 두는 서비스.
 * 해시 파라미터를 바꿀 일이 생겨도 이 파일만 고치면 되도록 캡슐화한다.
 */
@Injectable()
export class PasswordService implements OnModuleInit {
  // 존재하지 않는 계정으로 로그인 시도가 들어왔을 때 대신 검증할 더미 해시.
  // 실제 계정과 동일한 검증 비용을 치르게 해서, 응답 시간 차이로
  // 계정 존재 여부를 알아내는 것(user enumeration)을 막는다.
  private dummyHash!: string;

  async onModuleInit(): Promise<void> {
    // 매 기동마다 임의 값으로 만든다 — 이 해시에 대응하는 평문은 어디에도 없다.
    this.dummyHash = await hash(randomBytes(32).toString('base64'), ARGON2_OPTIONS);
  }

  /** 평문 비밀번호를 argon2id 해시(PHC 문자열)로 만든다. */
  hash(plain: string): Promise<string> {
    return hash(plain, ARGON2_OPTIONS);
  }

  /**
   * 저장된 해시와 평문을 비교한다.
   * 파라미터는 PHC 문자열 안에 들어 있으므로 별도로 넘기지 않는다
   * — 그래야 나중에 파라미터를 올려도 기존 해시 검증이 깨지지 않는다.
   */
  async verify(hashed: string, plain: string): Promise<boolean> {
    try {
      return await verify(hashed, plain);
    } catch {
      // 해시 문자열이 손상됐거나 형식이 다른 경우. 검증 실패로만 취급한다.
      return false;
    }
  }

  /** 계정이 없을 때 호출해 검증 비용만 동일하게 소모시킨다. 결과는 쓰지 않는다. */
  async burnVerifyCost(plain: string): Promise<void> {
    await this.verify(this.dummyHash, plain);
  }
}
