// 서버 apps/api/src/concert-content/dto/content-validation.ts와 같은 URL 규칙·문구다.
import { z } from "zod";

export const optionalHttpsUrl = z
  .string()
  .trim()
  .refine((value) => {
    if (value === "") return true;
    if (value.length > 2048) return false;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "https로 시작하는 올바른 주소를 입력해 주세요.");
