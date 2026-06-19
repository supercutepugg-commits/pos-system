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
    <html lang="ko" className="h-full">
      <body className="min-h-full bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
