import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { CreateTeamDto } from './create-team.dto.js';
import { UpdateTeamDto } from './update-team.dto.js';
import { ReorderTeamsDto } from './reorder-teams.dto.js';

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

const validate = <T>(metatype: ArgumentMetadata['metatype'], payload: unknown): Promise<T> =>
  pipe.transform(payload, meta(metatype)) as Promise<T>;

/** 검증 실패 메시지를 문자열 하나로 모은다 */
const messageOf = async (metatype: ArgumentMetadata['metatype'], payload: unknown) => {
  try {
    await validate(metatype, payload);
    throw new Error('400이 발생해야 한다');
  } catch (error) {
    const response = (error as BadRequestException).getResponse();
    return JSON.stringify(response);
  }
};

describe('CreateTeamDto', () => {
  const valid = { teamName: '새 팀', day: 'day1', performanceOrder: 3 };

  it('정상 입력을 통과시킨다', async () => {
    await expect(validate(CreateTeamDto, valid)).resolves.toEqual(valid);
  });

  it('팀명 앞뒤 공백을 제거한다', async () => {
    const dto = await validate<CreateTeamDto>(CreateTeamDto, {
      ...valid,
      teamName: '  새 팀  ',
    });

    expect(dto.teamName).toBe('새 팀');
  });

  it('공백만 있는 팀명은 빈 문자열이 되어 거부된다', async () => {
    await expect(messageOf(CreateTeamDto, { ...valid, teamName: '   ' })).resolves.toMatch(
      /팀명을 입력해 주세요/,
    );
  });

  it('필드가 누락되면 거부한다', async () => {
    await expect(messageOf(CreateTeamDto, { day: 'day1', performanceOrder: 1 })).resolves.toMatch(
      /팀명/,
    );
    await expect(
      messageOf(CreateTeamDto, { teamName: '팀', performanceOrder: 1 }),
    ).resolves.toMatch(/공연일자/);
    await expect(messageOf(CreateTeamDto, { teamName: '팀', day: 'day1' })).resolves.toMatch(
      /공연 순서/,
    );
  });

  it('day 형식이 다르면 거부한다', async () => {
    for (const day of ['1일차', 'Day1', 'day0', 'day', 'day-1', '__verify__']) {
      await expect(messageOf(CreateTeamDto, { ...valid, day })).resolves.toMatch(
        /day1, day2 형식/,
      );
    }
  });

  it('day1 외에 day2, day10 같은 값도 형식상 허용한다', async () => {
    for (const day of ['day2', 'day10', 'day99']) {
      await expect(validate(CreateTeamDto, { ...valid, day })).resolves.toMatchObject({ day });
    }
  });

  it('순서가 정수가 아니거나 1 미만이면 거부한다', async () => {
    await expect(messageOf(CreateTeamDto, { ...valid, performanceOrder: 0 })).resolves.toMatch(
      /1 이상/,
    );
    await expect(messageOf(CreateTeamDto, { ...valid, performanceOrder: 1.5 })).resolves.toMatch(
      /정수/,
    );
    // 숫자 문자열도 받지 않는다 (implicit conversion을 켜지 않았다)
    await expect(messageOf(CreateTeamDto, { ...valid, performanceOrder: '3' })).resolves.toMatch(
      /정수/,
    );
  });

  it('int2 범위를 넘는 순서는 DB에 닿기 전에 거부한다', async () => {
    await expect(
      messageOf(CreateTeamDto, { ...valid, performanceOrder: 32768 }),
    ).resolves.toMatch(/너무 큽니다/);
  });

  it('선언하지 않은 필드가 섞이면 거부한다 (cardImageUrl은 5단계)', async () => {
    await expect(
      messageOf(CreateTeamDto, { ...valid, cardImageUrl: '/hack.png' }),
    ).resolves.toMatch(/cardImageUrl/);
    await expect(messageOf(CreateTeamDto, { ...valid, id: '1' })).resolves.toMatch(/id/);
  });
});

describe('UpdateTeamDto', () => {
  it('팀명만, 공연일자만 보내는 것을 모두 허용한다', async () => {
    await expect(validate(UpdateTeamDto, { teamName: '새 이름' })).resolves.toEqual({
      teamName: '새 이름',
    });
    await expect(validate(UpdateTeamDto, { day: 'day2' })).resolves.toEqual({ day: 'day2' });
  });

  it('performanceOrder는 여기서 수정할 수 없다 (재정렬 전용)', async () => {
    await expect(messageOf(UpdateTeamDto, { performanceOrder: 2 })).resolves.toMatch(
      /performanceOrder/,
    );
  });

  it('빈 본문은 DTO를 통과한다 — 400은 서비스가 낸다', async () => {
    await expect(validate(UpdateTeamDto, {})).resolves.toEqual({});
  });

  it('값을 보냈다면 형식은 등록과 동일하게 검사한다', async () => {
    await expect(messageOf(UpdateTeamDto, { teamName: '  ' })).resolves.toMatch(/팀명/);
    await expect(messageOf(UpdateTeamDto, { day: '2일차' })).resolves.toMatch(
      /day1, day2 형식/,
    );
  });
});

describe('ReorderTeamsDto', () => {
  const valid = { day: 'day1', teamIds: ['3', '1', '2'] };

  it('정상 입력을 통과시킨다', async () => {
    await expect(validate(ReorderTeamsDto, valid)).resolves.toEqual(valid);
  });

  it('빈 배열은 거부한다', async () => {
    await expect(messageOf(ReorderTeamsDto, { ...valid, teamIds: [] })).resolves.toMatch(
      /재정렬할 팀을 지정/,
    );
  });

  it('배열이 아니면 거부한다', async () => {
    await expect(messageOf(ReorderTeamsDto, { ...valid, teamIds: '1,2,3' })).resolves.toMatch(
      /팀 목록이 올바르지 않습니다/,
    );
  });

  it('숫자 문자열이 아닌 id는 거부한다', async () => {
    await expect(
      messageOf(ReorderTeamsDto, { ...valid, teamIds: ['1', 'two'] }),
    ).resolves.toMatch(/숫자 문자열/);
    // 숫자로 보내는 것도 막는다 — 응답이 문자열 id를 주므로 요청도 문자열로 맞춘다
    await expect(messageOf(ReorderTeamsDto, { ...valid, teamIds: [1, 2] })).resolves.toMatch(
      /숫자 문자열/,
    );
  });

  it('day가 없으면 거부한다', async () => {
    await expect(messageOf(ReorderTeamsDto, { teamIds: ['1'] })).resolves.toMatch(/공연일자/);
  });
});
