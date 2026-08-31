"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Me = { id: string; username: string; role: string };

const TARIFFS = [
  { id: "D30", title: "30 дней", rub: 100, uah: 50, badge: null },
  { id: "D90", title: "90 дней", rub: 250, uah: 125, badge: "Популярный" },
  { id: "FOREVER", title: "Навсегда", rub: 400, uah: 200, badge: "Выгодно" },
] as const;

const METHODS = [
  { id: "YOOMONEY", title: "ЮMoney", icon: "💳", auto: true },
  { id: "CARD_RU", title: "Карта МИР", icon: "💳", auto: false },
  { id: "MONO_UA", title: "Monobank", icon: "💳", auto: false },
  { id: "IBAN_UA", title: "IBAN", icon: "🏦", auto: false },
] as const;

const STEPS = ["Тариф", "Оплата", "Чек"];

export default function BuyPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [step, setStep] = useState(0);
  const [tariff, setTariff] = useState<string>("D30");
  const [method, setMethod] = useState<string>("YOOMONEY");
  const [promoCode, setPromoCode] = useState("");
  const [promo, setPromo] = useState<any>(null);
  const [promoErr, setPromoErr] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string>("");
  const [payerName, setPayerName] = useState("");
  const [paymentTime, setPaymentTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) { router.push("/auth/login"); return; }
        setMe(d.user);
        setLoading(false);
      })
      .catch(() => { router.push("/auth/login"); });
  }, [router]);

  const checkPromo = useCallback(async () => {
    if (!promoCode.trim()) return;
    setPromoBusy(true);
    setPromoErr("");
    try {
      const r = await fetch("/api/promo/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode }),
      });
      const d = await r.json();
      if (d.ok) setPromo(d);
      else { setPromo(null); setPromoErr(d.error || "Промокод не действителен"); }
    } catch {
      setPromoErr("Ошибка проверки");
    } finally { setPromoBusy(false); }
  }, [promoCode]);

  const createOrder = useCallback(async () => {
    setErr("");
    try {
      const r = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyType: tariff, method, promoCode: promoCode || undefined }),
      });
      const d = await r.json();
      if (!d.ok) { setErr(d.error || "Ошибка"); return; }
      setOrder(d);
      setStep(2);
    } catch { setErr("Ошибка сети"); }
  }, [tariff, method, promoCode]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setErr("Файл слишком большой (макс 5 МБ)"); return; }
    setReceiptFile(f);
    const reader = new FileReader();
    reader.onload = () => setReceiptPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const submitReceipt = useCallback(async () => {
    if (!order?.payment?.id) return;

    // Валидация
    if (!payerName.trim()) {
      setErr("Введите ФИО плательщика");
      return;
    }
    if (payerName.trim().length < 5) {
      setErr("ФИО слишком короткое (минимум 5 символов)");
      return;
    }
    if (!receiptPreview) {
      setErr("Загрузите скриншот чека об оплате");
      return;
    }
    if (!paymentTime) {
      setErr("Укажите дату и время оплаты");
      return;
    }

    setSubmitting(true);
    setErr("");
    try {
      const r = await fetch("/api/orders/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: order.payment.id,
          receiptData: receiptPreview || null,
          payerName: payerName || null,
          paymentTime: paymentTime || null,
        }),
      });
      const d = await r.json();
      if (d.ok) setDone(true);
      else setErr(d.error || "Ошибка отправки");
    } catch { setErr("Ошибка сети"); }
    finally { setSubmitting(false); }
  }, [order, receiptPreview, payerName, paymentTime]);

  if (loading) return <div style={styles.page}><div style={styles.loading}>Загрузка...</div></div>;
  if (!me) return null;

  const t = TARIFFS.find((x) => x.id === tariff)!;
  const finalRub = promo ? Math.round(t.rub * (1 - promo.discount / 100)) : t.rub;
  const finalUah = promo ? Math.round(t.uah * (1 - promo.discount / 100)) : t.uah;

  if (done) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.doneIcon}>✓</div>
          <h2 style={styles.doneTitle}>Чек отправлен!</h2>
          <p style={styles.doneText}>Мы проверим оплату и выдадим ключ в кабинете.</p>
          <Link href="/cabinet" style={styles.btnPrimary}>В кабинет</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Покупка ключа</h1>

        {/* Steps indicator */}
        <div style={styles.stepsRow}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ ...styles.stepItem, opacity: i <= step ? 1 : 0.4 }}>
              <div style={{ ...styles.stepDot, background: i < step ? "#e0e0e0" : i === step ? "#cccccc" : "#333" }}>{i < step ? "✓" : i + 1}</div>
              <span style={styles.stepLabel}>{s}</span>
              {i < STEPS.length - 1 && <div style={{ ...styles.stepLine, background: i < step ? "#e0e0e0" : "#333" }} />}
            </div>
          ))}
        </div>

        {err && <div style={styles.error}>{err}</div>}

        {/* Step 0: Tariff */}
        {step === 0 && (
          <>
            <div style={styles.tariffGrid}>
              {TARIFFS.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setTariff(t.id)}
                  style={{
                    ...styles.tariffCard,
                    borderColor: tariff === t.id ? "#e0e0e0" : "#222",
                    background: tariff === t.id ? "rgba(139,92,246,0.1)" : "#1a1a22",
                  }}
                >
                  {t.badge && <div style={styles.badge}>{t.badge}</div>}
                  <div style={styles.tariffTitle}>{t.title}</div>
                  <div style={styles.tariffPrice}>{t.rub} ₽ / {t.uah} ₴</div>
                  {t.id === "D30" && <div style={styles.tariffSub}>≈ {Math.round(t.rub / 30)} ₽/день</div>}
                  {t.id === "D90" && <div style={styles.tariffSub}>≈ {Math.round(t.rub / 90)} ₽/день</div>}
                  {t.id === "FOREVER" && <div style={styles.tariffSub}>без ограничений</div>}
                </div>
              ))}
            </div>
            <div style={styles.promoRow}>
              <input
                style={styles.input}
                placeholder="Промокод"
                value={promoCode}
                onChange={(e) => { setPromoCode(e.target.value); setPromo(null); setPromoErr(""); }}
                onKeyDown={(e) => e.key === "Enter" && checkPromo()}
              />
              <button onClick={checkPromo} disabled={promoBusy} style={styles.btnSmall}>
                {promoBusy ? "..." : "Применить"}
              </button>
            </div>
            {promo && <div style={styles.promoOk}>Скидка {promo.discount}% — итого {finalRub} ₽ / {finalUah} ₴</div>}
            {promoErr && <div style={styles.promoErr}>{promoErr}</div>}
            <button onClick={() => setStep(1)} style={styles.btnPrimary}>Далее</button>
          </>
        )}

        {/* Step 1: Method */}
        {step === 1 && (
          <>
            <div style={styles.methodGrid}>
              {METHODS.map((m) => (
                <div
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  style={{
                    ...styles.methodCard,
                    borderColor: method === m.id ? "#e0e0e0" : "#222",
                    background: method === m.id ? "rgba(139,92,246,0.1)" : "#1a1a22",
                  }}
                >
                  <span style={styles.methodIcon}>{m.icon}</span>
                  <span>{m.title}</span>
                  {m.auto && <span style={styles.autoTag}>авто</span>}
                </div>
              ))}
            </div>
            <div style={styles.row}>
              <button onClick={() => setStep(0)} style={styles.btnBack}>Назад</button>
              <button onClick={createOrder} style={styles.btnPrimary}>Оплатить {finalRub} ₽</button>
            </div>
          </>
        )}

        {/* Step 2: Receipt */}
        {step === 2 && order && (
          <>
            <div style={styles.receiptSection}>
              <h3 style={styles.sectionTitle}>Реквизиты для оплаты</h3>
              {order.payment?.createdAt && (
                <div style={styles.receiptInfo}>
                  <div style={styles.receiptLabel}>Дата заказа:</div>
                  <div style={styles.receiptValue}>{new Date(order.payment.createdAt).toLocaleString("ru-RU")}</div>
                </div>
              )}
              {order.instructions?.payUrl && (
                <a href={order.instructions.payUrl} target="_blank" rel="noopener" style={styles.payLink}>
                  Перейти к оплате →
                </a>
              )}
              {order.instructions?.card && (
                <div style={styles.receiptInfo}>
                  <div style={styles.receiptLabel}>Карта:</div>
                  <div style={styles.receiptValue}>{order.instructions.card}</div>
                </div>
              )}
              {order.instructions?.amount && (
                <div style={styles.receiptInfo}>
                  <div style={styles.receiptLabel}>Сумма:</div>
                  <div style={styles.receiptValue}>{order.instructions.amount}</div>
                </div>
              )}
              {order.instructions?.iban && (
                <>
                  <div style={styles.receiptInfo}>
                    <div style={styles.receiptLabel}>IBAN:</div>
                    <div style={styles.receiptValue}>{order.instructions.iban}</div>
                  </div>
                  <div style={styles.receiptInfo}>
                    <div style={styles.receiptLabel}>Получатель:</div>
                    <div style={styles.receiptValue}>{order.instructions.recipient}</div>
                  </div>
                </>
              )}
              {order.instructions?.label && (
                <div style={styles.receiptInfo}>
                  <div style={styles.receiptLabel}>Метка:</div>
                  <div style={{ ...styles.receiptValue, color: "#e0e0e0", fontWeight: 700 }}>{order.instructions.label}</div>
                </div>
              )}
              {order.instructions?.note && (
                <div style={styles.receiptNote}>{order.instructions.note}</div>
              )}
            </div>

            <div style={styles.receiptSection}>
              <h3 style={styles.sectionTitle}>Загрузить чек <span style={{color: '#ef4444'}}>*</span></h3>
              <div style={styles.uploadArea} onClick={() => fileRef.current?.click()}>
                {receiptPreview ? (
                  <img src={receiptPreview} alt="Чек" style={styles.receiptImg} />
                ) : (
                  <div style={styles.uploadPlaceholder}>
                    <div style={styles.uploadIcon}>📎</div>
                    <div>Нажмите или перетащите файл</div>
                    <div style={styles.uploadHint}>PNG, JPG до 5 МБ</div>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} hidden />
              </div>
              <input
                style={styles.input}
                placeholder="ФИО плательщика *"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
              />
              <input
                style={styles.input}
                type="datetime-local"
                value={paymentTime}
                onChange={(e) => setPaymentTime(e.target.value)}
              />
            </div>

            <div style={styles.row}>
              <button onClick={() => setStep(1)} style={styles.btnBack}>Назад</button>
              <button onClick={submitReceipt} disabled={submitting} style={styles.btnPrimary}>
                {submitting ? "Отправка..." : "Отправить чек"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0d0d14",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: "60px 20px",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    color: "#ccc",
  },
  card: {
    width: "100%",
    maxWidth: 640,
    background: "#14141e",
    border: "1px solid #222",
    borderRadius: 16,
    padding: "40px 36px",
  },
  loading: {
    color: "#666",
    fontSize: 16,
    textAlign: "center" as const,
    padding: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: "#eee",
    margin: "0 0 28px",
  },
  stepsRow: {
    display: "flex",
    alignItems: "center",
    gap: 0,
    marginBottom: 32,
  },
  stepItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
    color: "#fff",
    flexShrink: 0,
  },
  stepLabel: {
    fontSize: 13,
    color: "#aaa",
    whiteSpace: "nowrap" as const,
  },
  stepLine: {
    width: 40,
    height: 2,
    margin: "0 8px",
    borderRadius: 1,
  },
  error: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid #ef4444",
    borderRadius: 8,
    padding: "10px 16px",
    marginBottom: 16,
    color: "#ef4444",
    fontSize: 13,
  },
  tariffGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
    marginBottom: 20,
  },
  tariffCard: {
    border: "2px solid #222",
    borderRadius: 12,
    padding: "20px 12px",
    cursor: "pointer",
    textAlign: "center" as const,
    transition: "all 0.2s",
    position: "relative" as const,
  },
  badge: {
    position: "absolute" as const,
    top: -10,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#e0e0e0",
    color: "#fff",
    fontSize: 10,
    fontWeight: 700,
    padding: "2px 10px",
    borderRadius: 10,
    textTransform: "uppercase" as const,
  },
  tariffTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#eee",
    marginBottom: 8,
  },
  tariffPrice: {
    fontSize: 20,
    fontWeight: 800,
    color: "#cccccc",
    marginBottom: 4,
  },
  tariffSub: {
    fontSize: 12,
    color: "#666",
  },
  promoRow: {
    display: "flex",
    gap: 8,
    marginBottom: 12,
  },
  promoOk: {
    color: "#4ade80",
    fontSize: 13,
    marginBottom: 12,
  },
  promoErr: {
    color: "#ef4444",
    fontSize: 13,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    background: "#1a1a22",
    border: "1px solid #333",
    borderRadius: 8,
    padding: "10px 14px",
    color: "#eee",
    fontSize: 14,
    outline: "none",
    marginBottom: 10,
  },
  btnPrimary: {
    width: "100%",
    background: "#e0e0e0",
    color: "#0a0a0a",
    border: "none",
    borderRadius: 10,
    padding: "12px 24px",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
  btnSmall: {
    background: "#e0e0e0",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "10px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
  btnBack: {
    background: "transparent",
    color: "#888",
    border: "1px solid #333",
    borderRadius: 10,
    padding: "12px 24px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  methodGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 10,
    marginBottom: 24,
  },
  methodCard: {
    border: "2px solid #222",
    borderRadius: 10,
    padding: "14px 16px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 14,
    color: "#ccc",
    transition: "all 0.2s",
  },
  methodIcon: { fontSize: 20 },
  autoTag: {
    marginLeft: "auto",
    background: "rgba(74,222,128,0.15)",
    color: "#4ade80",
    fontSize: 10,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 8,
  },
  row: {
    display: "flex",
    gap: 12,
    marginTop: 16,
  },
  receiptSection: {
    background: "#1a1a22",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#eee",
    margin: "0 0 14px",
  },
  receiptInfo: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 0",
    borderBottom: "1px solid #262630",
  },
  receiptLabel: {
    fontSize: 13,
    color: "#888",
  },
  receiptValue: {
    fontSize: 14,
    color: "#eee",
    fontFamily: "monospace",
  },
  receiptNote: {
    fontSize: 12,
    color: "#888",
    marginTop: 10,
    lineHeight: 1.5,
  },
  payLink: {
    display: "inline-block",
    background: "#e0e0e0",
    color: "#fff",
    textDecoration: "none",
    borderRadius: 8,
    padding: "10px 20px",
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 14,
  },
  uploadArea: {
    border: "2px dashed #333",
    borderRadius: 12,
    padding: 24,
    textAlign: "center" as const,
    cursor: "pointer",
    marginBottom: 12,
    overflow: "hidden",
  },
  uploadPlaceholder: {
    color: "#666",
    fontSize: 14,
  },
  uploadIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  uploadHint: {
    fontSize: 11,
    color: "#555",
    marginTop: 4,
  },
  receiptImg: {
    maxWidth: "100%",
    maxHeight: 200,
    borderRadius: 8,
  },
  doneIcon: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "rgba(74,222,128,0.15)",
    color: "#4ade80",
    fontSize: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 20px",
  },
  doneTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: "#eee",
    textAlign: "center" as const,
    margin: "0 0 10px",
  },
  doneText: {
    fontSize: 14,
    color: "#888",
    textAlign: "center" as const,
    marginBottom: 24,
  },
};
