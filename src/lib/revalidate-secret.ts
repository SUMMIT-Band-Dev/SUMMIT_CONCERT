import { createHash, timingSafeEqual } from "node:crypto";

export function isValidRevalidateSecret(
  provided: string | null | undefined,
  expected: string | undefined,
): boolean {
  if (!expected?.trim() || typeof provided !== "string" || !provided) return false;
  return timingSafeEqual(createHash("sha256").update(provided).digest(), createHash("sha256").update(expected).digest());
}
