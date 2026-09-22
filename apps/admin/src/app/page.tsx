import { redirect } from "next/navigation";

// 루트는 팀 관리로 보낸다. 미로그인이면 그 페이지의 보호 라우트가 로그인으로 다시 보낸다
export default function Home() {
  redirect("/teams");
}
