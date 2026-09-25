import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// 데코레이터는 아래에서 위로 적용되므로, class-validator가 보는 제약 순서는
// 선언 순서의 역순이다. ValidationPipe에 stopAtFirstError를 걸어 필드당 메시지를
// 하나만 내보내고 있어서, 가장 먼저 보여야 할 "비어 있음" 검사를 맨 아래에 둔다.
export class LoginDto {
  @MaxLength(64, { message: '아이디가 너무 깁니다.' })
  @IsString({ message: '아이디를 입력해 주세요.' })
  @IsNotEmpty({ message: '아이디를 입력해 주세요.' })
  username: string;

  // argon2는 bcrypt와 달리 입력 길이 제한이 없다. 상한을 두는 건 정책이 아니라
  // 거대한 입력으로 해싱 비용을 유발하는 것을 막기 위한 것.
  @MaxLength(256, { message: '비밀번호가 너무 깁니다.' })
  @IsString({ message: '비밀번호를 입력해 주세요.' })
  @IsNotEmpty({ message: '비밀번호를 입력해 주세요.' })
  password: string;
}
