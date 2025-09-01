// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import AuthStatusButton from "@/components/auth/AuthStatusButton";

export const metadata: Metadata = {
  title: "InnerOS Account",
  description: "당신의 삶을 위한 AI 어시스턴트 시스템",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body className="inneros-page">
        <header className="inneros-header">
          <div className="inneros-header-content">
            <a href="https://www.inneros.co.kr" className="inneros-logo">
              InnerOS
            </a>
            <AuthStatusButton />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}