"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { IconLock, IconTelegram } from "@/components/Icons";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [need2FA, setNeed2FA] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function request2FA(silent = false) {
    const r = await fetch("/api/telegram/2fa/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const d = await r.json();
    setCooldown(45);
    if (!silent) setInfo(d.message || "Код отправлен в Telegram");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setInfo("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, code: need2FA ? code : undefined }),
      });
      const data = await res.json();

      if (data.need2FA) {
        setNeed2FA(true);
        setInfo("Мы отправили код в Telegram — введи его ниже");
        request2FA(true); // код придёт сам, без лишних кликов
        return;
      }
      if (!res.ok) {
        setErr(data.error || "Ошибка входа");
        return;
      }
      location.href = "/cabinet";
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="rounded-[24px] glass gradient-border p-6 sm:p-8 space-y-5">
        <div>
          <h1 className="text-2xl font-black">Вход в Lobok</h1>
          <p className="text-sm text-white/50 mt-1">
            {need2FA ? "Подтверди вход кодом из Telegram" : "Введи логин и пароль"}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Логин"
            autoComplete="username"
            disabled={need2FA}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500 disabled:opacity-60"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            autoComplete="current-password"
            disabled={need2FA}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500 disabled:opacity-60"
          />

          {need2FA && (
            <div className="space-y-2 rounded-xl border border-violet-500/30 bg-violet-500/5 p-3">
              <div className="flex items-center gap-2 text-xs text-violet-200">
                <IconLock size={14} /> Двухфакторная защита включена
              </div>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-violet-500/40 tracking-[0.4em] text-center text-lg font-bold"
              />
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[11px] text-white/40">
                  <IconTelegram size={12} /> Код отправлен в бота
                </span>
                <button
                  type="button"
                  onClick={() => request2FA()}
                  disabled={cooldown > 0}
                  className="text-xs text-violet-300 underline disabled:opacity-40 disabled:no-underline"
                >
                  {cooldown > 0 ? `Отправить ещё раз (${cooldown})` : "Отправить ещё раз"}
                </button>
              </div>
            </div>
          )}

          {info && (
            <div className="text-sm text-violet-200 bg-violet-500/10 p-2.5 rounded-xl">{info}</div>
          )}
          {err && <div className="text-sm text-red-300 bg-red-500/10 p-2.5 rounded-xl">{err}</div>}

          <button
            disabled={loading || (need2FA && code.length < 6)}
            className="w-full py-3 rounded-xl btn-primary text-white font-bold disabled:opacity-50"
          >
            {loading ? "Проверяем..." : need2FA ? "Подтвердить вход" : "Войти"}
          </button>

          {need2FA && (
            <button
              type="button"
              onClick={() => {
                setNeed2FA(false);
                setCode("");
                setInfo("");
              }}
              className="w-full text-xs text-white/40 hover:text-white/70"
            >
              ← Назад
            </button>
          )}
        </form>

        <div className="text-sm text-center text-white/50 space-y-1">
          <div>
            Нет аккаунта?{" "}
            <Link href="/auth/register" className="text-violet-400">
              Регистрация
            </Link>
          </div>
          <div>
            <Link href="/auth/forgot" className="text-white/40 hover:text-violet-400 text-xs">
              Забыл пароль?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
