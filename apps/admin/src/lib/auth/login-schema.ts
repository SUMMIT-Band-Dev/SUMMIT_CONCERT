import { z } from "zod";

// 서버 DTO(apps/api/src/auth/dto/login.dto.ts)와 같은 규칙과 같은 문구다.
// 서버는 검증에 실패한 요청(400)도 로그인 시도 한도(IP당 5분 5회)에 세므로, 여기서 먼저 막아 한도를 아낀다.
// 규칙이 서로 어긋나면 "클라이언트는 통과했는데 서버가 400"이 되어 한도를 소모하므로, 서버 DTO를 바꾸면 이 파일도 함께 바꾼다.

export const USERNAME_MAX_LENGTH = 64;
export const PASSWORD_MAX_LENGTH = 256;

export const LOGIN_MESSAGES = {
  usernameRequired: "아이디를 입력해 주세요.",
  usernameTooLong: "아이디가 너무 깁니다.",
  passwordRequired: "비밀번호를 입력해 주세요.",
  passwordTooLong: "비밀번호가 너무 깁니다.",
} as const;

export const loginSchema = z.object({
  // 공백만 있는 아이디는 서버가 통과시킬 수 있지만 로그인이 될 수 없는 값이라 미리 막는다(서버 한도를 쓰지 않도록)
  username: z
    .string()
    .refine((value) => value.trim().length > 0, { message: LOGIN_MESSAGES.usernameRequired })
    .max(USERNAME_MAX_LENGTH, { message: LOGIN_MESSAGES.usernameTooLong }),
  // 비밀번호는 다듬지 않는다(앞뒤 공백도 비밀번호의 일부일 수 있다)
  password: z
    .string()
    .min(1, { message: LOGIN_MESSAGES.passwordRequired })
    .max(PASSWORD_MAX_LENGTH, { message: LOGIN_MESSAGES.passwordTooLong }),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
