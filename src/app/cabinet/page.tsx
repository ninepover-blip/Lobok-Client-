"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  IconCard,
  IconCheck,
  IconClock,
  IconCopy,
  IconDiscord,
  IconGift,
  IconKey,
  IconLock,
  IconTelegram,
  RoleBadge,
  VerifiedBadge,
} from "@/components/Icons";

type Me = {
  id: string;
  username: string;
  role: string;
  avatarUrl?: string | null;
  telegramId?: string | null;
  is2FAEnabled?: boolean;
};

const TARIFFS = [
  { id: "D30", title: "30 дней", rub: 100, uah: 50 },
  { id: "D90", title: "90 дней", rub: 250, uah: 125 },
  { id: "FOREVER", title: "Навсегда", rub: 400, uah: 200 },
] as const;

const METHODS = [
  { id: "YOOMONEY", title: "ЮMoney", hint: "автоматически", cur: "₽" },
  { id: "CARD_RU", title: "Карта МИР", hint: "перевод", cur: "₽" },
  { id: "MONO_UA", title: "Monobank", hint: "перевод", cur: "₴" },
  { id: "IBAN_UA", title: "IBAN", hint: "перевод", cur: "₴" },
] as const;

export default function Cabinet() {
  const [me, setMe] = useState<Me | null>(null);
  const [keys, setKeys] = useState<any[]>([]);
  const [free, setFree] = useState<any>(null);
  const [tg, setTg] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [form, setForm] = useState({
    newUsername: "",
    oldPassword: "",
    newPassword: "",
    avatarUrl: "",
    discordConfirmed: false,
  });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [buy, setBuy] = useState<{ type: string; method: string }>({ type: "D30", method: "YOOMONEY" });
  const [order, setOrder] = useState<any>(null);
  const [linking, setLinking] = useState<any>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<any>(null);
  const [promoErr, setPromoErr] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [freeStep, setFreeStep] = useState<"idle"|"code_sent"|"verified">("idle");
  const [freeCode, setFreeCode] = useState("");
  const [freeBusy, setFreeBusy] = useState(false);

  const loadKeys = useCallback(() => {
    fetch("/api/keys?mine=1").then((r) => r.json()).then((d) => setKeys(d.keys || []));
  }, []);
  const loadPayments = useCallback(() => {
    fetch("/api/payments").then((r) => r.json()).then((d) => setPayments(d.payments || []));
  }, []);
  const loadTg = useCallback(() => {
    fetch("/api/telegram/link").then((r) => r.json()).then(setTg).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) location.href = "/auth/login";
        else setMe(d.user);
      });
    loadKeys();
    loadPayments();
    loadTg();
    fetch("/api/free-key/claim").then((r) => r.json()).then(setFree);
  }, [loadKeys, loadPayments, loadTg]);

  // ключ приходит автоматически — опрашиваем заказ, пока он не оплачен
  useEffect(() => {
    if (!order?.payment?.id || order.done) return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/payments/${order.payment.id}`);
      const d = await r.json();
      if (d.payment?.status === "PAID") {
        setOrder((o: any) => ({ ...o, done: true, key: d.key }));
        setMsg(`Оплата подтверждена! Ключ: ${d.key?.key ?? ""}`);
        loadKeys();
        loadPayments();
        clearInterval(t);
      }
    }, 5000);
    return () => clearInterval(t);
  }, [order, loadKeys, loadPayments]);

  function flash(text: string, isError = false) {
    if (isError) {
      setErr(text);
      setMsg("");
    } else {
      setMsg(text);
      setErr("");
    }
    setTimeout(() => {
      setMsg("");
      setErr("");
    }, 6000);
  }

  async function saveSettings() {
    const res = await fetch("/api/auth/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    if (!res.ok) flash(d.error, true);
    else {
      flash("Сохранено");
      setMe(d.user);
      setForm({ ...form, oldPassword: "", newPassword: "", newUsername: "" });
    }
  }

  async function claimFree() {
    if (!form.discordConfirmed) return flash("Подтверди подписку на Discord", true);
    if (freeStep !== "verified") return flash("Сначала пройди верификацию Telegram", true);
    const res = await fetch("/api/free-key/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discordConfirmed: true, twoFACode: freeCode }),
    });
    const d = await res.json();
    if (!res.ok) flash(d.error, true);
    else {
      flash(`Ключ выдан: ${d.key}`);
      setFreeStep("idle");
      setFreeCode("");
      loadKeys();
      fetch("/api/free-key/claim").then((r) => r.json()).then(setFree);
    }
  }

  async function requestFreeCode() {
    if (!me?.is2FAEnabled || !me?.telegramId) {
      return flash("Сначала привяжи Telegram и включи 2FA в настройках аккаунта", true);
    }
    setFreeBusy(true);
    try {
      const r = await fetch("/api/telegram/2fa/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: me.username }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) return flash(d.error || "Не удалось отправить код", true);
      setFreeStep("code_sent");
      flash("Код отправлен в Telegram — введи его ниже");
    } finally {
      setFreeBusy(false);
    }
  }

  async function verifyFreeCode() {
    if (!freeCode.trim()) return flash("Введи код", true);
    setFreeBusy(true);
    try {
      const r = await fetch("/api/telegram/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: me!.username, code: freeCode.trim() }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) return flash(d.error || "Неверный код", true);
      setFreeStep("verified");
      flash("Код подтверждён — теперь можно забрать ключ");
    } finally {
      setFreeBusy(false);
    }
  }

  /** Привязка Telegram: один клик, никаких ID и команд. */
  async function linkTelegram() {
    const r = await fetch("/api/telegram/link", { method: "POST" });
    const d = await r.json();
    if (!r.ok) return flash(d.error, true);
    setLinking(d);
    window.open(d.botUrl, "_blank", "noopener");
    // ждём, пока бот подтвердит привязку
    const started = Date.now();
    const t = setInterval(async () => {
      const s = await fetch("/api/telegram/link").then((x) => x.json());
      if (s.linked) {
        setTg(s);
        setLinking(null);
        flash("Telegram привязан!");
        clearInterval(t);
      } else if (Date.now() - started > 5 * 60 * 1000) clearInterval(t);
    }, 3000);
  }

  async function unlinkTelegram() {
    if (!confirm("Отвязать Telegram? 2FA выключится.")) return;
    await fetch("/api/telegram/link", { method: "DELETE" });
    loadTg();
    location.reload();
  }

  async function toggle2FA() {
    const en = !me?.is2FAEnabled;
    const r = await fetch("/api/auth/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is2FAEnabled: en }),
    });
    const d = await r.json();
    if (!r.ok) return flash(d.error, true);
    setMe((m) => (m ? { ...m, is2FAEnabled: en } : m));
    flash(en ? "2FA включена — при входе спросим код из Telegram" : "2FA выключена");
  }

  /** Проверка промокода до оплаты — показывает новую цену. */
  async function checkPromoCode() {
    const code = promoInput.trim();
    if (!code) return;
    setPromoBusy(true);
    setPromoErr("");
    try {
      const r = await fetch("/api/promo/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, keyType: buy.type }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) {
        setPromo(null);
        setPromoErr(d.error || "Промокод не подошёл");
        return;
      }
      setPromo(d);
      setOrder(null);
    } finally {
      setPromoBusy(false);
    }
  }

  function clearPromo() {
    setPromo(null);
    setPromoInput("");
    setPromoErr("");
    setOrder(null);
  }

  async function createOrder() {
    const r = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyType: buy.type,
        method: buy.method,
        promoCode: promo?.code || undefined,
      }),
    });
    const d = await r.json();
    if (!r.ok) {
      // промокод мог протухнуть между проверкой и оплатой
      if (promo) {
        setPromo(null);
        setPromoErr(d.error || "");
      }
      return flash(d.error, true);
    }
    setOrder(d);
    loadPayments();
    if (d.instructions?.payUrl) window.open(d.instructions.payUrl, "_blank", "noopener");
  }

  async function iPaid() {
    if (!order?.payment?.id) return;
    const r = await fetch(`/api/payments/${order.payment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "paid" }),
    });
    const d = await r.json();
    flash(d.message || d.error, !r.ok);
  }

  /** Отмена заказа покупателем — чтобы не висели пустые «Ожидаем оплату». */
  async function cancelOrder(id?: string) {
    const payId = id || order?.payment?.id;
    if (!payId) return;
    if (!confirm("Отменить этот заказ?")) return;
    const r = await fetch(`/api/payments/${payId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    const d = await r.json();
    if (!r.ok) return flash(d.error, true);
    if (!id || id === order?.payment?.id) setOrder(null);
    flash(d.message || "Заказ отменён");
    loadPayments();
    loadKeys();
  }

  const copy = (t: string) => {
    navigator.clipboard?.writeText(t);
    flash("Скопировано");
  };

  if (!me) return <div className="p-10 text-center text-white/50">Загрузка...</div>;

  const tariff = TARIFFS.find((t) => t.id === buy.type)!;
  const method = METHODS.find((m) => m.id === buy.method)!;

  /** Цена со скидкой — считается тем же правилом, что и на сервере. */
  const off = (n: number) =>
    promo ? Math.max(1, Math.floor(n * (1 - promo.discount / 100))) : n;
  const payRub = off(tariff.rub);
  const payUah = off(tariff.uah);
  const payNow = method.cur === "₽" ? `${payRub}₽` : `${payUah}₴`;
  const payWas = method.cur === "₽" ? `${tariff.rub}₽` : `${tariff.uah}₴`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {(msg || err) && (
        <div
          className={`p-3 rounded-xl text-sm ${
            err ? "bg-red-500/15 text-red-200 border border-red-500/20" : "bg-white/5 text-white/70"
          }`}
        >
          {err || msg}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* профиль */}
        <div className="rounded-[22px] glass p-6 space-y-4">
          <div className="flex gap-4 items-center">
            <div className="relative">
              <img
                src={me.avatarUrl || "/lobok.jpg"}
                className="w-20 h-20 rounded-2xl object-cover border border-white/10"
                alt=""
              />
              {(me.role === "ADMIN" || me.role === "MODERATOR") && (
                <span className="absolute -bottom-1 -right-1 rounded-full bg-[#0a0a14] p-0.5">
                  <VerifiedBadge role={me.role} size={22} />
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-xl font-bold ${
                    me.role === "ADMIN"
                      ? "text-red-400"
                      : me.role === "MODERATOR"
                        ? "text-blue-400"
                        : "text-zinc-300"
                  }`}
                >
                  {me.username}
                </span>
                <VerifiedBadge role={me.role} size={18} />
              </div>
              <div className="mt-1.5">
                <RoleBadge role={me.role} />
              </div>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <label className="text-white/60 text-xs">Аватар URL</label>
            <input
              value={form.avatarUrl}
              onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
              placeholder={me.avatarUrl || "/lobok.jpg"}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm"
            />
            <label className="text-white/60 text-xs">Логин</label>
            <input
              value={form.newUsername}
              onChange={(e) => setForm({ ...form, newUsername: e.target.value })}
              placeholder={me.username}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10"
            />
            <label className="text-white/60 text-xs">Смена пароля</label>
            <input
              type="password"
              value={form.oldPassword}
              onChange={(e) => setForm({ ...form, oldPassword: e.target.value })}
              placeholder="Старый пароль"
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10"
            />
            <input
              type="password"
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              placeholder="Новый пароль"
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveSettings}
              className="flex-1 py-2.5 rounded-full btn-primary text-white font-semibold text-sm"
            >
              Сохранить
            </button>
            <Link href={`/profile/${me.username}`} className="px-4 py-2.5 rounded-full btn-ghost text-sm">
              Профиль
            </Link>
          </div>

          {/* 2FA — понятная инструкция */}
          <div className="pt-4 border-t border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold flex items-center gap-2">
                <IconLock size={16} /> Двухфакторная защита
              </div>
              <span
                className={`text-[11px] px-2 py-1 rounded-full font-bold ${
                  me.is2FAEnabled ? "bg-emerald-500 text-black" : "bg-white/10 text-white/50"
                }`}
              >
                {me.is2FAEnabled ? "ВКЛЮЧЕНА" : "ВЫКЛЮЧЕНА"}
              </span>
            </div>

            <p className="text-xs text-white/50">
              Защищает аккаунт: при каждом входе бот присылает 6-значный код в Telegram.
            </p>

            <ol className="space-y-1.5 text-xs">
              {[
                { t: "Привязать Telegram", done: !!tg?.linked },
                { t: "Включить 2FA переключателем", done: !!me.is2FAEnabled },
                { t: "При входе ввести код из бота", done: !!me.is2FAEnabled },
              ].map((s, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span
                    className={`w-5 h-5 rounded-full grid place-items-center text-[10px] font-bold shrink-0 ${
                      s.done ? "bg-emerald-500 text-black" : "bg-white/10 text-white/50"
                    }`}
                  >
                    {s.done ? <IconCheck size={12} /> : i + 1}
                  </span>
                  <span className={s.done ? "text-white/70" : "text-white/50"}>{s.t}</span>
                </li>
              ))}
            </ol>

            {tg?.linked ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl bg-[#2AABEE]/10 text-[#5cc8f5]">
                  <IconTelegram size={14} />
                  Привязан{tg.telegramUsername ? `: @${tg.telegramUsername}` : ""}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={toggle2FA}
                    className={`flex-1 px-3 py-2 rounded-full text-xs font-bold ${
                      me.is2FAEnabled ? "bg-white/10" : "btn-primary text-white"
                    }`}
                  >
                    {me.is2FAEnabled ? "Выключить 2FA" : "Включить 2FA"}
                  </button>
                  <button onClick={unlinkTelegram} className="px-3 py-2 rounded-full bg-white/5 text-xs">
                    Отвязать
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={linkTelegram}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-full bg-[#2AABEE] text-white text-xs font-bold"
                >
                  <IconTelegram size={15} /> Привязать Telegram в 1 клик
                </button>
                {linking && (
                  <p className="text-[11px] text-white/40">
                    Открылся бот — нажми «Start». Страница обновится сама.{" "}
                    <a href={linking.botUrl} target="_blank" className="text-white/70 underline">
                      Открыть ещё раз
                    </a>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* правая колонка */}
        <div className="lg:col-span-2 space-y-4">
          {/* покупка */}
          <div className="rounded-[22px] glass p-6 space-y-4">
            <h3 className="font-bold flex items-center gap-2">
              <IconCard size={18} /> Купить ключ
            </h3>

            <div className="grid sm:grid-cols-3 gap-2">
              {TARIFFS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setBuy({ ...buy, type: t.id });
                    setOrder(null);
                  }}
                  className={`p-3 rounded-xl border text-left transition ${
                    buy.type === t.id
                      ? "bg-white/5 border-white/20"
                      : "bg-white/[0.03] border-white/5 hover:bg-white/5"
                  }`}
                >
                  <div className="font-bold text-sm">{t.title}</div>
                  {promo ? (
                    <div className="text-xs">
                      <span className="line-through text-white/30">
                        {t.rub}₽ / {t.uah}₴
                      </span>{" "}
                      <span className="text-emerald-300 font-bold">
                        {off(t.rub)}₽ / {off(t.uah)}₴
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-white/50">
                      {t.rub}₽ / {t.uah}₴
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setBuy({ ...buy, method: m.id });
                    setOrder(null);
                  }}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    buy.method === m.id
                      ? "bg-white/5 border-white/20"
                      : "bg-white/[0.03] border-white/5 hover:bg-white/5"
                  }`}
                >
                  <div className="text-xs font-bold">{m.title}</div>
                  <div className="text-[10px] text-white/40">{m.hint}</div>
                </button>
              ))}
            </div>

            {/* промокод */}
            <div className="space-y-2">
              {!promo ? (
                <>
                  <div className="flex gap-2">
                    <input
                      value={promoInput}
                      onChange={(e) => {
                        setPromoInput(e.target.value.toUpperCase());
                        setPromoErr("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") checkPromoCode();
                      }}
                      placeholder="Промокод, если есть"
                      className={`flex-1 px-3 py-2.5 rounded-xl bg-white/[0.04] border text-sm font-mono uppercase tracking-wide placeholder:font-sans placeholder:normal-case placeholder:tracking-normal ${
                        promoErr ? "border-red-500/40" : "border-white/10"
                      }`}
                    />
                    <button
                      onClick={checkPromoCode}
                      disabled={promoBusy || !promoInput.trim()}
                      className="px-5 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium disabled:opacity-40 shrink-0"
                    >
                      {promoBusy ? "..." : "Применить"}
                    </button>
                  </div>
                  {promoErr && <p className="text-xs text-red-300 px-1">{promoErr}</p>}
                </>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                  <IconCheck size={16} />
                  <span className="text-sm">
                    <b className="font-mono">{promo.code}</b>
                    <span className="text-emerald-300 font-bold"> −{promo.discount}%</span>
                    <span className="text-white/50">
                      {" "}
                      · экономия {tariff.rub - payRub}₽ / {tariff.uah - payUah}₴
                    </span>
                  </span>
                  <button
                    onClick={clearPromo}
                    className="ml-auto text-xs text-white/40 hover:text-white/70 shrink-0"
                  >
                    убрать
                  </button>
                </div>
              )}
            </div>

            <button onClick={createOrder} className="w-full py-3 rounded-full btn-primary text-white font-bold">
              Оплатить{" "}
              {promo && <span className="line-through opacity-50 font-normal">{payWas}</span>} {payNow} —{" "}
              {method.title}
            </button>
            <p className="text-[11px] text-center text-white/35 leading-relaxed -mt-1">
              Оплачивая, ты соглашаешься с{" "}
              <a href="/legal#refund" className="text-white/60 hover:text-white/80 underline">
                условиями возврата
              </a>
              : после активации ключа возврат невозможен
            </p>

            {/* реквизиты заказа */}
            {order && (
              <div className="rounded-xl bg-white/[0.04] border border-white/10 p-4 space-y-2 text-sm">
                {order.done ? (
                  <div className="text-emerald-400 font-bold flex items-center gap-2">
                    <IconCheck size={16} /> Оплачено! Ключ: {order.key?.key}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-amber-300 text-xs">
                      <IconClock size={14} /> Ожидаем оплату…
                    </div>
                    {(order.instructions?.payUrl || order.instructions?.auto) && (
                      <div className="text-[11px] text-emerald-300/80 bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2">
                        Оплата подтвердится автоматически — ключ появится здесь сам, обычно за
                        несколько секунд. Главное — не потеряй метку платежа.
                      </div>
                    )}
                    {order.instructions?.card && (
                      <Row label="Карта" value={order.instructions.card} onCopy={copy} />
                    )}
                    {order.instructions?.iban && (
                      <>
                        <Row label="IBAN" value={order.instructions.iban} onCopy={copy} />
                        <Row label="Отримувач" value={order.instructions.recipient} onCopy={copy} />
                        <Row label="ІПН" value={order.instructions.tax} onCopy={copy} />
                        <Row label="Призначення" value={order.instructions.purpose} onCopy={copy} />
                      </>
                    )}
                    {order.instructions?.promo && (
                      <div className="flex items-center gap-2 text-[11px] text-emerald-300 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-2.5 py-1.5">
                        <IconCheck size={12} />
                        Промокод <b className="font-mono">{order.instructions.promo.code}</b> применён:
                        −{order.instructions.promo.discount}%
                      </div>
                    )}
                    {order.instructions?.amount && (
                      <Row label="Сумма" value={order.instructions.amount} onCopy={copy} />
                    )}
                    <Row label="Метка платежа" value={order.instructions?.label} onCopy={copy} />
                    <p className="text-xs text-white/50">{order.instructions?.note}</p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {order.instructions?.payUrl ? (
                        <a
                          href={order.instructions.payUrl}
                          target="_blank"
                          className="inline-block px-4 py-2 rounded-full btn-primary text-white text-xs font-bold"
                        >
                          Перейти к оплате
                        </a>
                      ) : (
                        <button
                          onClick={iPaid}
                          className="px-4 py-2 rounded-full bg-white text-black text-xs font-bold"
                        >
                          Я оплатил
                        </button>
                      )}
                      <button
                        onClick={() => cancelOrder()}
                        className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-red-300 hover:border-red-500/40 text-xs font-bold"
                      >
                        Отменить заказ
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {payments.length > 0 && (
              <div className="pt-2 border-t border-white/5">
                <div className="text-xs text-white/40 mb-2">Мои заказы</div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {payments.map((p) => (
                    <div key={p.id} className="flex justify-between text-xs p-2 rounded-lg bg-white/[0.03]">
                      <span className="font-mono">{p.label}</span>
                      <span className="text-white/50">
                        {p.keyType} • {p.method}
                      </span>
                      <span className="flex items-center gap-2">
                        <span
                          className={`font-bold ${
                            p.status === "PAID"
                              ? "text-emerald-400"
                              : p.status === "CANCELLED"
                                ? "text-red-400"
                                : "text-amber-400"
                          }`}
                        >
                          {p.status}
                        </span>
                        {p.status === "PENDING" && (
                          <button
                            onClick={() => cancelOrder(p.id)}
                            title="Отменить заказ"
                            className="text-white/30 hover:text-red-400 font-bold px-1"
                          >
                            ✕
                          </button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ключи */}
          <div className="rounded-[22px] glass p-6">
            <h3 className="font-bold flex items-center gap-2">
              <IconKey size={18} /> Мои ключи
            </h3>
            <p className="text-xs text-white/40">1 ключ = 1 устройство (HWID + IP)</p>
            <div className="mt-4 space-y-2">
              {keys.length === 0 && (
                <div className="text-sm text-white/40 py-6 text-center">
                  Ключей нет. Купи выше или забери бесплатный →
                </div>
              )}
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="rounded-xl bg-white/[0.04] border border-white/5 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <button
                      onClick={() => copy(k.key)}
                      className="font-mono text-sm font-bold tracking-wide inline-flex items-center gap-2 hover:text-white/80"
                      title="Скопировать"
                    >
                      {k.key} <IconCopy size={13} />
                    </button>
                    <div className="text-xs text-white/40">
                      {k.type} •{" "}
                      {k.expiresAt
                        ? `до ${new Date(k.expiresAt).toLocaleDateString("ru-RU")}`
                        : "навсегда"}{" "}
                      • HWID: {k.hwid || "—"}
                    </div>
                  </div>
                  <div
                    className={`text-xs px-2.5 py-1 rounded-full font-bold shrink-0 ${
                      k.status === "ACTIVE"
                        ? "bg-emerald-500 text-black"
                        : k.status === "REVOKED"
                          ? "bg-red-500 text-white"
                          : "bg-white/10"
                    }`}
                  >
                    {k.status}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* фри-ключ */}
          <div className="rounded-[22px] glass p-6 space-y-3">
            <h3 className="font-bold flex items-center gap-2">
              <IconGift size={18} /> Фри-ключ — 1 в день
            </h3>
            <div className="text-sm text-white/60">
              {free?.taken ? (
                <span>
                  Сегодня уже забрали: <b>{free.by}</b> • Следующий в 00:00 МСК
                </span>
              ) : (
                <span className="text-emerald-400">Свободен — успей забрать!</span>
              )}
            </div>

            {/* Шаг 1: Discord */}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.discordConfirmed}
                onChange={(e) => setForm({ ...form, discordConfirmed: e.target.checked })}
              />
              <span className="inline-flex items-center gap-1">
                Я подписался на{" "}
                <a
                  href="https://discord.gg/ASXzHaQfvj"
                  target="_blank"
                  className="text-[#8b95f7] underline inline-flex items-center gap-1"
                >
                  <IconDiscord size={13} /> Discord
                </a>
              </span>
            </label>

            {/* Шаг 2: Telegram 2FA */}
            <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 space-y-2">
              <div className="text-xs font-bold text-white/70 flex items-center gap-1.5">
                <IconLock size={13} /> Шаг 2: Верификация через Telegram
              </div>
              {!me.is2FAEnabled || !me.telegramId ? (
                <p className="text-[11px] text-amber-300/80">
                  Нужно привязать Telegram и включить 2FA в настройках аккаунта (слева).
                </p>
              ) : freeStep === "idle" ? (
                <button
                  onClick={requestFreeCode}
                  disabled={freeBusy || free?.taken}
                  className="w-full py-2 rounded-full bg-white/5 hover:bg-white/10 text-xs font-bold disabled:opacity-40"
                >
                  {freeBusy ? "Отправка..." : "Отправить код в Telegram"}
                </button>
              ) : freeStep === "code_sent" ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-white/50">Код отправлен в Telegram. Введи его:</p>
                  <div className="flex gap-2">
                    <input
                      value={freeCode}
                      onChange={(e) => setFreeCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      onKeyDown={(e) => { if (e.key === "Enter" && freeCode.length === 6) verifyFreeCode(); }}
                      placeholder="6-значный код"
                      className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 font-mono text-sm text-center tracking-widest"
                      maxLength={6}
                    />
                    <button
                      onClick={verifyFreeCode}
                      disabled={freeBusy || freeCode.length !== 6}
                      className="px-4 py-2 rounded-full btn-primary text-white text-xs font-bold disabled:opacity-40"
                    >
                      {freeBusy ? "..." : "Подтвердить"}
                    </button>
                  </div>
                  <button
                    onClick={requestFreeCode}
                    disabled={freeBusy}
                    className="text-[11px] text-white/70 hover:text-white/80"
                  >
                    Отправить повторно
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold">
                  <IconCheck size={14} /> Верификация пройдена
                </div>
              )}
            </div>

            <button
              onClick={claimFree}
              disabled={free?.taken || freeStep !== "verified" || !form.discordConfirmed}
              className="w-full py-3 rounded-full btn-primary text-white font-bold disabled:opacity-40"
            >
              Забрать фри-ключ (на 1 день)
            </button>
            <p className="text-xs text-white/30">
              Всего 1 ключ в день на весь сайт • проверка по IP, аккаунту и Telegram 2FA
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  onCopy,
}: {
  label: string;
  value?: string;
  onCopy: (v: string) => void;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-white/40 text-xs shrink-0">{label}</span>
      <button
        onClick={() => onCopy(value)}
        className="font-mono text-xs text-right hover:text-white/80 inline-flex items-center gap-1.5 min-w-0"
      >
        <span className="truncate">{value}</span>
        <IconCopy size={12} />
      </button>
    </div>
  );
}
