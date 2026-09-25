"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth/auth-context";
import { sanitizeNextPath } from "@/lib/auth/next-path";
import { BRAND_NAME } from "@/lib/nav";

// 로그인 화면: 블랙 배경 + 파랑 브랜드 표시 위에 카드형 중앙 정렬. 색은 전부 globals.css 토큰이다
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
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-auth p-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 items-center justify-center rounded-lg bg-primary text-section font-bold text-primary-foreground"
        >
          S
        </span>
        <span className="text-title font-semibold text-auth-foreground">{BRAND_NAME}</span>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-section">로그인</CardTitle>
          <CardDescription>관리자 계정으로 로그인해 주세요.</CardDescription>
        </CardHeader>
        <CardContent>
          {status === "loading" || status === "authenticated" ? (
            <p role="status" className="text-body text-muted-foreground">
              확인 중입니다…
            </p>
          ) : (
            <LoginForm onSuccess={() => router.replace(nextPath)} />
          )}
        </CardContent>
      </Card>

      <p className="text-caption text-auth-muted">SUMMIT 정기공연 관리자 페이지</p>
    </main>
  );
}
