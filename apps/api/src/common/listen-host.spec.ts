import { describe, expect, it } from 'vitest';
import { DEFAULT_LISTEN_HOST, buildListenHostWarning, parseListenHost } from './listen-host.js';

describe('parseListenHost — 기동 시 검증', () => {
  it.each([
    ['미설정', undefined],
    ['빈 문자열', ''],
    ['공백만', '   '],
    ['개행만', '\r\n'],
  ])('%s이면 127.0.0.1(루프백만)이다 — 기본은 닫혀 있어야 한다', (_label, value) => {
    expect(parseListenHost(value)).toBe(DEFAULT_LISTEN_HOST);
    expect(DEFAULT_LISTEN_HOST).toBe('127.0.0.1');
  });

  it.each([
    ['127.0.0.1', '127.0.0.1'],
    [' 0.0.0.0 ', '0.0.0.0'],
    ['::1', '::1'],
    ['::', '::'],
  ])('"%s"는 %s로 읽는다', (raw, expected) => {
    expect(parseListenHost(raw)).toBe(expected);
  });

  it.each([
    ['이름(해석 결과가 OS마다 다름)', 'localhost'],
    ['도메인', 'api.example.com'],
    ['포트 포함', '127.0.0.1:3001'],
    ['URL', 'http://127.0.0.1'],
    ['대괄호 IPv6', '[::1]'],
  ])('%s는 기동을 막는다', (_label, raw) => {
    expect(() => parseListenHost(raw)).toThrow('IP 주소여야');
  });

  it('오류 메시지에 입력 값을 출력하지 않는다', () => {
    let message = '';
    try {
      parseListenHost('ECHOMARK.internal');
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).not.toBe('');
    expect(message).not.toContain('ECHOMARK');
  });
});

describe('buildListenHostWarning — 루프백이 아닐 때 기동 경고', () => {
  it.each(['127.0.0.1', '127.0.1.1', '::1'])('%s(루프백)이면 경고가 없다', (host) => {
    expect(buildListenHostWarning(host)).toBeUndefined();
  });

  it.each(['0.0.0.0', '::', '10.0.0.5'])('%s이면 주소와 함께 노출 위험을 알린다', (host) => {
    const warning = buildListenHostWarning(host) as string;

    expect(warning).toContain(`LISTEN_HOST=${host}`);
    expect(warning).toContain('방화벽');
    expect(warning).not.toContain('\n');
  });
});
