"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  VerifiedBadge,
  IconChart,
  IconChat,
  IconDiscord,
  IconKey,
  IconLock,
  IconNews,
  IconRocket,
  IconShield,
  IconUser,
  IconWrench,
} from "@/components/Icons";

type Me = { id: string; username: string; role: string; avatarUrl?: string } | null;

/** Пункты, которые всегда видны в баре — только самое частое. */
const MAIN = [
  { href: "/", label: "Главная", icon: <IconRocket size={15} /> },
  { href: "/news", label: "Новости", icon: <IconNews size={15} /> },
  { href: "/chat", label: "Чат", icon: <IconChat size={15} /> },
];

/** Остальное убрано в выпадающее меню «Ещё». */
const MORE = [
  { href: "/support", label: "Саппорт", icon: <IconWrench size={15} />, desc: "Тикеты и помощь" },
  { href: "/stats", label: "Статистика", icon: <IconChart size={15} />, desc: "Онлайн и сервера" },
  { href: "/legal", label: "Политика и условия", icon: <IconShield size={15} />, desc: "Возврат, правила, данные" },
];

export default function Navbar() {
  const [me, setMe] = useState<Me>(null);
  const [mobile, setMobile] = useState(false);
  const [more, setMore] = useState(false);
  const [profile, setProfile] = useState(false);
  const pathname = usePathname();

  const moreRef = useRef<HTMLDivElement>(null);
  const profRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setMe(d.user || null))
      .catch(() => {});
  }, []);

  // закрываем всё при переходе на другую страницу
  useEffect(() => {
    setMobile(false);
    setMore(false);
    setProfile(false);
  }, [pathname]);

  // клик вне меню и Escape — закрыть
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (moreRef.current && !moreRef.current.contains(t)) setMore(false);
      if (profRef.current && !profRef.current.contains(t)) setProfile(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMore(false);
        setProfile(false);
        setMobile(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/";
  }

  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const isStaff = me?.role === "ADMIN" || me?.role === "MODERATOR";

  return (
    <nav className="sticky top-0 z-50 glass border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[64px] flex items-center justify-between gap-3">
        {/* логотип */}
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <img src="/lobok.jpg" alt="Lobok" className="w-9 h-9 rounded-xl object-cover glow" />
          <span className="font-bold tracking-tight text-lg whitespace-nowrap">
            Lobok <span className="gradient-text">Client</span>
          </span>
          <span className="hidden lg:inline text-xs px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/60">
            HvH • 1.16.5
          </span>
        </Link>

        {/* основное меню */}
        <div className="hidden md:flex items-center gap-1 text-sm">
          {MAIN.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={`px-3 py-2 rounded-full transition-colors ${
                active(it.href) ? "bg-white/10 text-white font-medium" : "hover:bg-white/5 text-white/70"
              }`}
            >
              {it.label}
            </Link>
          ))}

          {/* выпадающее «Ещё» */}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => {
                setMore((v) => !v);
                setProfile(false);
              }}
              aria-expanded={more}
              className={`px-3 py-2 rounded-full inline-flex items-center gap-1.5 transition-colors ${
                more || MORE.some((m) => active(m.href))
                  ? "bg-white/10 text-white font-medium"
                  : "hover:bg-white/5 text-white/70"
              }`}
            >
              Ещё
              <svg
                width="10"
                height="10"
                viewBox="0 0 12 12"
                fill="none"
                className={`transition-transform ${more ? "rotate-180" : ""}`}
              >
                <path d="M2 4.5L6 8.5L10 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {more && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-white/10 bg-[#0d0d1a] shadow-2xl shadow-black/60 p-1.5 animate-in">
                {MORE.map((it) => (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl transition-colors ${
                      active(it.href) ? "bg-white/10" : "hover:bg-white/5"
                    }`}
                  >
                    <span className="text-white/70 mt-0.5 shrink-0">{it.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-sm text-white/90 font-medium">{it.label}</span>
                      <span className="block text-[11px] text-white/40">{it.desc}</span>
                    </span>
                  </Link>
                ))}
                <div className="my-1 border-t border-white/5" />
                <a
                  href="https://discord.gg/ASXzHaQfvj"
                  target="_blank"
                  rel="noopener"
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
                >
                  <span className="text-indigo-300 shrink-0">
                    <IconDiscord size={15} />
                  </span>
                  <span className="text-sm text-white/90 font-medium">Discord</span>
                  <span className="ml-auto text-[10px] text-white/30">↗</span>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* правая часть */}
        <div className="flex items-center gap-2">
          {me ? (
            <div className="relative" ref={profRef}>
              <button
                onClick={() => {
                  setProfile((v) => !v);
                  setMore(false);
                }}
                aria-expanded={profile}
                className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full glass hover:bg-white/10 transition-colors"
              >
                <img
                  src={me.avatarUrl || "/lobok.jpg"}
                  className="w-7 h-7 rounded-full object-cover"
                  alt=""
                />
                <span
                  className={`hidden sm:block text-sm font-medium ${
                    me.role === "ADMIN"
                      ? "text-red-400 font-bold"
                      : me.role === "MODERATOR"
                        ? "text-blue-400 font-bold"
                        : "text-zinc-300"
                  }`}
                >
                  {me.username}
                </span>
                <VerifiedBadge role={me.role} size={15} />
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 12 12"
                  fill="none"
                  className={`hidden sm:block text-white/40 transition-transform ${profile ? "rotate-180" : ""}`}
                >
                  <path d="M2 4.5L6 8.5L10 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {profile && (
                <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-white/10 bg-[#0d0d1a] shadow-2xl shadow-black/60 p-1.5 animate-in">
                  <div className="px-3 py-2 border-b border-white/5 mb-1">
                    <div className="text-sm font-bold text-white/90 truncate">{me.username}</div>
                    <div className="text-[11px] text-white/40">
                      {me.role === "ADMIN" ? "Администратор" : me.role === "MODERATOR" ? "Модератор" : "Пользователь"}
                    </div>
                  </div>

                  <Link href="/cabinet" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors">
                    <span className="text-white/70 shrink-0"><IconKey size={15} /></span>
                    <span className="text-sm text-white/90">Кабинет и ключи</span>
                  </Link>
                  <Link href={`/profile/${me.username}`} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors">
                    <span className="text-white/70 shrink-0"><IconUser size={15} /></span>
                    <span className="text-sm text-white/90">Мой профиль</span>
                  </Link>
                  {isStaff && (
                    <Link href="/admin" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors">
                      <span className="text-red-400 shrink-0"><IconLock size={15} /></span>
                      <span className="text-sm text-white/90">
                        {me.role === "ADMIN" ? "Админ-панель" : "Модерация"}
                      </span>
                    </Link>
                  )}
                  <div className="my-1 border-t border-white/5" />
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-red-500/10 text-left transition-colors"
                  >
                    <span className="text-red-400 shrink-0">⏻</span>
                    <span className="text-sm text-red-300">Выйти</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/auth/login" className="hidden sm:block text-sm px-5 py-2 rounded-full btn-ghost">
                Войти
              </Link>
              <Link href="/auth/register" className="text-sm px-5 py-2 rounded-full btn-primary text-white font-medium">
                Регистрация
              </Link>
            </>
          )}

          <button
            onClick={() => setMobile((v) => !v)}
            aria-label="Меню"
            className="md:hidden w-9 h-9 rounded-full glass grid place-items-center text-white/80"
          >
            {mobile ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* мобильное меню */}
      {mobile && (
        <div className="md:hidden border-t border-white/5 bg-[#0a0a14] p-3 grid gap-0.5 text-sm">
          {MAIN.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl ${
                active(it.href) ? "bg-white/10 font-medium" : "hover:bg-white/5"
              }`}
            >
              <span className="text-white/70">{it.icon}</span>
              {it.label}
            </Link>
          ))}

          <div className="my-1.5 border-t border-white/5" />

          {MORE.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl ${
                active(it.href) ? "bg-white/10 font-medium" : "hover:bg-white/5"
              }`}
            >
              <span className="text-white/70">{it.icon}</span>
              {it.label}
            </Link>
          ))}

          <a
            href="https://discord.gg/ASXzHaQfvj"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/5"
          >
            <span className="text-indigo-300"><IconDiscord size={15} /></span>
            Discord
            <span className="ml-auto text-[10px] text-white/30">↗</span>
          </a>

          {me && (
            <>
              <div className="my-1.5 border-t border-white/5" />
              <Link href="/cabinet" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/5">
                <span className="text-white/70"><IconKey size={15} /></span>
                Кабинет и ключи
              </Link>
              <Link href={`/profile/${me.username}`} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/5">
                <span className="text-white/70"><IconUser size={15} /></span>
                Мой профиль
              </Link>
              {isStaff && (
                <Link href="/admin" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/10 text-white">
                  <span className="text-red-400"><IconLock size={15} /></span>
                  {me.role === "ADMIN" ? "Админ-панель" : "Модерация"}
                </Link>
              )}
              <button
                onClick={logout}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-red-500/10 text-left text-red-300"
              >
                <span>⏻</span> Выйти
              </button>
            </>
          )}

          {!me && (
            <>
              <div className="my-1.5 border-t border-white/5" />
              <Link href="/auth/login" className="px-3 py-2.5 rounded-xl hover:bg-white/5">
                Войти
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
