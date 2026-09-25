import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import { buildContentSecurityPolicy } from "./src/lib/csp";

const isDev = process.env.NODE_ENV !== "production";

const contentSecurityPolicy = buildContentSecurityPolicy({
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  publicSiteOrigin: process.env.NEXT_PUBLIC_PUBLIC_SITE_ORIGIN,
  supabaseStorageOrigin: process.env.NEXT_PUBLIC_SUPABASE_STORAGE_ORIGIN,
  isDev,
});

const nextConfig: NextConfig = {
  // 레포에 package-lock.json이 여러 개(루트, apps/api, apps/admin)라 Turbopack이 작업 루트를 잘못 추정하지 않게 명시한다
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  // 이미지 최적화 API를 쓰지 않는다(외부 이미지는 <img>로 직접 표시). 사용하지 않는 서버 표면을 닫아 둔다
  images: { unoptimized: true },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // 관리자 페이지는 검색에 노출되지 않는다
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
