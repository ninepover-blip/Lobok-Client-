"use client";
import { useEffect, useState } from "react";
import { IconChart, IconClock, IconDownload, IconKey, IconServer } from "@/components/Icons";

function playtime(min: number) {
  const h = Math.floor(min / 60);
  return h > 0 ? `${h} ч` : `${min} мин`;
}

export default function StatsPage() {
  const [stats, setStats] = useState<any>(null);
  const [servers, setServers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/stats").then((r) => r.json()),
      fetch("/api/stats/server?limit=20").then((r) => r.json()),
    ])
      .then(([s, sv]) => {
        setStats(s);
        setServers(sv.servers || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { icon: <IconDownload size={16} />, t: "Скачиваний", v: stats?.downloads },
    { icon: <IconServer size={16} />, t: "Серверов", v: stats?.servers },
    { icon: <IconChart size={16} />, t: "Всего заходов", v: stats?.totalJoins },
    { icon: <IconKey size={16} />, t: "Активных ключей", v: stats?.activeKeys },
    { icon: <IconClock size={16} />, t: "Часов в игре", v: stats?.playHours },
  ];

  const max = Math.max(1, ...servers.map((s) => s.count));

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black">Статистика</h1>
        <p className="text-sm text-white/50">
          Живые данные: клиент сообщает сервер и время игры, сайт считает скачивания и ключи.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map((c) => (
          <div key={c.t} className="rounded-[22px] glass p-5">
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              {c.icon} {c.t}
            </div>
            <div className="text-2xl font-black mt-1.5">
              {loading ? "…" : (c.v ?? 0).toLocaleString("ru-RU")}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-[22px] glass p-6">
        <h3 className="font-bold flex items-center gap-2">
          <IconServer size={18} /> Топ серверов, где играют с Lobok
        </h3>
        <p className="text-xs text-white/40 mt-1">
          Учитывается автоматически при заходе на сервер с активным ключом.
        </p>

        <div className="mt-4 space-y-3">
          {loading && <div className="text-sm text-white/30">Загрузка…</div>}
          {!loading && servers.length === 0 && (
            <div className="text-sm text-white/30 py-6 text-center">
              Пока нет данных о серверах.
            </div>
          )}
          {servers.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3">
              <span className="w-6 text-xs text-white/30 font-bold shrink-0">#{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-sm">
                  <span className="truncate font-medium">{s.ip}</span>
                  <span className="text-white/40 text-xs shrink-0 ml-2">
                    {s.count} {s.count === 1 ? "заход" : "заходов"}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-white/30 to-white/10"
                    style={{ width: `${Math.round((s.count / max) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[22px] glass p-6">
        <h3 className="font-bold text-sm">Интеграция для лаунчера</h3>
        <p className="text-xs text-white/40 mt-1">
          Клиент отправляет заход и время игры — часы и топ серверов появятся в профиле игрока.
        </p>
        <pre className="mt-3 text-[11px] bg-black/40 border border-white/5 rounded-xl p-3 overflow-x-auto">
{`POST /api/stats/session
{ "key": "Lobok-XXXXXXXXXXXX-client",
  "serverIp": "metahvh.net",
  "action": "start" }

// далее раз в минуту:
{ "key": "...", "serverIp": "metahvh.net", "action": "ping", "minutes": 1 }

// при выходе:
{ "key": "...", "action": "stop" }`}
        </pre>
      </div>
    </div>
  );
}
