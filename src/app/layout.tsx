import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Lobok Client — HvH чит для Minecraft",
  description: "Lobok Client — приватный HvH клиент для Minecraft. MetaHvH, HvH сервера, обход античитов, лаунчер с автообновлением.",
  icons: { icon: "/lobok.jpg" },
  openGraph: { title: "Lobok Client", description: "Приватный HvH клиент", images: ["/lobok.jpg"] }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${geist.variable} ${mono.variable} dark`}>
      <body className="min-h-screen flex flex-col antialiased">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-white/5 py-8 text-center text-xs text-white/40">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>© 2026 Lobok Client — MetaHvH / HvH • Все права защищены</span>
            <span className="flex gap-3">
              <a className="hover:text-white" href="https://discord.gg/ASXzHaQfvj" target="_blank">Discord</a>
              <a className="hover:text-white" href="/stats">Статистика</a>
              <a className="hover:text-white" href="https://lobok-client.vercel.app">lobok-client.vercel.app</a>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
