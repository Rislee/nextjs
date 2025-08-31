import type { Metadata } from "next";
import "./globals.css";
import AuthStatusButton from "@/components/auth/AuthStatusButton";

export const metadata: Metadata = {
  title: "InnerOS Account",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header className="border-b">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <a href="https://www.inneros.co.kr" className="text-sm font-semibold">InnerOS</a>
            <AuthStatusButton />
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}