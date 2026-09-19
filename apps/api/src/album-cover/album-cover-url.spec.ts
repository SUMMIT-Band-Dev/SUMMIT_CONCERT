import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { assertAlbumCoverUrl, checkAlbumCoverUrl } from './album-cover-url.js';
import { ALBUM_COVER_URL_MAX_LENGTH } from './album-cover.constants.js';

/** 실제 `Setlist.album`에 들어 있는 값들(형태 확인용으로 그대로 가져왔다). */
const REAL_URLS = [
  'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/c8/a4/c6/c8a4c64f-89b3-9ef2-473f-4ad423a03c5b/887928030421.jpg/600x600bb.jpg',
  'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/af/66/ba/af66ba60-8f7d-1e51-6e08-1588b7f28f81/I_Often_Stammer_and_Forget_the_Way_to_Sleep.jpg/600x600bb.jpg',
];

describe('checkAlbumCoverUrl — 기존 데이터가 통과한다', () => {
  // 프로덕션 63건 전부가 이 규칙을 통과하고 오거부가 0건임을 SQL로 실측했다.
  // 여기서는 그중 형태가 다른 두 건(숫자 파일명 / 밑줄 섞인 긴 파일명)을 고정한다.
  it.each(REAL_URLS)('실제 저장된 값이 통과한다: %s', (url) => {
    expect(checkAlbumCoverUrl(url)).toBeNull();
  });

  it('기존 최장 URL(160자)이 상한에 걸리지 않는다', () => {
    const longest = REAL_URLS[1];

    expect(longest.length).toBeLessThanOrEqual(ALBUM_COVER_URL_MAX_LENGTH);
    expect(checkAlbumCoverUrl(longest)).toBeNull();
  });
});

describe('checkAlbumCoverUrl — 거부', () => {
  it.each([
    ['http', 'http://is1-ssl.mzstatic.com/image/thumb/A/1.jpg/600x600bb.jpg'],
    [
      '허용되지 않은 호스트',
      'https://evil.example.com/image/thumb/A/1.jpg/600x600bb.jpg',
    ],
    [
      '호스트를 접미사로만 흉내낸 경우',
      'https://is1-ssl.mzstatic.com.evil.example.com/image/thumb/A/1.jpg/600x600bb.jpg',
    ],
    [
      '사용자 정보가 붙은 경우',
      'https://someone@is1-ssl.mzstatic.com/image/thumb/A/1.jpg/600x600bb.jpg',
    ],
    [
      '포트가 붙은 경우',
      'https://is1-ssl.mzstatic.com:8443/image/thumb/A/1.jpg/600x600bb.jpg',
    ],
    [
      '크기가 600이 아님',
      'https://is1-ssl.mzstatic.com/image/thumb/A/1.jpg/100x100bb.jpg',
    ],
    [
      '경로 접두사가 다름',
      'https://is1-ssl.mzstatic.com/other/A/1.jpg/600x600bb.jpg',
    ],
    [
      '쿼리스트링이 붙은 경우',
      'https://is1-ssl.mzstatic.com/image/thumb/A/1.jpg/600x600bb.jpg?x=1',
    ],
    [
      '프래그먼트가 붙은 경우',
      'https://is1-ssl.mzstatic.com/image/thumb/A/1.jpg/600x600bb.jpg#x',
    ],
    ['URL이 아님', 'not-a-url'],
    ['레거시 상대경로', '/album-yeongdong-gayone.png'],
    ['javascript 스킴', 'javascript:alert(1)'],
    ['data 스킴', 'data:image/png;base64,AAAA'],
  ])('%s는 거부한다', (_name, url) => {
    expect(checkAlbumCoverUrl(url)).not.toBeNull();
  });

  it('길이 상한을 넘으면 거부한다', () => {
    const padding = 'a'.repeat(ALBUM_COVER_URL_MAX_LENGTH);
    const tooLong = `https://is1-ssl.mzstatic.com/image/thumb/${padding}/1.jpg/600x600bb.jpg`;

    expect(tooLong.length).toBeGreaterThan(ALBUM_COVER_URL_MAX_LENGTH);
    expect(checkAlbumCoverUrl(tooLong)).toMatch(/길이 초과/);
  });

  it('거부 사유를 사람이 읽을 수 있게 돌려준다(벤치마크 보고용)', () => {
    expect(
      checkAlbumCoverUrl(
        'https://is2-ssl.mzstatic.com/image/thumb/A/1.jpg/600x600bb.jpg',
      ),
    ).toContain('is2-ssl.mzstatic.com');
  });
});

describe('assertAlbumCoverUrl', () => {
  it('통과하면 아무것도 던지지 않는다', () => {
    expect(() => assertAlbumCoverUrl(REAL_URLS[0])).not.toThrow();
  });

  it('거부되면 400이다', () => {
    expect(() => assertAlbumCoverUrl('http://example.com')).toThrow(
      BadRequestException,
    );
  });

  it('응답 메시지에 거부 사유 원문을 노출하지 않는다', () => {
    // 사유는 내부 판단 근거라 그대로 내보내면 allowlist 구성이 드러난다
    try {
      assertAlbumCoverUrl('https://evil.example.com/a/600x600bb.jpg');
      expect.unreachable('예외가 발생해야 한다');
    } catch (error) {
      expect((error as BadRequestException).message).not.toContain(
        'evil.example.com',
      );
    }
  });
});
