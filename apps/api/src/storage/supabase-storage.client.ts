import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isTimeoutError } from '../common/abort.js';
import {
  DEFAULT_STORAGE_BUCKET,
  STORAGE_TIMEOUT_MS,
} from './storage.constants.js';
import {
  StorageRequestError,
  StorageTimeoutError,
  type StorageBucketInfo,
  type StorageClient,
  type StorageUploadInput,
} from './storage.client.js';

/** Storage REST의 버킷 조회 응답 중 실제로 쓰는 필드만. */
interface BucketResponseBody {
  id?: unknown;
  public?: unknown;
  file_size_limit?: unknown;
  allowed_mime_types?: unknown;
}

/**
 * Supabase Storage REST 클라이언트 (PRD F007).
 *
 * `@supabase/supabase-js`를 쓰지 않고 fetch로 직접 부른다. 필요한 건 객체 업로드/삭제/조회
 * 세 개뿐이라 SDK 하나를 통째로 들이는 것보다 의존성이 가볍고, 단위 테스트에서 fetch 대역
 * 하나만 두면 모든 경로를 재현할 수 있다.
 *
 * 요청 형태는 추측이 아니라 `@supabase/storage-js`의 실제 소스(`StorageFileApi`)를 확인해
 * 그대로 재현했다:
 * - 업로드: `POST {url}/object/{bucket}/{path}`, body는 raw binary,
 *   헤더 `x-upsert` / `cache-control: max-age=N` / `content-type`
 * - 삭제: `DELETE {url}/object/{bucket}`, body `{ prefixes: [...] }`
 * - 공개 URL: `{url}/object/public/{bucket}/{path}`
 *
 * 인증 헤더는 `apikey`와 `Authorization`을 **둘 다** 보낸다. supabase-js가 하위 클라이언트에
 * 넘기는 조합이 그 둘이고, secret 키가 `Authorization`만으로 통하는지는 확인하지 못했기
 * 때문이다. 확인 전까지 좁히지 않는다.
 */
@Injectable()
export class SupabaseStorageClient implements StorageClient {
  readonly bucketName: string;

  /** `https://<ref>.supabase.co/storage/v1` */
  private readonly baseUrl: string;

  private readonly authHeaders: Readonly<Record<string, string>>;

  constructor(config: ConfigService) {
    // 시크릿이 없으면 기동 자체를 실패시킨다 (JWT_SECRET과 같은 방침).
    // 기본값을 두면 설정을 빠뜨린 채 배포될 수 있다.
    const projectUrl = config.getOrThrow<string>('SUPABASE_URL').trim();
    const secretKey = config.getOrThrow<string>('SUPABASE_SECRET_KEY').trim();

    if (!projectUrl || !secretKey) {
      throw new Error(
        'SUPABASE_URL과 SUPABASE_SECRET_KEY는 비어 있을 수 없습니다.',
      );
    }

    this.bucketName =
      config.get<string>('SUPABASE_STORAGE_BUCKET')?.trim() ||
      DEFAULT_STORAGE_BUCKET;
    this.baseUrl = `${projectUrl.replace(/\/+$/, '')}/storage/v1`;
    this.authHeaders = Object.freeze({
      apikey: secretKey,
      authorization: `Bearer ${secretKey}`,
    });
  }

  async upload({
    path,
    body,
    contentType,
    cacheControlSeconds,
  }: StorageUploadInput): Promise<void> {
    await this.request(
      `${this.baseUrl}/object/${this.bucketName}/${path}`,
      {
        method: 'POST',
        headers: {
          ...this.authHeaders,
          // 덮어쓰기 금지. 경로가 이미 있으면 조용히 덮는 대신 400으로 실패한다
          'x-upsert': 'false',
          'cache-control': `max-age=${cacheControlSeconds}`,
          'content-type': contentType,
        },
        // `Buffer`를 그대로 넘기면 타입이 `BodyInit`에 맞지 않는다 — `Buffer`의 백킹
        // 버퍼가 `SharedArrayBuffer`일 수도 있다고 보기 때문이다. 캐스팅으로 눌러두는
        // 대신 한 번 복사해서 타입을 정직하게 맞춘다 (상한이 1MB라 비용은 무시할 수준).
        body: new Uint8Array(body),
      },
      '이미지 업로드',
    );
  }

  async remove(paths: string[]): Promise<void> {
    await this.request(
      `${this.baseUrl}/object/${this.bucketName}`,
      {
        method: 'DELETE',
        headers: { ...this.authHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({ prefixes: paths }),
      },
      '이미지 삭제',
    );
  }

  /**
   * public 버킷의 공개 URL.
   *
   * 경로는 우리가 `{teamId}/{uuid}.{ext}` 형태로 직접 만들기 때문에 URL 안전 문자만
   * 들어간다 — 그래서 인코딩하지 않는다. 외부 입력을 경로로 받는 날이 오면 이 전제가 깨진다.
   */
  getPublicUrl(path: string): string {
    return `${this.baseUrl}/object/public/${this.bucketName}/${path}`;
  }

  async getBucket(): Promise<StorageBucketInfo> {
    const response = await this.request(
      `${this.baseUrl}/bucket/${this.bucketName}`,
      { method: 'GET', headers: { ...this.authHeaders } },
      '버킷 조회',
    );

    let body: BucketResponseBody;
    try {
      body = (await response.json()) as BucketResponseBody;
    } catch {
      throw new StorageRequestError('버킷 조회 응답을 해석하지 못했습니다.');
    }

    return {
      id: typeof body.id === 'string' ? body.id : this.bucketName,
      public: body.public === true,
      fileSizeLimit:
        typeof body.file_size_limit === 'number' ? body.file_size_limit : null,
      allowedMimeTypes: Array.isArray(body.allowed_mime_types)
        ? body.allowed_mime_types.map(String)
        : null,
    };
  }

  /**
   * 공통 요청 처리. 타임아웃만 따로 구분하고 나머지는 한 종류로 묶는다.
   *
   * **원본 에러를 `cause`로 달지 않는다.** 여기서 만드는 문자열에는 상태코드와 동작 이름만
   * 들어가는데, 원본 예외까지 붙이면 그 안에 무엇이 실려 오는지를 우리가 보장할 수 없다.
   * 이 객체는 로그와 응답으로 흘러가므로 "우리가 넣은 것만 들어 있다"가 보장돼야 한다.
   * (헤더는 어느 경로로도 메시지에 들어가지 않는다 — 테스트로 고정한다)
   */
  private async request(
    url: string,
    init: RequestInit,
    description: string,
  ): Promise<Response> {
    let response: Response;

    try {
      response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(STORAGE_TIMEOUT_MS),
      });
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new StorageTimeoutError(
          `${description} 요청이 ${STORAGE_TIMEOUT_MS}ms 안에 끝나지 않았습니다.`,
        );
      }
      throw new StorageRequestError(`${description} 요청에 실패했습니다.`);
    }

    if (!response.ok) {
      throw new StorageRequestError(
        `${description} 요청이 실패했습니다 (HTTP ${response.status}).`,
        response.status,
      );
    }

    return response;
  }
}
