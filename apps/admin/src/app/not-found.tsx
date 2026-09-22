import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-xl font-semibold">페이지를 찾을 수 없습니다</h1>
      <p className="text-sm text-muted-foreground">주소가 바뀌었거나 없는 페이지입니다.</p>
      <Link href="/teams" className="text-sm underline underline-offset-4">
        팀 관리로 이동
      </Link>
    </main>
  );
}
