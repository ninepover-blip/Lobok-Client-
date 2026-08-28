"use client";
import { useCallback, useEffect, useState } from "react";
import {
  IconCard,
  IconCheck,
  IconKey,
  IconNews,
  IconPlay,
  IconServer,
  IconUser,
  RoleBadge,
  RoleName,
} from "@/components/Icons";

type Tab = "keys" | "news" | "users" | "payments" | "site";

export default function AdminPage() {
  const [me, setMe] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("keys");
  const [keys, setKeys] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [gen, setGen] = useState({ type: "D30", username: "", count: 1 });
  const [ver, setVer] = useState({ version: "", changelog: "", downloadUrl: "", forClient: false });
  const [site, setSite] = useState<Record<string, string>>({ guideVideoUrl: "" });
  const [newsForm, setNewsForm] = useState({ title: "", content: "", media: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  function flash(text: string, isError = false) {
    if (isError) { setErr(text); setMsg(""); } else { setMsg(text); setErr(""); }
    setTimeout(() => { setMsg(""); setErr(""); }, 6000);
  }

  const reload = useCallback(async () => {
    const [k, u, p, n, s] = await Promise.all([
      fetch("/api/keys").then((r) => r.json()).catch(() => ({})),
      fetch("/api/admin/users").then((r) => r.json()).catch(() => ({})),
      fetch("/api/payments?all=1").then((r) => r.json()).catch(() => ({})),
      fetch("/api/news").then((r) => r.json()).catch(() => ({})),
      fetch("/api/settings").then((r) => r.json()).catch(() => ({})),
    ]);
    setKeys(k.keys || []);
    setUsers(u.users || []);
    setPayments(p.payments || []);
    setNews(n.news || []);
    if (s.settings) setSite((prev) => ({ ...prev, ...s.settings }));
  }, []);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      setMe(d.user);
      if (d.user?.role !== "ADMIN") location.href = "/";
    });
    reload();
  }, [reload]);

  async function generate() {
    setBusy(true);
    try {
      const r = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gen),
      });
      const d = await r.json();
      if (!r.ok) return flash(d.error || "Ошибка генерации", true);
      flash(`Создано ключей: ${d.keys.length}`);
      reload();
    } finally { setBusy(false); }
  }

  async function keyAction(id: string, action: string, extra: any = {}) {
    const r = await fetch(`/api/keys/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const d = await r.json();
    if (!r.ok) flash(d.error || "Ошибка", true);
    else reload();
  }

  async function setRole(uid: string, role: string) {
    const r = await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: uid, role }),
    });
    const d = await r.json();
    if (!r.ok) flash(d.error || "Ошибка", true);
    else { flash("Роль обновлена"); reload(); }
  }

  /** Публикация новости — с нормальным разбором ответа вместо alert. */
  async function publishNews(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (!newsForm.title.trim() || !newsForm.content.trim()) {
        return flash("Заполни заголовок и текст", true);
      }
      const r = await fetch("/api/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newsForm.title.trim(),
          content: newsForm.content.trim(),
          mediaUrls: newsForm.media.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return flash(d.error || `Ошибка ${r.status}`, true);
      flash("Новость опубликована");
      setNewsForm({ title: "", content: "", media: "" });
      reload();
    } catch (e: any) {
      flash(e?.message || "Сетевая ошибка", true);
    } finally { setBusy(false); }
  }

  async function delNews(id: string) {
    if (!confirm("Удалить новость?")) return;
    const r = await fetch(`/api/news/${id}`, { method: "DELETE" });
    if (r.ok) { flash("Удалено"); reload(); }
    else flash((await r.json()).error || "Ошибка", true);
  }

  async function pushVersion() {
    const r = await fetch("/api/launcher/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ver),
    });
    const d = await r.json();
    if (!r.ok) flash(d.error || "Ошибка", true);
    else flash("Версия сохранена");
  }

  async function saveSite() {
    const r = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(site),
    });
    const d = await r.json();
    if (!r.ok) flash(d.error || "Ошибка", true);
    else flash("Настройки сохранены");
  }

  async function confirmPayment(id: string) {
    const r = await fetch(`/api/payments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm" }),
    });
    const d = await r.json();
    if (!r.ok) return flash(d.error || "Ошибка", true);
    flash(`Ключ выдан: ${d.key?.key}`);
    reload();
  }

  const filtered = keys.filter(
    (k) =>
      !filter ||
      k.key.toLowerCase().includes(filter.toLowerCase()) ||
      (k.ownerUsername || "").toLowerCase().includes(filter.toLowerCase()),
  );
  const pendingPays = payments.filter((p) => p.status === "PENDING").length;

  const TABS: Array<{ id: Tab; title: string; icon: React.ReactNode; badge?: number }> = [
    { id: "keys", title: "Ключи", icon: <IconKey size={16} /> },
    { id: "news", title: "Новости", icon: <IconNews size={16} /> },
    { id: "users", title: "Пользователи", icon: <IconUser size={16} /> },
    { id: "payments", title: "Платежи", icon: <IconCard size={16} />, badge: pendingPays },
    { id: "site", title: "Сайт", icon: <IconServer size={16} /> },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
      <h1 className="text-2xl font-black">
        Админ панель <span className="gradient-text">Lobok</span>
      </h1>

      {(msg || err) && (
        <div
          className={`p-3 rounded-xl text-sm ${
            err ? "bg-red-500/15 text-red-200 border border-red-500/20" : "bg-emerald-500/15 text-emerald-200"
          }`}
        >
          {err || msg}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition ${
              tab === t.id ? "btn-primary text-white" : "bg-white/5 hover:bg-white/10 text-white/70"
            }`}
          >
            {t.icon} {t.title}
            {!!t.badge && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-bold">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* КЛЮЧИ */}
      {tab === "keys" && (
        <div className="space-y-4">
          <div className="rounded-[22px] glass p-5 space-y-3">
            <h3 className="font-bold">Генерация ключей</h3>
            <div className="grid sm:grid-cols-4 gap-2">
              <select
                value={gen.type}
                onChange={(e) => setGen({ ...gen, type: e.target.value })}
                className="px-3 py-2 rounded-xl bg-[#1a1a2e] border border-white/10 text-sm"
              >
                <option value="D30">30д — 100₽/50₴</option>
                <option value="D90">90д — 250₽/125₴</option>
                <option value="FOREVER">Навсегда — 400₽/200₴</option>
                <option value="D1">Фри — 1 день</option>
              </select>
              <input
                value={gen.username}
                onChange={(e) => setGen({ ...gen, username: e.target.value })}
                placeholder="@username (пусто = свободный)"
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm"
              />
              <input
                type="number"
                min={1}
                max={50}
                value={gen.count}
                onChange={(e) => setGen({ ...gen, count: parseInt(e.target.value) || 1 })}
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10"
              />
              <button
                onClick={generate}
                disabled={busy}
                className="py-2.5 rounded-full btn-primary text-white font-bold disabled:opacity-50"
              >
                Сгенерировать
              </button>
            </div>
          </div>

          <div className="rounded-[22px] glass p-5">
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <h3 className="font-bold">Все ключи ({keys.length})</h3>
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Поиск по ключу / @user"
                className="px-3 py-2 rounded-full bg-white/5 border border-white/10 text-sm w-64"
              />
            </div>
            <div className="mt-4 space-y-2 max-h-[500px] overflow-y-auto">
              {filtered.map((k) => (
                <div
                  key={k.id}
                  className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col lg:flex-row lg:items-center gap-2 justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-sm font-bold truncate">{k.key}</div>
                    <div className="text-xs text-white/40">
                      {k.type} • {k.status} • @{k.ownerUsername || "—"} • HWID:{k.hwid || "—"} •{" "}
                      {k.expiresAt ? new Date(k.expiresAt).toLocaleDateString("ru-RU") : "∞"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button onClick={() => keyAction(k.id, "revoke")} className="px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 text-xs">Revoke</button>
                    <button onClick={() => keyAction(k.id, "unrevoke")} className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs">Unrevoke</button>
                    <button onClick={() => keyAction(k.id, "regenerate")} className="px-2.5 py-1 rounded-full bg-white/10 text-xs">Regen</button>
                    <button
                      onClick={() => {
                        const u = prompt("Новый @username (пусто чтобы отвязать)", k.ownerUsername || "");
                        if (u !== null) keyAction(k.id, "bind", { username: u || null });
                      }}
                      className="px-2.5 py-1 rounded-full bg-violet-500/20 text-violet-300 text-xs"
                    >
                      Bind
                    </button>
                    <button onClick={() => keyAction(k.id, "unbind")} className="px-2.5 py-1 rounded-full bg-white/5 text-xs">Unbind</button>
                    <button
                      onClick={() => {
                        if (confirm("Удалить ключ?")) fetch(`/api/keys/${k.id}`, { method: "DELETE" }).then(reload);
                      }}
                      className="px-2.5 py-1 rounded-full bg-black text-red-400 text-xs border border-red-500/20"
                    >
                      Del
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* НОВОСТИ */}
      {tab === "news" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-[22px] glass p-5 space-y-3">
            <h3 className="font-bold flex items-center gap-2"><IconNews size={18} /> Новая публикация</h3>
            <form onSubmit={publishNews} className="space-y-2">
              <input
                value={newsForm.title}
                onChange={(e) => setNewsForm({ ...newsForm, title: e.target.value })}
                placeholder="Заголовок"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm"
              />
              <textarea
                value={newsForm.content}
                onChange={(e) => setNewsForm({ ...newsForm, content: e.target.value })}
                placeholder="Текст новости..."
                rows={5}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm"
              />
              <input
                value={newsForm.media}
                onChange={(e) => setNewsForm({ ...newsForm, media: e.target.value })}
                placeholder="Ссылки на фото/видео через запятую"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm"
              />
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 rounded-full btn-primary text-white font-bold disabled:opacity-50"
              >
                {busy ? "Публикуем..." : "Опубликовать"}
              </button>
            </form>
            <p className="text-xs text-white/30">
              Поддерживаются прямые ссылки на .jpg/.png и .mp4/.webm
            </p>
          </div>

          <div className="rounded-[22px] glass p-5">
            <h3 className="font-bold">Опубликовано ({news.length})</h3>
            <div className="mt-3 space-y-2 max-h-[500px] overflow-y-auto">
              {news.length === 0 && <div className="text-sm text-white/30">Новостей пока нет</div>}
              {news.map((n) => (
                <div key={n.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{n.title}</div>
                      <div className="text-xs text-white/40">
                        {n.author?.username} • {new Date(n.createdAt).toLocaleString("ru-RU")}
                      </div>
                    </div>
                    <button
                      onClick={() => delNews(n.id)}
                      className="px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 text-xs shrink-0"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ПОЛЬЗОВАТЕЛИ */}
      {tab === "users" && (
        <div className="rounded-[22px] glass p-5">
          <h3 className="font-bold">Пользователи ({users.length})</h3>
          <p className="text-xs text-white/40">Назначение ролей — только админы</p>
          <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[500px] overflow-y-auto">
            {users.map((u) => (
              <div key={u.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-3">
                <img src={u.avatarUrl || "/lobok.jpg"} className="w-9 h-9 rounded-full object-cover" alt="" />
                <div className="flex-1 min-w-0">
                  <RoleName username={u.username} role={u.role} size={13} />
                  <div className="text-xs text-white/40 flex items-center gap-1.5 mt-0.5">
                    <RoleBadge role={u.role} />
                    {u.isBanned && <span className="text-red-400">BAN</span>}
                    {u.isMuted && <span className="text-amber-400">MUTE</span>}
                  </div>
                </div>
                <select
                  value={u.role}
                  onChange={(e) => setRole(u.id, e.target.value)}
                  className="text-xs px-2 py-1 rounded-full bg-[#1a1a2e] border border-white/10"
                >
                  <option value="USER">USER</option>
                  <option value="MODERATOR">MODERATOR</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ПЛАТЕЖИ */}
      {tab === "payments" && (
        <div className="rounded-[22px] glass p-5">
          <h3 className="font-bold flex items-center gap-2"><IconCard size={18} /> Платежи ({payments.length})</h3>
          <p className="text-xs text-white/40">
            ЮMoney подтверждается автоматически. Переводы на карту/IBAN — кнопкой «Выдать ключ».
          </p>
          <div className="mt-3 space-y-2 max-h-[600px] overflow-y-auto">
            {payments.length === 0 && <div className="text-sm text-white/30">Заказов пока нет</div>}
            {payments.map((p) => (
              <div
                key={p.id}
                className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex flex-wrap items-center gap-3 justify-between"
              >
                <div className="min-w-0">
                  <div className="font-mono text-sm font-bold">{p.label}</div>
                  <div className="text-xs text-white/40">
                    {p.user?.username || "—"} • {p.keyType} • {p.method} • {p.amountRub}₽/{p.amountUah}₴ •{" "}
                    {new Date(p.createdAt).toLocaleString("ru-RU")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                      p.status === "PAID"
                        ? "bg-emerald-500 text-black"
                        : p.status === "CANCELLED"
                          ? "bg-red-500/20 text-red-300"
                          : "bg-amber-500/20 text-amber-300"
                    }`}
                  >
                    {p.status}
                  </span>
                  {p.status === "PENDING" && (
                    <button
                      onClick={() => confirmPayment(p.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full btn-primary text-white text-xs font-bold"
                    >
                      <IconCheck size={13} /> Выдать ключ
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* САЙТ */}
      {tab === "site" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-[22px] glass p-5 space-y-3">
            <h3 className="font-bold flex items-center gap-2"><IconPlay size={18} /> Видеоинструкция</h3>
            <p className="text-xs text-white/40">
              Ссылка на YouTube — ролик появится на главной в блоке «Видеоинструкция».
            </p>
            <input
              value={site.guideVideoUrl || ""}
              onChange={(e) => setSite({ ...site, guideVideoUrl: e.target.value })}
              placeholder="https://youtu.be/..."
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm"
            />
            <button onClick={saveSite} className="w-full py-2.5 rounded-full btn-primary text-white font-bold">
              Сохранить
            </button>
          </div>

          <div className="rounded-[22px] glass p-5 space-y-3">
            <h3 className="font-bold">Лаунчер / Клиент</h3>
            <input
              value={ver.version}
              onChange={(e) => setVer({ ...ver, version: e.target.value })}
              placeholder="Версия напр. 1.0.3"
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm"
            />
            <input
              value={ver.downloadUrl}
              onChange={(e) => setVer({ ...ver, downloadUrl: e.target.value })}
              placeholder="Ссылка скачивания"
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm"
            />
            <input
              value={ver.changelog}
              onChange={(e) => setVer({ ...ver, changelog: e.target.value })}
              placeholder="Changelog"
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ver.forClient}
                onChange={(e) => setVer({ ...ver, forClient: e.target.checked })}
              />{" "}
              Это клиент (внутри лаунчера)
            </label>
            <button onClick={pushVersion} className="w-full py-2.5 rounded-full btn-ghost font-bold">
              Сохранить версию
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
