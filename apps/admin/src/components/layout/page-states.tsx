import type { ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/errors";

// 화면 공통 패턴: 로딩 · 빈 상태 · 오류. 7c-2 이후 모든 목록·패널이 같은 모양을 쓴다.
// 서버가 준 문자열(오류 메시지 등)은 **항상 텍스트 노드로만** 렌더링한다 — dangerouslySetInnerHTML 금지.

export function LoadingState({ label = "불러오는 중입니다…" }: { label?: string }) {
  return (
    <p role="status" aria-live="polite" className="py-10 text-center text-body text-muted-foreground">
      {label}
    </p>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  /** 이미 카드 안에 들어 있을 때(분할 패널 등) 바깥 테두리를 그리지 않는다 */
  bare?: boolean;
}

export function EmptyState({ title, description, action, bare = false }: EmptyStateProps) {
  return (
    <div className={bare ? "px-4 py-10 text-center" : "rounded-lg border border-dashed bg-card px-6 py-12 text-center"}>
      <p className="text-section font-medium">{title}</p>
      {description ? <p className="mt-1 text-body text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  // ApiError가 아닌 예외의 message는 개발자용이라 화면에 내지 않는다(요청 값이나 내부 정보가 섞일 수 있다)
  const messages = error instanceof ApiError ? error.messages : ["알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."];

  return (
    <Alert variant="destructive" role="alert">
      <AlertDescription>
        {messages.map((message, index) => (
          <span key={index} className="block">
            {message}
          </span>
        ))}
        {onRetry ? (
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onRetry}>
            다시 시도
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
