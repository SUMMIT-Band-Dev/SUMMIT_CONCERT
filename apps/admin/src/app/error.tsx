"use client";

import { Button } from "@/components/ui/button";

// 예상하지 못한 렌더링 오류. 오류 메시지는 개발자용이고 요청 값·내부 정보가 섞일 수 있어 화면에 내지 않는다
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-xl font-semibold">문제가 발생했습니다</h1>
      <p className="text-sm text-muted-foreground">화면을 그리는 중 오류가 났습니다. 다시 시도해도 계속되면 새로고침해 주세요.</p>
      <Button type="button" variant="outline" onClick={reset}>
        다시 시도
      </Button>
    </main>
  );
}
