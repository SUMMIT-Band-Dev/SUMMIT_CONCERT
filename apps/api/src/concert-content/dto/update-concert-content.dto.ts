import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { TrimString } from '../../common/trim.transform.js';
import {
  ADDRESS_MAX_LENGTH,
  DATE_LABEL_MAX_LENGTH,
  DAY_LABEL_MAX_LENGTH,
  INFO_CATEGORIES,
  INFO_CONTENT_MAX_LENGTH,
  INFO_ITEMS_MAX,
  INFO_SECTIONS_MAX,
  INFO_TITLE_MAX_LENGTH,
  LINEUP_OVERRIDE_MAX_LENGTH,
  SHOW_TIME_MAX_LENGTH,
  SUBTITLE_MAX_LENGTH,
  TICKET_DESCRIPTION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  VENUE_NAME_MAX_LENGTH,
} from '../concert-content.constants.js';
import type { InfoCategory } from '../concert-content.constants.js';
import { IsCalendarDate, IsOptionalHttpsUrl } from './content-validation.js';

export class UpdateConcertDto {
  @Length(1, TITLE_MAX_LENGTH, {
    message: '국문 제목은 1~100자로 입력해 주세요.',
  })
  @IsString({ message: '국문 제목을 문자열로 입력해 주세요.' })
  @TrimString()
  titleKo: string;

  @Length(1, TITLE_MAX_LENGTH, {
    message: '영문 제목은 1~100자로 입력해 주세요.',
  })
  @IsString({ message: '영문 제목을 문자열로 입력해 주세요.' })
  @TrimString()
  titleEn: string;

  @MaxLength(SUBTITLE_MAX_LENGTH, {
    message: '부제는 200자 이내로 입력해 주세요.',
  })
  @IsString({ message: '부제를 문자열로 입력해 주세요.' })
  @IsOptional()
  @TrimString()
  subtitle?: string | null;

  @IsCalendarDate()
  @TrimString()
  startDate: string;

  @IsCalendarDate()
  @TrimString()
  endDate: string;

  @Length(1, SHOW_TIME_MAX_LENGTH, {
    message: '공연 시간은 1~50자로 입력해 주세요.',
  })
  @IsString({ message: '공연 시간을 문자열로 입력해 주세요.' })
  @TrimString()
  showTime: string;
}

export class UpdateVenueDto {
  @Length(1, VENUE_NAME_MAX_LENGTH, {
    message: '공연장 이름은 1~100자로 입력해 주세요.',
  })
  @IsString({ message: '공연장 이름을 문자열로 입력해 주세요.' })
  @TrimString()
  name: string;

  @Length(1, ADDRESS_MAX_LENGTH, { message: '주소는 1~200자로 입력해 주세요.' })
  @IsString({ message: '주소를 문자열로 입력해 주세요.' })
  @TrimString()
  address: string;

  @MaxLength(ADDRESS_MAX_LENGTH, {
    message: '상세 주소는 200자 이내로 입력해 주세요.',
  })
  @IsString({ message: '상세 주소를 문자열로 입력해 주세요.' })
  @IsOptional()
  @TrimString()
  addressDetail?: string | null;

  @Max(90, { message: '위도는 90 이하여야 합니다.' })
  @Min(-90, { message: '위도는 -90 이상이어야 합니다.' })
  @IsNumber({}, { message: '위도를 숫자로 입력해 주세요.' })
  latitude: number;

  @Max(180, { message: '경도는 180 이하여야 합니다.' })
  @Min(-180, { message: '경도는 -180 이상이어야 합니다.' })
  @IsNumber({}, { message: '경도를 숫자로 입력해 주세요.' })
  longitude: number;

  @IsOptionalHttpsUrl()
  @IsOptional()
  @TrimString()
  naverMapUrl?: string | null;

  @IsOptionalHttpsUrl()
  @IsOptional()
  @TrimString()
  websiteUrl?: string | null;
}

export class UpdatePerformanceDayDto {
  @Length(1, DAY_LABEL_MAX_LENGTH, {
    message: '일차 라벨은 1~50자로 입력해 주세요.',
  })
  @IsString({ message: '일차 라벨을 문자열로 입력해 주세요.' })
  @TrimString()
  dayLabel: string;

  @Length(1, DATE_LABEL_MAX_LENGTH, {
    message: '날짜 라벨은 1~100자로 입력해 주세요.',
  })
  @IsString({ message: '날짜 라벨을 문자열로 입력해 주세요.' })
  @TrimString()
  dateLabel: string;

  @IsOptionalHttpsUrl()
  @IsOptional()
  @TrimString()
  bookingUrl?: string | null;

  @MaxLength(LINEUP_OVERRIDE_MAX_LENGTH, {
    message: '출연진 문구는 1000자 이내로 입력해 주세요.',
  })
  @IsString({ message: '출연진 문구를 문자열로 입력해 주세요.' })
  @IsOptional()
  @TrimString()
  lineupOverride?: string | null;
}

export class UpdateTicketDto {
  @MaxLength(TICKET_DESCRIPTION_MAX_LENGTH, {
    message: '티켓 설명은 2000자 이내로 입력해 주세요.',
  })
  @IsString({ message: '티켓 설명을 문자열로 입력해 주세요.' })
  @IsOptional()
  @TrimString()
  description?: string | null;
}

export class InfoItemDto {
  @Length(1, INFO_CONTENT_MAX_LENGTH, {
    message: '안내 문장은 1~500자로 입력해 주세요.',
  })
  @IsString({ message: '안내 문장을 문자열로 입력해 주세요.' })
  @TrimString()
  content: string;
}

export class InfoSectionDto {
  @Length(1, INFO_TITLE_MAX_LENGTH, {
    message: '섹션 제목은 1~100자로 입력해 주세요.',
  })
  @IsString({ message: '섹션 제목을 문자열로 입력해 주세요.' })
  @TrimString()
  title: string;

  @ValidateNested({ each: true })
  @Type(() => InfoItemDto)
  @ArrayMaxSize(INFO_ITEMS_MAX, {
    message: '안내 항목은 50개 이하여야 합니다.',
  })
  @IsArray({ message: '안내 항목을 배열로 입력해 주세요.' })
  items: InfoItemDto[];
}

export class UpdateInfoSectionsDto {
  @ValidateNested({ each: true })
  @Type(() => InfoSectionDto)
  @ArrayMaxSize(INFO_SECTIONS_MAX, {
    message: '안내 섹션은 20개 이하여야 합니다.',
  })
  @IsArray({ message: '안내 섹션을 배열로 입력해 주세요.' })
  sections: InfoSectionDto[];
}

export class InfoCategoryQueryDto {
  @IsIn(INFO_CATEGORIES, {
    message: '분류는 ticket 또는 notice로 입력해 주세요.',
  })
  @TrimString()
  category: InfoCategory;
}
