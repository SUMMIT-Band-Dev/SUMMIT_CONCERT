import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { UpdateAlbumCoverDto } from './update-album-cover.dto.js';
import { ALBUM_COVER_URL_MAX_LENGTH } from '../album-cover.constants.js';

// main.ts의 전역 설정을 그대로 재현한다. 여기서만 다른 옵션을 쓰면
// 테스트는 통과하는데 실제 요청은 다르게 동작하는 상황이 생긴다.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  stopAtFirstError: true,
});

const meta: ArgumentMetadata = { type: 'body', metatype: UpdateAlbumCoverDto };

const validate = (payload: unknown) =>
  pipe.transform(payload, meta) as Promise<UpdateAlbumCoverDto>;

const messageOf = async (payload: unknown) => {
  try {
    await validate(payload);
    throw new Error('400이 발생해야 한다');
  } catch (error) {
    return JSON.stringify((error as BadRequestException).getResponse());
  }
};

const VALID_URL =
  'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/c8/a4/c6/c8a4c64f-89b3-9ef2-473f-4ad423a03c5b/887928030421.jpg/600x600bb.jpg';

describe('UpdateAlbumCoverDto', () => {
  it('정상 URL을 통과시킨다', async () => {
    await expect(validate({ url: VALID_URL })).resolves.toMatchObject({
      url: VALID_URL,
    });
  });

  it('앞뒤 공백을 제거한다', async () => {
    await expect(validate({ url: `  ${VALID_URL}  ` })).resolves.toMatchObject({
      url: VALID_URL,
    });
  });

  it.each([
    ['url 누락', {}],
    ['빈 문자열', { url: '' }],
    ['공백만', { url: '   ' }],
    ['문자열이 아님', { url: 123 }],
    ['null', { url: null }],
  ])('%s는 400이다', async (_name, payload) => {
    await expect(messageOf(payload)).resolves.toMatch(/앨범 커버 URL/);
  });

  it('길이 상한을 넘으면 400이다', async () => {
    await expect(
      messageOf({ url: `https://a.com/${'x'.repeat(ALBUM_COVER_URL_MAX_LENGTH)}` }),
    ).resolves.toMatch(new RegExp(`${ALBUM_COVER_URL_MAX_LENGTH}자`));
  });

  it('필드당 메시지가 하나만 나간다', async () => {
    // stopAtFirstError가 없으면 "비어 있음"과 "형식 오류"가 함께 나와
    // 관리자 화면에 모순된 안내가 뜬다
    const response = JSON.parse(await messageOf({ url: '' })) as {
      message: string[];
    };

    expect(response.message).toHaveLength(1);
  });

  it.each(['title', 'singer', 'albumCoverUrl', 'teamId', 'youtubeUrl'])(
    '%s를 함께 보내면 400이다',
    async (field) => {
      // 커버만 바꾸려다 곡 정보가 덮어써지는 경로를 구조적으로 막는다
      await expect(
        messageOf({ url: VALID_URL, [field]: '덮어쓰기 시도' }),
      ).resolves.toMatch(/should not exist/);
    },
  );

  it('형식 검증(https·호스트·경로)은 DTO가 아니라 서비스가 한다', async () => {
    // 벤치마크 스크립트가 같은 함수로 후보를 판정할 수 있도록 분리해 둔 결과다.
    // DTO 단계에서는 통과하고, 서비스의 assertAlbumCoverUrl이 400을 낸다.
    await expect(validate({ url: 'http://example.com/a.jpg' })).resolves.toMatchObject(
      { url: 'http://example.com/a.jpg' },
    );
  });
});
