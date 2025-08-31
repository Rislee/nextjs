// app/page.tsx - 대시보드로 자동 리다이렉트
import { redirect } from "next/navigation";

export default function Home() {
  // account.inneros.co.kr로 접속하는 모든 사용자를 대시보드로 리다이렉트
  redirect("/dashboard");
}