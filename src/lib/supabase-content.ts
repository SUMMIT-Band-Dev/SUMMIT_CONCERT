import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { ContentTag } from "@/lib/content-tags";

// 재검증 호출 실패 시에도 최대 1시간 뒤 자동 갱신할 수 있도록 둔 안전망이다.
export const CONTENT_REVALIDATE_SECONDS = 3600;

// 셋리스트용 supabase.ts의 no-store와 달리 공연 콘텐츠에는 태그 기반 캐시를 쓴다.
export function createContentClient(tags: readonly ContentTag[]) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init = {}) =>
          fetch(input, {
            ...init,
            cache: "force-cache",
            next: { tags: [...tags], revalidate: CONTENT_REVALIDATE_SECONDS },
          }),
      },
    },
  );
}
