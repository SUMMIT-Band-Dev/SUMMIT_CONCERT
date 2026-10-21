import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isTimeoutError } from '../common/abort.js';
import type { ContentTag } from './content-tags.js';
import {
  MIN_REVALIDATE_SECRET_LENGTH,
  REVALIDATE_TIMEOUT_MS,
} from './revalidation.constants.js';

@Injectable()
export class RevalidationService {
  private readonly logger = new Logger(RevalidationService.name);
  private readonly siteUrl: string;
  private readonly secret: string;

  constructor(config: ConfigService) {
    const rawUrl = config.get<unknown>('PUBLIC_SITE_URL');
    const value = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error(
        'PUBLIC_SITE_URL에 올바른 공개 사이트 주소를 설정해 주세요.',
      );
    }
    const localHttp =
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(url.hostname);
    if (
      (url.protocol !== 'https:' && !localHttp) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      value.includes('?') ||
      value.includes('#') ||
      value.endsWith('/')
    ) {
      throw new Error(
        'PUBLIC_SITE_URL의 스킴·사용자 정보·경로·쿼리·해시·끝 슬래시를 확인해 주세요.',
      );
    }
    this.siteUrl = url.origin;

    const rawSecret = config.get<unknown>('REVALIDATE_SECRET');
    const secret = typeof rawSecret === 'string' ? rawSecret.trim() : '';
    if (secret.length < MIN_REVALIDATE_SECRET_LENGTH) {
      throw new Error(
        `REVALIDATE_SECRET은 ${MIN_REVALIDATE_SECRET_LENGTH}자 이상으로 설정해 주세요.`,
      );
    }
    this.secret = secret;
  }

  async revalidate(tags: readonly ContentTag[]): Promise<boolean> {
    const uniqueTags = [...new Set(tags)];
    if (uniqueTags.length === 0) return true;

    try {
      const response = await fetch(`${this.siteUrl}/api/revalidate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-revalidate-secret': this.secret,
        },
        body: JSON.stringify({ tags: uniqueTags }),
        redirect: 'error',
        signal: AbortSignal.timeout(REVALIDATE_TIMEOUT_MS),
      });
      if (response.ok) return true;
      this.logger.warn(
        `재검증 실패 tags=${uniqueTags.join(',')} HTTP ${response.status}`,
      );
    } catch (error) {
      this.logger.warn(
        `재검증 실패 tags=${uniqueTags.join(',')} ${isTimeoutError(error) ? 'timeout' : 'network'}`,
      );
    }
    return false;
  }
}
