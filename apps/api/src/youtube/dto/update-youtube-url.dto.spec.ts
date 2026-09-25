import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { UpdateYoutubeUrlDto } from './update-youtube-url.dto.js';
import { YOUTUBE_URL_MAX_LENGTH } from '../youtube.constants.js';

// main.ts의 전역 설정을 그대로 재현한다. 여기서만 다른 옵션을 쓰면
// 테스트는 통과하는데 실제 요청은 다르게 동작하는 상황이 생긴다.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  stopAtFirstError: true,
});

const meta: ArgumentMetadata = { type: 'body', metatype: UpdateYoutubeUrlDto };

const validate = (payload: unknown) =>
  pipe.transform(payload, meta) as Promise<UpdateYoutubeUrlDto>;

const messageOf = async (payload: unknown) => {
  try {
    await validate(payload);
    throw new Error('400이 발생해야 한다');
  } catch (error) {
    return JSON.stringify((error as BadRequestException).getResponse());
  }
};

const VALID_URL = 'https://www.youtube.com/watch?v=BTo-I-gCAxk';

describe('UpdateYoutubeUrlDto', () => {
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
    await expect(messageOf(payload)).resolves.toMatch(/유튜브 영상 주소/);
  });

  it('길이 상한을 넘으면 400이다', async () => {
    await expect(
      messageOf({ url: `https://a.com/${'x'.repeat(YOUTUBE_URL_MAX_LENGTH)}` }),
    ).resolves.toMatch(new RegExp(`${YOUTUBE_URL_MAX_LENGTH}자`));
  });

  it('필드당 메시지가 하나만 나간다', async () => {
    const response = JSON.parse(await messageOf({ url: '' })) as {
      message: string[];
    };

    expect(response.message).toHaveLength(1);
  });

  it.each([
    'title',
    'singer',
    'albumCoverUrl',
    'teamId',
    'youtubeUrl',
    'youtubeReviewStatus',
  ])('%s를 함께 보내면 400이다', async (field) => {
    // 특히 youtubeReviewStatus — 상태를 클라이언트가 정할 수 있으면
    // "URL은 있는데 pending"인 모순된 행이 생긴다.
    await expect(
      messageOf({ url: VALID_URL, [field]: '덮어쓰기 시도' }),
    ).resolves.toMatch(/should not exist/);
  });

  it('형식 검증(호스트·경로·영상 ID)은 DTO가 아니라 서비스가 한다', async () => {
    // 사유별로 다른 안내가 나가야 해서 class-validator의 단일 메시지로는 부족하다.
    await expect(
      validate({ url: 'https://vimeo.com/123' }),
    ).resolves.toMatchObject({ url: 'https://vimeo.com/123' });
  });
});
