// 보호 라우트의 판단을 순수 함수로 분리한다(테스트 가능하게).
//
// ⚠️ 이것은 **화면 이동(UX)일 뿐 보안 경계가 아니다.** 토큰이 localStorage에 있어 서버(Next proxy)는 볼 수 없고,
// 브라우저 코드는 누구나 우회할 수 있다. 데이터를 지키는 실제 경계는 API의 전역 JWT Guard다
// (apps/api: 토큰이 없거나 틀리면 모든 관리자 라우트가 401).

export type AuthStatus = "loading" | "unauthenticated" | "authenticated" | "expired";

export type GuardDecision = "wait" | "redirect-to-login" | "render" | "render-with-reauth";

export function decideGuard(status: AuthStatus): GuardDecision {
  switch (status) {
    case "loading":
      return "wait";
    case "unauthenticated":
      return "redirect-to-login";
    case "authenticated":
      return "render";
    case "expired":
      // 페이지를 유지한 채 재로그인 대화상자를 띄운다(입력 중이던 폼 보존)
      return "render-with-reauth";
  }
}
