import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LanguageProvider } from "@/components/language-provider";

export const metadata: Metadata = {
  title: "Lingua Live · 即時雙語字幕",
  description: "讓每一句話，都能被理解。以 Agora 串起原文與翻譯，掃碼即可加入雙語字幕。",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0b0f16" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body><LanguageProvider>{children}</LanguageProvider></body></html>;
}
