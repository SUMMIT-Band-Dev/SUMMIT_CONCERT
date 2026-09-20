import { describe, expect, it } from 'vitest';
import { MAX_TRUST_PROXY_HOPS, buildTrustProxyWarning, parseTrustProxyHops } from './trust-proxy.js';

describe('parseTrustProxyHops — 기동 시 검증', () => {
  it.each([
    ['미설정', undefined],
    ['빈 문자열', ''],
    ['공백만', '   '],
    ['개행만', '\r\n'],
  ])('%s이면 0(믿지 않음)이다 — 기본은 닫혀 있어야 한다', (_label, value) => {
    expect(parseTrustProxyHops(value)).toBe(0);
  });

  it.each([
    ['0', 0],
    ['1', 1],
    [' 2 ', 2],
    [String(MAX_TRUST_PROXY_HOPS), MAX_TRUST_PROXY_HOPS],
  ])('"%s"는 %i로 읽는다', (raw, expected) => {
    expect(parseTrustProxyHops(raw)).toBe(expected);
  });

  it.each([
    ['음수', '-1'],
    ['소수', '1.5'],
    ['문자', 'true'],
    ['IP 주소(Express가 받는 다른 형식)', '10.0.0.1'],
    ['지수 표기', '1e1'],
    ['16진수', '0x1'],
  ])('%s는 기동을 막는다', (_label, raw) => {
    expect(() => parseTrustProxyHops(raw)).toThrow('0 이상의 정수');
  });

  it('상한을 넘으면 기동을 막는다 (오타로 신뢰 범위가 넓어지는 것 방지)', () => {
    expect(() => parseTrustProxyHops(String(MAX_TRUST_PROXY_HOPS + 1))).toThrow('너무 큽니다');
  });
});

describe('parseTrustProxyHops — 오류 메시지에 입력 값을 출력하지 않는다 (교차 리뷰 L10)', () => {
  it.each([
    ['문자', 'ECHOMARK'],
    ['음수', '-777'],
    ['소수', '1.5ECHOMARK'],
    ['IP 주소', '10.0.0.1'],
    ['상한 초과', '98765'],
  ])('%s: 메시지에 입력이 없다', (_label, raw) => {
    let message = '';
    try {
      parseTrustProxyHops(raw);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).not.toBe('');
    expect(message).not.toMatch(/ECHOMARK|777|98765|10\.0\.0\.1/);
  });
});

describe('buildTrustProxyWarning — 0이 아닐 때 기동 경고 (M1)', () => {
  it('0(기본)이면 경고가 없다', () => {
    expect(buildTrustProxyWarning(0)).toBeUndefined();
  });

  it.each([1, 2, MAX_TRUST_PROXY_HOPS])('%i이면 값과 함께 배포 전제를 알린다', (hops) => {
    const warning = buildTrustProxyWarning(hops) as string;

    expect(warning).toContain(`TRUST_PROXY_HOPS=${hops}`);
    expect(warning).toContain('프록시에서만 접근');
    expect(warning).toContain('실제 프록시 수');
    expect(warning).not.toContain('\n');
  });
});
