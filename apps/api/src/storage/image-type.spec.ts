import { describe, expect, it } from 'vitest';
import { detectImageFormat } from './image-type.js';

const jpeg = (...rest: number[]) => Buffer.from([0xff, 0xd8, 0xff, ...rest]);
const png = (...rest: number[]) =>
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...rest]);
const webp = () =>
  Buffer.concat([
    Buffer.from('RIFF', 'ascii'),
    Buffer.from([0x24, 0x00, 0x00, 0x00]), // 길이 필드 (내용 무관)
    Buffer.from('WEBP', 'ascii'),
    Buffer.from('VP8 ', 'ascii'),
  ]);

describe('detectImageFormat — 허용 형식', () => {
  it('JPEG를 판별한다', () => {
    expect(detectImageFormat(jpeg(0xe0, 0x00))).toEqual({
      mimeType: 'image/jpeg',
      extension: 'jpg',
    });
  });

  it('PNG를 판별한다', () => {
    expect(detectImageFormat(png(0x00, 0x00))).toEqual({
      mimeType: 'image/png',
      extension: 'png',
    });
  });

  it('WebP는 RIFF 길이 필드를 건너뛰고 판별한다', () => {
    expect(detectImageFormat(webp())).toEqual({
      mimeType: 'image/webp',
      extension: 'webp',
    });
  });

  // 이 레포의 실데이터가 정확히 이 모양이다 — public/day*.png 15개는 확장자만 .png이고
  // 실제 바이트는 JPEG다. 확장자를 믿었다면 PNG로 저장됐을 것이다.
  it('확장자가 .png여도 바이트가 JPEG면 JPEG로 판별한다', () => {
    expect(detectImageFormat(jpeg(0xe0))?.extension).toBe('jpg');
  });
});

describe('detectImageFormat — 거부', () => {
  it.each([
    ['SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
    ['XML 선언으로 시작하는 SVG', Buffer.from('<?xml version="1.0"?><svg/>')],
    ['GIF', Buffer.from('GIF89a')],
    ['빈 버퍼', Buffer.alloc(0)],
    ['평문', Buffer.from('not an image')],
    ['JPEG 시그니처 앞 1바이트가 다름', Buffer.from([0xfe, 0xd8, 0xff, 0xe0])],
    ['RIFF지만 WEBP가 아님(WAV)', Buffer.concat([
      Buffer.from('RIFF', 'ascii'),
      Buffer.from([0x24, 0x00, 0x00, 0x00]),
      Buffer.from('WAVE', 'ascii'),
    ])],
    ['RIFF로 시작하지만 12바이트 미만', Buffer.from('RIFF1234', 'ascii')],
  ])('%s는 null이다', (_name, buffer) => {
    expect(detectImageFormat(buffer)).toBeNull();
  });

  it('시그니처가 중간에 있으면 판별하지 않는다', () => {
    // 접두사 비교이므로 파일 어딘가에 JPEG 바이트가 섞여 있어도 통과하면 안 된다
    expect(detectImageFormat(Buffer.from([0x00, 0xff, 0xd8, 0xff]))).toBeNull();
  });
});
