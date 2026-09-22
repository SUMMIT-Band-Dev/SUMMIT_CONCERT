import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginPageContent } from "./login-page-content";

export const metadata: Metadata = { title: "로그인 · SUMMIT 관리자" };

export default function LoginPage() {
  // useSearchParams는 Suspense 경계가 있어야 정적 프리렌더링이 된다
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
