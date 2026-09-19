/**
 * 이미지 저장소 접근 계약 (PRD F007).
 *
 * 인터페이스로 두는 이유는 단위 테스트에서 대역으로 갈아 끼우기 위해서다 —
 * 업로드 실패·타임아웃·보상 삭제 같은 경로는 실제 저장소로는 재현하기 어렵다.
 */
export const STORAGE_CLIENT = 'STORAGE_CLIENT';

export interface StorageUploadInput {
  /** 버킷 내부 경로. 버킷 이름은 포함하지 않는다 */
  path: string;
  body: Buffer;
  /** 매직바이트로 판별한 값. 업로드 파일명에서 오지 않는다 */
  contentType: string;
  cacheControlSeconds: number;
}

/** 버킷 설정 확인용(스모크 체크). 실제 스펙이 제안 스펙과 맞는지 대조하는 데 쓴다. */
export interface StorageBucketInfo {
  id: string;
  public: boolean;
  fileSizeLimit: number | null;
  allowedMimeTypes: string[] | null;
}

export interface StorageClient {
  /** 버킷 이름. 로그·검증 스크립트가 참조한다 */
  readonly bucketName: string;
  upload(input: StorageUploadInput): Promise<void>;
  remove(paths: string[]): Promise<void>;
  getPublicUrl(path: string): string;
  getBucket(): Promise<StorageBucketInfo>;
}

/**
 * 요청이 타임아웃으로 끊긴 경우.
 *
 * **"실패"가 아니라 "결과를 모른다"는 뜻이다.** 객체가 올라갔을 수도 있으므로
 * 호출자가 보상 삭제를 하면 성공한 업로드를 지울 수 있다. 다른 실패와 구분하려고
 * 별도 타입으로 둔다.
 */
export class StorageTimeoutError extends Error {}

/** 타임아웃 외의 저장소 실패. `status`는 응답을 받았을 때만 채워진다. */
export class StorageRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
