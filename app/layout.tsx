import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DnDAIe5 • AI Dungeon Master & Party RPG",
  description: "D&D 5e приключение с искусственным интеллектом в роли Мастера Подземелий (Solo & Co-op).",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#020617",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="h-full overflow-hidden">
      <body className="font-sans antialiased bg-[#06070a] text-slate-100 h-full h-[100dvh] max-h-[100dvh] overflow-hidden overscroll-none selection:bg-amber-500/30 selection:text-amber-200">
        {children}
      </body>
    </html>
  );
}
