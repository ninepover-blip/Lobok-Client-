"use client";import { useCallback, useEffect, useRef, useState } from "react";
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
  { id: "D30", title: "30 дней", rub: 100, uah: 50, sub: "≈ 3 ₽/день" },
  { id: "D90", title: "90 дней", rub: 250, uah: 125, sub: "≈ 2.7 ₽/день" },
  { id: "FOREVER", title: "Навсегда", rub: 400, uah: 200, sub: "без ограничений" },
] as const;


const METHODS = [
  { id: "YOOMONEY", title: "ЮMoney", hint: "автоматически", cur: "₽" },
  { id: "CARD_RU", title: "Карта МИР", hint: "перевод", cur: "₽" },
  { id: "MONO_UA", title: "Monobank", hint: "перевод", cur: "₴" },
  { id: "IBAN_UA", title: "IBAN", hint: "перевод", cur: "₴" },
] as const;


const BUY_STEPS = ["Тариф", "Способ оплаты", "Оплата", "Готово"];


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
  const [buyStep, setBuyStep] = useState(0);
  const [buyErr, setBuyErr] = useState("");
  const [order, setOrder] = useState<any>(null);
  const [linking, setLinking] = useState<any>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<any>(null);
  const [promoErr, setPromoErr] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState("");
  const [payerName, setPayerName] = useState("");
  const [paymentTime, setPaymentTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrs, setFieldErrs] = useState<{ receipt?: string; payer?: string; time?: string }>({});
  const fileRef = useRef<HTMLInputElement>(null);


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


  useEffect(() => {
    if (!order?.payment?.id || order.done) return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/payments/${order.payment.id}`);
      const d = await r.json();
      if (d.payment?.status === "PAID") {
        setOrder((o: any) => ({ ...o, done: true, key: d.key, receipt: d.receipt || null }));
        setBuyStep(3);
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
    const res = await fetch("/api/free-key/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discordConfirmed: true }),
    });
    const d = await res.json();
    if (!res.ok) flash(d.error, true);
    else {
      flash(`Ключ выдан: ${d.key}`);
      loadKeys();
      fetch("/api/free-key/claim").then((r) => r.json()).then(setFree);
    }
  }


  async function linkTelegram() {
    const r = await fetch("/api/telegram/link", { method: "POST" });
    const d = await r.json();
    if (!r.ok) return flash(d.error, true);
    setLinking(d);
    window.open(d.botUrl, "_blank", "noopener");
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
    } finally {
      setPromoBusy(false);
    }
  }


  function clearPromo() {
    setPromo(null);
    setPromoInput("");
    setPromoErr("");
  }


  function resetBuy() {
    setOrder(null);
    setBuyStep(0);
    setBuyErr("");
    setReceiptPreview("");
    setPayerName("");
    setPaymentTime("");
    setFieldErrs({});
  }


  async function createOrder() {
    setBuyErr("");
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
      if (promo) {
        setPromo(null);
        setPromoErr(d.error || "");
        setBuyStep(0);
      }
      setBuyErr(d.error || "Ошибка создания заказа");
      return;
    }
    setOrder(d);
    setBuyStep(2);
    loadPayments();
    if (d.instructions?.payUrl) window.open(d.instructions.payUrl, "_blank", "noopener");
  }


  function handleReceiptFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBuyErr("");
    if (f.size > 5 * 1024 * 1024) return setBuyErr("Файл слишком большой (максимум 5 МБ)");
    const reader = new FileReader();
    reader.onload = () => setReceiptPreview(reader.result as string);
    reader.readAsDataURL(f);
  }


  async function submitPaid() {
    if (!order?.payment?.id || submitting || order.claimed) return;
    setBuyErr("");

    const fe: { receipt?: string; payer?: string; time?: string } = {};
    if (!receiptPreview) fe.receipt = "Приложи скриншот перевода — без него админ не сможет проверить оплату";
    if (!payerName.trim()) fe.payer = "Укажи ФИО плательщика";
    else if (payerName.trim().length < 5) fe.payer = "ФИО слишком короткое (минимум 5 символов)";
    if (!paymentTime) fe.time = "Укажи дату и время оплаты";
    setFieldErrs(fe);
    if (fe.receipt || fe.payer || fe.time) {
      setBuyErr("Заполни все обязательные поля чека — они отмечены красным");
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch("/api/orders/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: order.payment.id,
          receiptData: receiptPreview || null,
          payerName: payerName.trim() || null,
          paymentTime: paymentTime || null,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setBuyErr(d.error || "Не удалось отправить чек");
        return;
      }

      const r2 = await fetch(`/api/payments/${order.payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "paid", payerName: payerName.trim() || undefined }),
      });
      const d2 = await r2.json();
      if (!r2.ok) {
        setBuyErr(d2.error || "Ошибка отправки заявки");
        return;
      }
      setOrder((o: any) => ({ ...o, claimed: true }));
      flash("Заявка отправлена! Админ проверит перевод и выдаст ключ.");
    } catch {
      setBuyErr("Ошибка сети — попробуй ещё раз");
    } finally {
      setSubmitting(false);
    }
  }


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
    if (!id || id === order?.payment?.id) resetBuy();
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


  const off = (n: number) =>
    promo ? Math.max(1, Math.floor(n * (1 - promo.discount / 100))) : n;
  const payRub = off(tariff.rub);
  const payUah = off(tariff.uah);
  const payNow = method.cur === "₽" ? `${payRub}₽` : `${payUah}₴`;
  const payWas = method.cur === "₽" ? `${tariff.rub}₽` : `${tariff.uah}₴`;


  const currentStep = order?.done ? 3 : buyStep;


  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {(msg || err) && (
        <div
          className={`p-3 rounded-xl text-sm ${
            err ? "bg-red-500/15 text-red-200 border border-red-500/20" : "bg-violet-500/15 text-violet-200"
          }`}
        >
          {err || msg}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
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
                    <a href={linking.botUrl} target="_blank" className="text-violet-300 underline">
                      Открыть ещё раз
                    </a>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-[22px] glass p-6 space-y-4">
            <h3 className="font-bold flex items-center gap-2">
              <IconCard size={18} /> Купить ключ
            </h3>

            <div className="flex items-center gap-1.5 sm:gap-2">
              {BUY_STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <span
                    className={`w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold shrink-0 transition ${
                      i < currentStep
                        ? "bg-emerald-500 text-black"
                        : i === currentStep
                          ? "bg-violet-500 text-white"
                          : "bg-white/10 text-white/40"
                    }`}
                  >
                    {i < currentStep ? <IconCheck size={13} /> : i + 1}
                  </span>
                  <span
                    className={`text-xs whitespace-nowrap hidden sm:inline ${
                      i <= currentStep ? "text-white/80" : "text-white/30"
                    }`}
                  >
                    {s}
                  </span>
                  {i < BUY_STEPS.length - 1 && (
                    <span className={`h-px w-4 sm:w-8 ${i < currentStep ? "bg-emerald-500/60" : "bg-white/10"}`} />
                  )}
                </div>
              ))}
            </div>

            {buyErr && (
              <div className="p-3 rounded-xl text-xs bg-red-500/15 text-red-200 border border-red-500/20">
                {buyErr}
              </div>
            )}

            {currentStep === 0 && (
              <>
                <div className="grid sm:grid-cols-3 gap-2">
                  {TARIFFS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setBuy({ ...buy, type: t.id })}
                      className={`p-3 rounded-xl border text-left transition ${
                        buy.type === t.id
                          ? "bg-violet-500/15 border-violet-500/40"
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
                      <div className="text-[10px] text-white/30 mt-0.5">{t.sub}</div>
                    </button>
                  ))}
                </div>

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

                <button
                  onClick={() => setBuyStep(1)}
                  className="w-full py-3 rounded-full btn-primary text-white font-bold"
                >
                  Далее — выбор способа оплаты
                </button>
              </>
            )}

            {currentStep === 1 && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {METHODS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setBuy({ ...buy, method: m.id })}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        buy.method === m.id
                          ? "bg-violet-500/15 border-violet-500/40"
                          : "bg-white/[0.03] border-white/5 hover:bg-white/5"
                      }`}
                    >
                      <div className="text-xs font-bold">{m.title}</div>
                      <div className="text-[10px] text-white/40">{m.hint}</div>
                    </button>
                  ))}
                </div>

                <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3.5 flex items-center justify-between text-sm">
                  <span className="text-white/50">
                    {tariff.title} · {method.title}
                  </span>
                  <span className="font-bold">
                    {promo && <span className="line-through text-white/30 font-normal mr-2">{payWas}</span>}
                    {payNow}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setBuyStep(0)}
                    className="px-6 py-3 rounded-full bg-white/5 border border-white/10 text-white/60 text-sm font-bold"
                  >
                    Назад
                  </button>
                  <button
                    onClick={createOrder}
                    className="flex-1 py-3 rounded-full btn-primary text-white font-bold"
                  >
                    Оплатить {promo && <span className="line-through opacity-50 font-normal">{payWas}</span>}{" "}
                    {payNow}
                  </button>
                </div>
                <p className="text-[11px] text-center text-white/35 leading-relaxed -mt-1">
                  Оплачивая, ты соглашаешься с{" "}
                  <a href="/legal#refund" className="text-violet-400/80 hover:text-violet-300 underline">
                    условиями возврата
                  </a>
                  : после активации ключа возврат невозможен
                </p>
              </>
            )}

            {currentStep === 2 && order && (
              <>
                <div className="rounded-xl bg-white/[0.04] border border-white/10 p-4 space-y-2 text-sm">
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
                  {order.instructions?.payUrl && (
                    <a
                      href={order.instructions.payUrl}
                      target="_blank"
                      className="inline-block px-4 py-2 rounded-full btn-primary text-white text-xs font-bold"
                    >
                      Перейти к оплате
                    </a>
                  )}
                </div>

                {order.claimed && (
                  <div className="rounded-xl bg-violet-500/10 border border-violet-500/30 p-4 space-y-1.5">
                    <div className="text-sm font-bold text-violet-200 flex items-center gap-2">
                      <IconClock size={16} /> Заявка отправлена — жди подтверждения
                    </div>
                    <p className="text-xs text-white/50 leading-relaxed">
                      Чек у админа. Как только он подтвердит перевод, эта страница сама
                      переключится на «Готово» и покажет ключ. Обычно это до 30 минут.
                      Можно закрыть страницу — статус виден в списке «Мои заказы» ниже.
                    </p>
                  </div>
                )}

                {!order.claimed && order.instructions?.payUrl && (
                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-4 space-y-1.5">
                    <div className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                      <IconClock size={16} /> Автоматическая оплата
                    </div>
                    <p className="text-xs text-white/50 leading-relaxed">
                      Ничего отправлять не нужно: после оплаты по кнопке «Перейти к оплате»
                      ключ появится здесь автоматически в течение пары минут.
                      Не закрывай страницу или просто загляни позже в «Мои заказы».
                    </p>
                  </div>
                )}

                {!order.claimed && !order.instructions?.payUrl && (
                  <div className="rounded-xl bg-white/[0.04] border border-white/10 p-4 space-y-2.5">
                    <div className="text-xs font-bold text-white/70">
                      Чек об оплате — <span className="text-red-300">все поля обязательны</span>
                    </div>
                    <p className="text-[11px] text-white/40 leading-relaxed">
                      Без скриншота, ФИО и даты оплаты админ не сможет найти твой перевод и
                      заявка не уйдёт.
                    </p>
                    <div>
                      <div
                        onClick={() => fileRef.current?.click()}
                        className={`rounded-xl border-2 border-dashed transition p-4 text-center cursor-pointer overflow-hidden ${
                          fieldErrs.receipt
                            ? "border-red-500/60 bg-red-500/5"
                            : "border-white/10 hover:border-violet-500/40"
                        }`}
                      >
                        {receiptPreview ? (
                          <img src={receiptPreview} alt="Чек" className="max-h-48 mx-auto rounded-lg" />
                        ) : (
                          <div className="text-white/35 text-xs space-y-1 py-2">
                            <div className="text-2xl">📎</div>
                            <div>Нажми, чтобы прикрепить скриншот перевода *</div>
                            <div className="text-[10px] text-white/25">PNG, JPG — до 5 МБ</div>
                          </div>
                        )}
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            handleReceiptFile(e);
                            setFieldErrs((p) => ({ ...p, receipt: undefined }));
                          }}
                          hidden
                        />
                      </div>
                      {fieldErrs.receipt && <p className="text-[11px] text-red-300 mt-1 px-1">{fieldErrs.receipt}</p>}
                    </div>
                    <div>
                      <input
                        value={payerName}
                        onChange={(e) => {
                          setPayerName(e.target.value);
                          setFieldErrs((p) => ({ ...p, payer: undefined }));
                        }}
                        placeholder="ФИО плательщика *"
                        className={`w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border text-sm ${
                          fieldErrs.payer ? "border-red-500/60" : "border-white/10"
                        }`}
                      />
                      {fieldErrs.payer && <p className="text-[11px] text-red-300 mt-1 px-1">{fieldErrs.payer}</p>}
                    </div>
                    <div>
                      <input
                        type="datetime-local"
                        value={paymentTime}
                        onChange={(e) => {
                          setPaymentTime(e.target.value);
                          setFieldErrs((p) => ({ ...p, time: undefined }));
                        }}
                        className={`w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border text-sm [color-scheme:dark] ${
                          fieldErrs.time ? "border-red-500/60" : "border-white/10"
                        }`}
                      />
                      {fieldErrs.time
                        ? <p className="text-[11px] text-red-300 mt-1 px-1">{fieldErrs.time}</p>
                        : <p className="text-[10px] text-white/30 mt-1 px-1">Дата и время оплаты *</p>}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {!order.claimed && (
                    <button
                      onClick={() => setBuyStep(1)}
                      className="px-5 py-3 rounded-full bg-white/5 border border-white/10 text-white/60 text-sm font-bold"
                    >
                      Назад
                    </button>
                  )}
                  {!order.claimed && !order.instructions?.payUrl && (
                    <button
                      onClick={submitPaid}
                      disabled={submitting}
                      className="flex-1 min-w-[140px] py-3 rounded-full bg-white text-black font-bold disabled:opacity-50"
                    >
                      {submitting ? "Отправка…" : "Я оплатил"}
                    </button>
                  )}
                  <button
                    onClick={() => cancelOrder()}
                    className="px-5 py-3 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-red-300 hover:border-red-500/40 text-sm font-bold"
                  >
                    Отменить
                  </button>
                </div>
              </>
            )}

            {currentStep === 3 && order?.done && (
              <>
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-4 space-y-3">
                  <div className="text-emerald-400 font-bold flex items-center gap-2">
                    <IconCheck size={18} /> Оплата подтверждена!
                  </div>
                  <div>
                    <div className="text-[11px] text-white/40 mb-1">Твой ключ:</div>
                    <button
                      onClick={() => copy(order.key?.key)}
                      className="w-full font-mono text-sm font-bold tracking-wide px-3 py-2.5 rounded-xl bg-white/[0.05] border border-violet-500/30 hover:border-violet-400 text-violet-200 inline-flex items-center justify-center gap-2"
                      title="Скопировать"
                    >
                      {order.key?.key} <IconCopy size={14} />
                    </button>
                    {order.key?.expiresAt && (
                      <div className="text-[11px] text-white/40 mt-1.5">
                        Действует до {new Date(order.key.expiresAt).toLocaleString("ru-RU")}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/receipt/${order.payment.id}`}
                      className="px-4 py-2 rounded-full btn-primary text-white text-xs font-bold"
                    >
                      🧾 Открыть чек
                    </Link>
                    <a
                      href="/cabinet"
                      onClick={(e) => {
                        e.preventDefault();
                        resetBuy();
                      }}
                      className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/60 text-xs font-bold"
                    >
                      Купить ещё ключ
                    </a>
                  </div>
                </div>
                <p className="text-[11px] text-white/35">
                  Ключ также лежит в разделе «Мои ключи» ниже. Приятной игры!
                </p>
              </>
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
                        {p.status === "PAID" && (
                          <Link href={`/receipt/${p.id}`} title="Чек" className="text-white/30 hover:text-violet-300">
                            🧾
                          </Link>
                        )}
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
                      className="font-mono text-sm font-bold tracking-wide inline-flex items-center gap-2 hover:text-violet-300"
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
            <button
              onClick={claimFree}
              disabled={free?.taken}
              className="w-full py-3 rounded-full btn-primary text-white font-bold disabled:opacity-40"
            >
              Забрать фри-ключ (на 1 день)
            </button>
            <p className="text-xs text-white/30">
              Всего 1 ключ в день на весь сайт • проверка по IP и аккаунту
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
        className="font-mono text-xs text-right hover:text-violet-300 inline-flex items-center gap-1.5 min-w-0"
      >
        <span className="truncate">{value}</span>
        <IconCopy size={12} />
      </button>
    </div>
  );
}
