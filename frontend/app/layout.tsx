import type { Metadata, Viewport } from "next";
import { SiteThemeProvider } from "@/components/SiteThemeProvider";
import "./globals.css";
import "./site-theme.css";

export const metadata: Metadata = {
  title: "饿了幺 · 全天候私人管家作品站",
  description: "面向比赛评审的饿了幺 AI 管家作品站，包含设计与思路、演示视频和 Web 在线体验；设计与思路下承载调研、技术路线、架构和未来展望。"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#047857"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <SiteThemeProvider>{children}</SiteThemeProvider>
      </body>
    </html>
  );
}
