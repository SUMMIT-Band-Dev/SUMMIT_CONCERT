import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    // 브라우저/중간 캐시를 타지 않도록 모든 요청을 no-store로 고정한다.
    fetch: (input, init = {}) => {
      const headers = new Headers(init.headers);
      // Supabase SDK가 주입한 apikey/authorization 헤더를 보존한 채 캐시만 비활성화한다.
      headers.set("cache-control", "no-cache, no-store, max-age=0, must-revalidate");
      headers.set("pragma", "no-cache");

      return fetch(input, {
        ...init,
        cache: "no-store",
        headers,
      });
    },
  },
});
