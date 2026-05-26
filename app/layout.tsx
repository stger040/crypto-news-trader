import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "News Sentiment Trading Bot",
  description: "Crypto news and sentiment-driven trading bot dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-mono antialiased">{children}</body>
    </html>
  );
}
