import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { CreateSongDto } from './create-song.dto.js';
import { UpdateSongDto } from './update-song.dto.js';
import {
  SINGER_MAX_LENGTH,
  SONG_TITLE_MAX_LENGTH,
} from '../songs.constants.js';

// main.ts의 전역 설정을 그대로 재현한다. 여기서만 다른 옵션을 쓰면
// 테스트는 통과하는데 실제 요청은 다르게 동작하는 상황이 생긴다.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  stopAtFirstError: true,
});

const meta = (metatype: ArgumentMetadata['metatype']): ArgumentMetadata => ({
  type: 'body',
  metatype,
});

const validate = <T>(
  metatype: ArgumentMetadata['metatype'],
  payload: unknown,
): Promise<T> => pipe.transform(payload, meta(metatype)) as Promise<T>;

/** 검증 실패 메시지를 문자열 하나로 모은다 */
const messageOf = async (
  metatype: ArgumentMetadata['metatype'],
  payload: unknown,
) => {
  try {
    await validate(metatype, payload);
    throw new Error('400이 발생해야 한다');
  } catch (error) {
    const response = (error as BadRequestException).getResponse();
    return JSON.stringify(response);
  }
};

describe('CreateSongDto', () => {
  const valid = { title: '보수공사', singer: '한로로' };

  it('정상 입력을 통과시킨다', async () => {
    await expect(validate(CreateSongDto, valid)).resolves.toEqual(valid);
  });

  it('앞뒤 공백을 제거한다', async () => {
    const dto = await validate<CreateSongDto>(CreateSongDto, {
      title: '  보수공사  ',
      singer: '  한로로 ',
    });

    expect(dto).toEqual(valid);
  });

  it('공백만 있는 값은 빈 문자열이 되어 거부된다', async () => {
    await expect(messageOf(CreateSongDto, { ...valid, title: '   ' })).resolves.toMatch(
      /곡 제목을 입력해 주세요/,
    );
    await expect(messageOf(CreateSongDto, { ...valid, singer: '   ' })).resolves.toMatch(
      /가수를 입력해 주세요/,
    );
  });

  it('가수는 등록 시 필수다 (비면 공개 페이지가 "SUMMIT Band"로 대체 표시한다)', async () => {
    await expect(messageOf(CreateSongDto, { title: '보수공사' })).resolves.toMatch(
      /가수/,
    );
  });

  it('제목이 없으면 거부한다', async () => {
    await expect(messageOf(CreateSongDto, { singer: '한로로' })).resolves.toMatch(
      /곡 제목/,
    );
  });

  it('문자열이 아니면 거부한다', async () => {
    await expect(messageOf(CreateSongDto, { ...valid, title: 123 })).resolves.toMatch(
      /곡 제목/,
    );
  });

  it('길이 상한을 넘으면 DB에 닿기 전에 거부한다', async () => {
    await expect(
      messageOf(CreateSongDto, { ...valid, title: 'a'.repeat(SONG_TITLE_MAX_LENGTH + 1) }),
    ).resolves.toMatch(/곡 제목은 200자/);
    await expect(
      messageOf(CreateSongDto, { ...valid, singer: 'a'.repeat(SINGER_MAX_LENGTH + 1) }),
    ).resolves.toMatch(/가수는 100자/);
  });

  it('상한과 같은 길이는 통과한다', async () => {
    await expect(
      validate(CreateSongDto, { ...valid, title: 'a'.repeat(SONG_TITLE_MAX_LENGTH) }),
    ).resolves.toMatchObject({ title: 'a'.repeat(SONG_TITLE_MAX_LENGTH) });
  });

  it('기존 64행의 최대 길이(제목 24 / 가수 21)는 여유 있게 통과한다', async () => {
    await expect(
      validate(CreateSongDto, { title: 'a'.repeat(24), singer: 'b'.repeat(21) }),
    ).resolves.toMatchObject({ title: 'a'.repeat(24) });
  });

  it('선언하지 않은 필드가 섞이면 거부한다 (팀 이동·F010·F011~F013 차단)', async () => {
    await expect(messageOf(CreateSongDto, { ...valid, teamId: '3' })).resolves.toMatch(
      /teamId/,
    );
    await expect(
      messageOf(CreateSongDto, { ...valid, albumCoverUrl: 'https://hack/a.jpg' }),
    ).resolves.toMatch(/albumCoverUrl/);
    await expect(
      messageOf(CreateSongDto, { ...valid, youtubeUrl: 'https://hack/v' }),
    ).resolves.toMatch(/youtubeUrl/);
    await expect(messageOf(CreateSongDto, { ...valid, id: '1' })).resolves.toMatch(/id/);
  });
});

describe('UpdateSongDto', () => {
  it('제목만, 가수만 보내는 것을 모두 허용한다', async () => {
    await expect(validate(UpdateSongDto, { title: '자처' })).resolves.toEqual({
      title: '자처',
    });
    await expect(validate(UpdateSongDto, { singer: '한로로' })).resolves.toEqual({
      singer: '한로로',
    });
  });

  it('빈 본문은 DTO를 통과한다 — 400은 서비스가 낸다', async () => {
    await expect(validate(UpdateSongDto, {})).resolves.toEqual({});
  });

  it('값을 보냈다면 형식은 등록과 동일하게 검사한다', async () => {
    await expect(messageOf(UpdateSongDto, { title: '  ' })).resolves.toMatch(/곡 제목/);
    await expect(messageOf(UpdateSongDto, { singer: '' })).resolves.toMatch(/가수/);
    await expect(
      messageOf(UpdateSongDto, { title: 'a'.repeat(SONG_TITLE_MAX_LENGTH + 1) }),
    ).resolves.toMatch(/200자/);
  });

  it('teamId는 여기서 바꿀 수 없다 (곡의 팀 이동은 스코프 밖)', async () => {
    await expect(messageOf(UpdateSongDto, { teamId: '3' })).resolves.toMatch(/teamId/);
  });

  it('앨범 커버·유튜브 링크도 직접 수정할 수 없다 (F010 / F011~F013)', async () => {
    await expect(
      messageOf(UpdateSongDto, { albumCoverUrl: 'https://hack/a.jpg' }),
    ).resolves.toMatch(/albumCoverUrl/);
    await expect(
      messageOf(UpdateSongDto, { youtubeUrl: 'https://hack/v' }),
    ).resolves.toMatch(/youtubeUrl/);
  });
});
