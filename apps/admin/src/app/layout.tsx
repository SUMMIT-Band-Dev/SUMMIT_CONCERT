import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SUMMIT 관리자",
  description: "SUMMIT 정기공연 관리자 페이지",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
