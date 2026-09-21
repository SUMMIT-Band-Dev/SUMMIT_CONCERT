"use client";

import { useCallback, useId, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/api/auth";
import { formatRetryAfter, isApiError, type ApiError } from "@/lib/api/errors";
import type { LoginResult } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/auth-context";
import { clearBlockedUntil, readBlockedUntil, remainingSeconds, saveBlockedUntil, subscribeBlockedUntil } from "@/lib/auth/login-block";
import { loginSchema, PASSWORD_MAX_LENGTH, USERNAME_MAX_LENGTH, type LoginFormValues } from "@/lib/auth/login-schema";

interface LoginFormProps {
  /** 재로그인 대화상자에서 마지막 로그인 계정을 미리 채운다(비밀번호는 저장하지 않는다) */
  initialUsername?: string;
  /** 로그인에 성공하고 토큰이 저장된 뒤 */
  onSuccess?: () => void;
}

/** 1초마다 갱신되는 현재 시각(초). 차단 중 남은 시간을 표시할 때만 켠다 */
function useNowSeconds(active: boolean): number {
  const subscribe = useCallback(
    (callback: () => void) => {
      if (!active) return () => {};
      const timer = setInterval(callback, 1000);
      return () => clearInterval(timer);
    },
    [active],
  );
  return useSyncExternalStore(subscribe, () => Math.floor(Date.now() / 1000), () => 0);
}

export function LoginForm({ initialUsername = "", onSuccess }: LoginFormProps) {
  const { signIn } = useAuth();
  const ids = { username: useId(), password: useId(), usernameError: useId(), passwordError: useId() };

  const {
    register,
    handleSubmit,
    resetField,
    setFocus,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: initialUsername, password: "" },
  });

  // 429 차단 상태(새로고침 후에도 유지)
  const blockedUntil = useSyncExternalStore(subscribeBlockedUntil, () => readBlockedUntil(), () => null);
  const nowSeconds = useNowSeconds(blockedUntil !== null);
  const remaining = blockedUntil === null || nowSeconds === 0 ? 0 : remainingSeconds(blockedUntil, nowSeconds * 1000);
  const isBlocked = remaining > 0;

  const mutation = useMutation<LoginResult, ApiError, LoginFormValues>({
    mutationFn: (values) => login(values),
  });

  const onSubmit = handleSubmit(async (values) => {
    // 클라이언트 검증을 통과한 요청만 여기 온다. 차단 중이거나 이미 보내는 중이면 다시 보내지 않는다
    // (서버는 성공한 로그인과 400도 5회 한도에 센다)
    if (isBlocked || mutation.isPending) return;

    try {
      const { accessToken } = await mutation.mutateAsync(values);
      clearBlockedUntil();
      signIn(accessToken);
      onSuccess?.();
    } catch (error) {
      if (!isApiError(error)) return;
      if (error.kind === "rate_limited") {
        saveBlockedUntil(error.retryAfterSec);
      } else if (error.kind === "unauthorized") {
        // 틀린 비밀번호를 그대로 다시 보내지 않도록 비우고 그 칸으로 돌아간다
        resetField("password");
        setFocus("password");
      }
    }
  });

  const serverError = mutation.error;
  // 429 안내는 아래 차단 문구가 대신한다(같은 말을 두 번 보여 주지 않는다)
  const showServerError = serverError !== null && serverError.kind !== "rate_limited";

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {isBlocked ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            로그인 시도가 너무 많습니다. {formatRetryAfter(remaining)}에 다시 시도해 주세요.
          </AlertDescription>
        </Alert>
      ) : null}

      {showServerError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {serverError.messages.map((message, index) => (
              <span key={index} className="block">
                {message}
              </span>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-1.5">
        <Label htmlFor={ids.username}>아이디</Label>
        <Input
          id={ids.username}
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={USERNAME_MAX_LENGTH + 1}
          aria-invalid={errors.username ? true : undefined}
          aria-describedby={errors.username ? ids.usernameError : undefined}
          {...register("username")}
        />
        {errors.username ? (
          <p id={ids.usernameError} className="text-sm text-destructive">
            {errors.username.message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={ids.password}>비밀번호</Label>
        <Input
          id={ids.password}
          type="password"
          autoComplete="current-password"
          maxLength={PASSWORD_MAX_LENGTH + 1}
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? ids.passwordError : undefined}
          {...register("password")}
        />
        {errors.password ? (
          <p id={ids.passwordError} className="text-sm text-destructive">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={isBlocked || mutation.isPending}>
        {mutation.isPending ? "로그인 중…" : "로그인"}
      </Button>
    </form>
  );
}
