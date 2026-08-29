"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { IconLock, IconTelegram, IconCheck } from "@/components/Icons";

/**
 * Восстановление пароля.
 * Шаг 1 — логин, код уходит в привязанный Telegram.
 * Шаг 2 — код + новый пароль.
 */
export default function ForgotPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(again = false) {
    if (!username.trim()) return setErr("Введи логин");
    setErr("");
    setLoading(true);
    try {
      const r = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error || "Ошибка");
      setInfo(d.message);
      setCooldown(45);
      if (!again) setStep(2);
    } finally {
      setLoading(false);
    }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (pw.length < 6) return setErr("Пароль минимум 6 символов");
    if (pw !== pw2) return setErr("Пароли не совпадают");
    setLoading(true);
    try {
      const r = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), code, newPassword: pw }),
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error || "Ошибка");
      setStep(3);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="rounded-[24px] glass gradient-border p-6 sm:p-8 space-y-5">
        <div>
          <h1 className="text-2xl font-black">Забыл пароль</h1>
          <p className="text-sm text-white/50 mt-1">
            {step === 1 && "Пришлём код в твой Telegram"}
            {step === 2 && "Введи код из Telegram и новый пароль"}
            {step === 3 && "Готово!"}
          </p>
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-xl border border-violet-500/25 bg-violet-500/5 p-3 text-xs text-violet-100/80">
              <IconTelegram size={14} />
              <span>
                Восстановление работает только через привязанный Telegram. Если бот не привязан —
                напиши в поддержку.
              </span>
            </div>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Логин"
              autoComplete="username"
              autoFocus
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500"
            />
            {err && <div className="text-sm text-red-300 bg-red-500/10 p-2.5 rounded-xl">{err}</div>}
            <button
              onClick={() => sendCode()}
              disabled={loading}
              className="w-full py-3 rounded-xl btn-primary text-white font-bold disabled:opacity-50"
            >
              {loading ? "Отправляем..." : "Прислать код"}
            </button>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={reset} className="space-y-3">
            <div className="space-y-2 rounded-xl border border-violet-500/30 bg-violet-500/5 p-3">
              <div className="flex items-center gap-2 text-xs text-violet-200">
                <IconLock size={14} /> Код из Telegram
              </div>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-violet-500/40 tracking-[0.4em] text-center text-lg font-bold"
              />
              <button
                type="button"
                onClick={() => sendCode(true)}
                disabled={cooldown > 0}
                className="text-xs text-violet-300 underline disabled:opacity-40 disabled:no-underline"
              >
                {cooldown > 0 ? `Отправить ещё раз (${cooldown})` : "Отправить ещё раз"}
              </button>
            </div>

            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Новый пароль"
              autoComplete="new-password"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500"
            />
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              placeholder="Повтори новый пароль"
              autoComplete="new-password"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500"
            />

            {info && (
              <div className="text-sm text-violet-200 bg-violet-500/10 p-2.5 rounded-xl">{info}</div>
            )}
            {err && <div className="text-sm text-red-300 bg-red-500/10 p-2.5 rounded-xl">{err}</div>}

            <button
              disabled={loading || code.length < 6}
              className="w-full py-3 rounded-xl btn-primary text-white font-bold disabled:opacity-50"
            >
              {loading ? "Меняем..." : "Сменить пароль"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setCode("");
                setErr("");
              }}
              className="w-full text-xs text-white/40 hover:text-white/70"
            >
              ← Назад
            </button>
          </form>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <IconCheck size={18} /> Пароль изменён
            </div>
            <Link
              href="/auth/login"
              className="block w-full py-3 rounded-xl btn-primary text-white font-bold text-center"
            >
              Войти
            </Link>
          </div>
        )}

        <div className="text-sm text-center text-white/50">
          Вспомнил пароль?{" "}
          <Link href="/auth/login" className="text-violet-400">
            Войти
          </Link>
        </div>
      </div>
    </div>
  );
}
