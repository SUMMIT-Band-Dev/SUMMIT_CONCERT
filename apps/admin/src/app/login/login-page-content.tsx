"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { useAuth } from "@/lib/auth/auth-context";
import { sanitizeNextPath } from "@/lib/auth/next-path";

// 임시 최소 스타일: 디자인(레이아웃·토큰) 승인 전이라 꾸밈 없이 기능만 둔다. 승인 후 교체한다.
export function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useAuth();

  // 돌아갈 경로는 같은 사이트 안의 경로만 허용한다(오픈 리다이렉트 방지)
  const nextPath = sanitizeNextPath(searchParams.get("next"));

  // 이미 로그인돼 있으면 로그인 화면을 보여 주지 않는다
  useEffect(() => {
    if (status === "authenticated") router.replace(nextPath);
  }, [status, nextPath, router]);

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-6 text-lg font-semibold">SUMMIT 관리자 로그인</h1>
      {status === "loading" || status === "authenticated" ? (
        <p role="status">확인 중입니다…</p>
      ) : (
        <LoginForm onSuccess={() => router.replace(nextPath)} />
      )}
    </main>
  );
}
