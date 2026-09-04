"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Receipt = {
  receiptNumber: string;
  signature: string;
  verifyUrl: string;
  orderId: string;
  label: string;
  product: string;
  methodTitle: string;
  amount: number;
  currency: string;
  promo: { code: string; discount: number; fullAmount: number } | null;
  status: string;
  paidAt: string | null;
  username: string | null;
  key: string | null;
  keyExpiresAt: string | null;
};

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/receipts/${id}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Ошибка загрузки");
        setReceipt(d.receipt);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <>
      <style>{`
        .rc-wrap{min-height:100vh;background:#0a0a14;color:#e8e6f0;font-family:ui-sans-serif,system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;padding:32px 16px;}
        .rc-actions{display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;justify-content:center;}
        .rc-btn{padding:10px 18px;border-radius:12px;border:1px solid rgba(139,92,246,.35);background:rgba(139,92,246,.12);color:#c4b5fd;font-weight:600;cursor:pointer;text-decoration:none;font-size:14px;transition:.15s;}
        .rc-btn:hover{background:rgba(139,92,246,.22);}
        .rc-btn.plain{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.1);color:#a5a3b8;}
        .rc-paper{width:100%;max-width:460px;background:#fff;color:#181825;border-radius:20px;padding:32px 28px;box-shadow:0 24px 80px rgba(0,0,0,.55);position:relative;overflow:hidden;}
        .rc-paper::before{content:"";position:absolute;top:0;left:0;right:0;height:6px;background:linear-gradient(90deg,#7c3aed,#3b82f6);}
        .rc-head{display:flex;align-items:center;gap:12px;margin-bottom:18px;}
        .rc-logo{width:44px;height:44px;border-radius:12px;object-fit:cover;}
        .rc-title{font-size:18px;font-weight:800;letter-spacing:.02em;}
        .rc-sub{font-size:12px;color:#6b7280;}
        .rc-num{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums;margin:6px 0 2px;}
        .rc-badge{display:inline-block;padding:4px 12px;border-radius:999px;background:#dcfce7;color:#15803d;font-size:12px;font-weight:700;margin-bottom:14px;}
        .rc-row{display:flex;justify-content:space-between;gap-12px;padding:9px 0;border-bottom:1px dashed #e5e7eb;font-size:14px;}
        .rc-row .k{color:#6b7280;}
        .rc-row .v{font-weight:600;text-align:right;word-break:break-all;}
        .rc-total{display:flex;justify-content:space-between;padding:14px 0 4px;font-size:17px;font-weight:800;}
        .rc-key{margin:14px 0;padding:12px;border-radius:12px;background:#f3f0ff;border:1px solid #ddd6fe;font-family:ui-monospace,monospace;font-size:13px;word-break:break-all;text-align:center;font-weight:700;color:#5b21b6;}
        .rc-verify{margin-top:14px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:11px;color:#6b7280;line-height:1.5;word-break:break-all;}
        .rc-sig{font-family:ui-monospace,monospace;font-weight:700;color:#374151;}
        .rc-state{margin-top:40vh;text-align:center;color:#a5a3b8;font-size:15px;}
        @media print{
          body{background:#fff!important;}
          .rc-wrap{background:#fff!important;padding:0;}
          .rc-actions{display:none!important;}
          .rc-paper{box-shadow:none;max-width:100%;border-radius:0;}
        }
      `}</style>
      <div className="rc-wrap">
        {loading && <div className="rc-state">Загружаю чек…</div>}
        {error && (
          <div className="rc-state">
            <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
            {error}
            <div style={{ marginTop: 16 }}>
              <Link href="/cabinet" className="rc-btn">← В кабинет</Link>
            </div>
          </div>
        )}
        {receipt && (
          <>
            <div className="rc-actions">
              <button className="rc-btn" onClick={() => window.print()}>🖨 Печать / PDF</button>
              <Link href="/cabinet" className="rc-btn plain">← В кабинет</Link>
            </div>
            <div className="rc-paper">
              <div className="rc-head">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/lobok.jpg" alt="Lobok" className="rc-logo" />
                <div>
                  <div className="rc-title">Lobok Client</div>
                  <div className="rc-sub">Электронный чек об оплате</div>
                </div>
              </div>
              <div className="rc-badge">✓ ОПЛАЧЕНО</div>
              <div className="rc-num">{receipt.receiptNumber}</div>
              <div className="rc-sub" style={{ marginBottom: 8 }}>заказ {receipt.label}</div>

              <div className="rc-row"><span className="k">Товар</span><span className="v">{receipt.product}</span></div>
              <div className="rc-row"><span className="k">Покупатель</span><span className="v">{receipt.username || "—"}</span></div>
              <div className="rc-row"><span className="k">Способ</span><span className="v">{receipt.methodTitle}</span></div>
              <div className="rc-row"><span className="k">Дата оплаты</span><span className="v">{fmtDate(receipt.paidAt)}</span></div>
              {receipt.promo && (
                <div className="rc-row">
                  <span className="k">Промокод {receipt.promo.code} (−{receipt.promo.discount}%)</span>
                  <span className="v" style={{ textDecoration: "line-through", color: "#9ca3af" }}>
                    {receipt.promo.fullAmount} {receipt.currency === "RUB" ? "₽" : "₴"}
                  </span>
                </div>
              )}
              {receipt.keyExpiresAt && (
                <div className="rc-row"><span className="k">Ключ действует до</span><span className="v">{fmtDate(receipt.keyExpiresAt)}</span></div>
              )}
              <div className="rc-total">
                <span>Итого</span>
                <span>{receipt.amount} {receipt.currency === "RUB" ? "₽" : "₴"}</span>
              </div>

              {receipt.key && <div className="rc-key">{receipt.key}</div>}

              <div className="rc-verify">
                Проверка подлинности:<br />
                <span className="rc-sig">подпись {receipt.signature}</span><br />
                {receipt.verifyUrl}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
