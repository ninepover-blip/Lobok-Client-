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
        <footer className="border-t border-white/5 py-8 text-xs text-white/40">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <span>© 2026 Lobok Client — MetaHvH / HvH • Все права защищены</span>
            <span className="flex flex-wrap justify-center items-center gap-3">
              <a className="hover:text-white transition-colors" href="https://discord.gg/ASXzHaQfvj" target="_blank" rel="noopener">Discord</a>
              <a className="hover:text-white transition-colors" href="/stats">Статистика</a>
              <a
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-violet-500/40 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20 hover:text-white transition-colors font-medium"
                href="/legal"
              >
                Политика и условия
              </a>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
