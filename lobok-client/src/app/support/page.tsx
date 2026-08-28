"use client";
import { useCallback, useEffect, useState } from "react";
import { IconCheck, IconChat, IconClose, RoleName } from "@/components/Icons";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Открыт",
  PENDING: "В работе",
  CLOSED: "Закрыт",
};
const STATUS_CLASS: Record<string, string> = {
  OPEN: "bg-emerald-500/20 text-emerald-300",
  PENDING: "bg-amber-500/20 text-amber-300",
  CLOSED: "bg-white/10 text-white/50",
};

export default function SupportPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [me, setMe] = useState<any>(null);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<"ALL" | "OPEN" | "CLOSED">("ALL");

  const load = useCallback(async () => {
    const r = await fetch("/api/support/tickets");
    const d = await r.json();
    if (r.ok) setTickets(d.tickets || []);
  }, []);

  const openTicket = useCallback(async (id: string) => {
    const r = await fetch(`/api/support/tickets/${id}`);
    const d = await r.json();
    if (r.ok) setSelected(d.ticket);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setMe(d.user));
    load();
  }, [load]);

  // автообновление открытого тикета
  useEffect(() => {
    if (!selected?.id) return;
    const t = setInterval(() => openTicket(selected.id), 5000);
    return () => clearInterval(t);
  }, [selected?.id, openTicket]);

  async function create() {
    setErr("");
    if (!title.trim() || !desc.trim()) return setErr("Заполни тему и описание");
    const r = await fetch("/api/support/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description: desc }),
    });
    const d = await r.json();
    if (!r.ok) return setErr(d.error || "Не удалось создать тикет");
    setTitle("");
    setDesc("");
    load();
    if (d.ticket?.id) openTicket(d.ticket.id);
  }

  async function send() {
    if (!selected || !msg.trim()) return;
    const r = await fetch(`/api/support/tickets/${selected.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: msg }),
    });
    if (r.ok) {
      setMsg("");
      openTicket(selected.id);
      load();
    } else {
      setErr((await r.json()).error || "Ошибка отправки");
    }
  }

  /** Закрытие / переоткрытие тикета. */
  async function setStatus(status: "OPEN" | "PENDING" | "CLOSED") {
    if (!selected) return;
    if (status === "CLOSED" && !confirm("Закрыть тикет?")) return;
    const r = await fetch(`/api/support/tickets/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const d = await r.json();
    if (!r.ok) return setErr(d.error || "Не удалось изменить статус");
    setSelected((s: any) => ({ ...s, status }));
    load();
  }

  const isMod = me?.role === "ADMIN" || me?.role === "MODERATOR";
  const isAuthor = selected && me && selected.authorId === me.id;
  const canClose = (isMod || isAuthor) && selected?.status !== "CLOSED";
  const canReopen = isMod && selected?.status === "CLOSED";

  const shown = tickets.filter((t) =>
    filter === "ALL" ? true : filter === "OPEN" ? t.status !== "CLOSED" : t.status === "CLOSED",
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-[360px_1fr] gap-4">
      <div className="space-y-4">
        <div className="rounded-[22px] glass p-5 space-y-3">
          <h2 className="font-bold flex items-center gap-2">
            <IconChat size={18} /> Новый тикет
          </h2>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Тема (напр. не работает ключ)"
            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm"
          />
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Опиши проблему..."
            rows={3}
            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm"
          />
          <button
            onClick={create}
            className="w-full py-2.5 rounded-full btn-primary text-white font-bold text-sm"
          >
            Создать
          </button>
          <p className="text-xs text-white/30">Видят только ты и саппорт</p>
        </div>

        <div className="rounded-[22px] glass p-3 space-y-2 max-h-[60vh] overflow-y-auto">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-bold text-sm">Тикеты</h3>
            <div className="flex gap-1">
              {(["ALL", "OPEN", "CLOSED"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-[10px] px-2 py-1 rounded-full ${
                    filter === f ? "bg-violet-500/30 text-violet-200" : "bg-white/5 text-white/40"
                  }`}
                >
                  {f === "ALL" ? "Все" : f === "OPEN" ? "Активные" : "Закрытые"}
                </button>
              ))}
            </div>
          </div>
          {shown.map((t) => (
            <button
              key={t.id}
              onClick={() => openTicket(t.id)}
              className={`w-full text-left p-3 rounded-xl border transition ${
                selected?.id === t.id
                  ? "bg-violet-500/15 border-violet-500/30"
                  : "bg-white/[0.03] border-white/5 hover:bg-white/5"
              } ${t.status === "CLOSED" ? "opacity-60" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold truncate">{t.title}</div>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_CLASS[t.status]}`}
                >
                  {STATUS_LABEL[t.status]}
                </span>
              </div>
              <div className="text-xs text-white/40 mt-0.5">
                {t.author.username} • {new Date(t.createdAt).toLocaleDateString("ru-RU")}
              </div>
            </button>
          ))}
          {shown.length === 0 && (
            <div className="text-xs text-white/30 p-4 text-center">Тикетов нет</div>
          )}
        </div>
      </div>

      <div className="rounded-[22px] glass p-4 flex flex-col min-h-[500px]">
        {err && (
          <div className="mb-2 text-sm text-red-300 bg-red-500/10 border border-red-500/20 p-2 rounded-xl">
            {err}
          </div>
        )}
        {!selected ? (
          <div className="flex-1 grid place-items-center text-white/30 text-sm">Выбери тикет слева</div>
        ) : (
          <>
            <div className="pb-3 border-b border-white/5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-bold flex items-center gap-2">
                  {selected.title}
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_CLASS[selected.status]}`}
                  >
                    {STATUS_LABEL[selected.status]}
                  </span>
                </h2>
                <p className="text-sm text-white/60 mt-1">{selected.description}</p>
                <p className="text-xs text-white/30 mt-1">
                  Автор: <RoleName username={selected.author.username} role={selected.author.role} size={12} />
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                {canClose && (
                  <button
                    onClick={() => setStatus("CLOSED")}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/10 hover:bg-white/15 text-xs font-bold"
                  >
                    <IconClose size={14} /> Закрыть тикет
                  </button>
                )}
                {canReopen && (
                  <button
                    onClick={() => setStatus("OPEN")}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold"
                  >
                    <IconCheck size={14} /> Переоткрыть
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 py-3 space-y-2 overflow-y-auto">
              {selected.messages?.map((m: any) => (
                <div
                  key={m.id}
                  className={`p-3 rounded-xl max-w-[85%] ${
                    m.isPinned
                      ? "bg-violet-500/10 border border-violet-500/20 ml-auto"
                      : "bg-white/[0.04] border border-white/5"
                  }`}
                >
                  <div className="text-xs font-bold flex gap-2 items-center">
                    <RoleName username={m.user.username} role={m.user.role} size={12} />
                    <span className="text-white/30 ml-auto">
                      {new Date(m.createdAt).toLocaleTimeString("ru-RU", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="text-sm mt-1 whitespace-pre-wrap">{m.content}</div>
                </div>
              ))}
              {selected.messages?.length === 0 && (
                <div className="text-xs text-white/30 text-center py-6">
                  Сообщений пока нет — напиши первым.
                </div>
              )}
            </div>

            {selected.status === "CLOSED" ? (
              <div className="pt-3 border-t border-white/5 text-center text-xs text-white/40">
                Тикет закрыт.{" "}
                {isMod ? "Можешь переоткрыть его кнопкой выше." : "Создай новый, если проблема осталась."}
              </div>
            ) : (
              <div className="flex gap-2 pt-3 border-t border-white/5">
                <input
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Ответ..."
                  className="flex-1 px-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-sm"
                />
                <button
                  onClick={send}
                  className="px-6 py-2.5 rounded-full btn-primary text-white text-sm font-bold"
                >
                  Отправить
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
