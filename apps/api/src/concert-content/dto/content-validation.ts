import { ValidateBy } from 'class-validator';
import {
  HTTPS_URL_MESSAGE,
  URL_MAX_LENGTH,
} from '../concert-content.constants.js';

/** Date가 존재하지 않는 날짜를 다음 달로 보정하는 경우도 거부한다. */
export function IsCalendarDate(): PropertyDecorator {
  return ValidateBy({
    name: 'isCalendarDate',
    validator: {
      validate(value: unknown) {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
          return false;
        const date = new Date(`${value}T00:00:00.000Z`);
        return (
          Number.isFinite(date.getTime()) &&
          date.toISOString().slice(0, 10) === value
        );
      },
      defaultMessage: () =>
        '날짜는 YYYY-MM-DD 형식의 실제 날짜로 입력해 주세요.',
    },
  });
}

/** 선택 URL의 빈 문자열은 저장 시 NULL로 바뀐다. */
export function IsOptionalHttpsUrl(): PropertyDecorator {
  return ValidateBy({
    name: 'isOptionalHttpsUrl',
    validator: {
      validate(value: unknown) {
        if (value === '') return true;
        if (typeof value !== 'string' || value.length > URL_MAX_LENGTH)
          return false;
        try {
          const url = new URL(value);
          return url.protocol === 'https:' && !url.username && !url.password;
        } catch {
          return false;
        }
      },
      defaultMessage: () => HTTPS_URL_MESSAGE,
    },
  });
}
