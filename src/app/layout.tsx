import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "comp03 - AI Development System",
  description: "AI-powered multi-agent system for software development",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
