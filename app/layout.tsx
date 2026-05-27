import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crypto News Trader",
  description: "News and sentiment-driven crypto trading bot",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
