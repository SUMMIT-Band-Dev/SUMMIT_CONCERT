"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth/auth-context";
import { createQueryClient } from "@/lib/query-client";

export function Providers({ children }: { children: ReactNode }) {
  // 렌더링마다 새 클라이언트가 만들어지지 않게 state로 한 번만 만든다
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
