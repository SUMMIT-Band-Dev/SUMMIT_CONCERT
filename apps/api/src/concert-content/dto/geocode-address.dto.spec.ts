import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { createValidationPipe } from '../../app.setup.js';
import { GeocodeAddressDto } from './geocode-address.dto.js';

const transform = (input: unknown) =>
  createValidationPipe().transform(input, {
    type: 'body',
    metatype: GeocodeAddressDto,
  });
describe('주소 검색 DTO', () => {
  it.each([
    {},
    { address: '' },
    { address: '   ' },
    { address: '가'.repeat(201) },
    { address: null },
    { address: 123 },
    { address: '서울', extra: true },
  ])('잘못된 본문 %j는 400이다', async (input) => {
    await expect(transform(input)).rejects.toMatchObject({ status: 400 });
  });
  it.each(['가', '가'.repeat(200)])(
    '1~200자를 허용하고 앞뒤 공백을 제거한다',
    async (address) => {
      await expect(transform({ address: `  ${address}  ` })).resolves.toEqual({
        address,
      });
    },
  );
});
