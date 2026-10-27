import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isTimeoutError } from '../common/abort.js';
import {
  GEOCODE_FAILED_MESSAGE,
  GEOCODE_NOT_FOUND_MESSAGE,
  GEOCODE_TIMEOUT_MESSAGE,
  GEOCODE_TIMEOUT_MS,
  NAVER_GEOCODE_ENDPOINT,
} from './geocoding.constants.js';

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(config: ConfigService) {
    const read = (key: string) => {
      const raw = config.get<unknown>(key);
      const value = typeof raw === 'string' ? raw.trim() : '';
      if (!value) throw new Error(`${key}를 설정해 주세요.`);
      return value;
    };
    this.clientId = read('NAVER_MAP_CLIENT_ID');
    this.clientSecret = read('NAVER_MAP_CLIENT_SECRET');
  }

  async geocode(
    address: string,
  ): Promise<{ latitude: number; longitude: number; roadAddress: string }> {
    const url = new URL(NAVER_GEOCODE_ENDPOINT);
    url.searchParams.set('query', address);
    url.searchParams.set('count', '1');
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-ncp-apigw-api-key-id': this.clientId,
          'x-ncp-apigw-api-key': this.clientSecret,
          accept: 'application/json',
        },
        signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS),
        redirect: 'error',
      });
    } catch (error) {
      return this.fail(isTimeoutError(error) ? 'timeout' : 'network');
    }
    if (!response.ok) return this.fail(String(response.status));
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      return this.fail(isTimeoutError(error) ? 'timeout' : 'invalid-response');
    }
    if (
      !isRecord(body) ||
      body.status !== 'OK' ||
      !Array.isArray(body.addresses)
    ) {
      return this.fail('invalid-response');
    }
    if (body.addresses.length === 0) {
      this.logger.warn('invalid-response');
      throw new NotFoundException(GEOCODE_NOT_FOUND_MESSAGE);
    }
    const first: unknown = body.addresses[0];
    if (
      !isRecord(first) ||
      typeof first.x !== 'string' ||
      typeof first.y !== 'string' ||
      !first.x.trim() ||
      !first.y.trim()
    ) {
      return this.fail('invalid-response');
    }
    const latitude = Number(first.y);
    const longitude = Number(first.x);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return this.fail('invalid-response');
    }
    if (
      typeof first.roadAddress !== 'string' ||
      typeof first.jibunAddress !== 'string'
    ) {
      return this.fail('invalid-response');
    }
    return {
      latitude,
      longitude,
      roadAddress: first.roadAddress || first.jibunAddress || address,
    };
  }

  private fail(kind: string): never {
    this.logger.warn(kind);
    if (kind === 'timeout')
      throw new GatewayTimeoutException(GEOCODE_TIMEOUT_MESSAGE);
    throw new BadGatewayException(GEOCODE_FAILED_MESSAGE);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
