import { IsString, Length } from 'class-validator';
import { TrimString } from '../../common/trim.transform.js';
import { ADDRESS_MAX_LENGTH } from '../concert-content.constants.js';

export class GeocodeAddressDto {
  @Length(1, ADDRESS_MAX_LENGTH, { message: '주소는 1~200자로 입력해 주세요.' })
  @IsString({ message: '주소를 문자열로 입력해 주세요.' })
  @TrimString()
  address: string;
}
