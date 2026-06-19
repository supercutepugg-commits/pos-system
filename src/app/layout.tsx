import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "POS 전산 시스템",
  description: "포스 설치 및 가입 대행 전산 시스템",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="h-full" style={{ colorScheme: 'light' }}>
      <body className="min-h-full antialiased" style={{ background: '#f8fafc', color: '#0f172a' }}>{children}</body>
    </html>
  );
}
