import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import {
  IconCalendar,
  IconChart,
  IconClock,
  IconDownload,
  IconKey,
  IconServer,
  IconTelegram,
  RoleBadge,
  VerifiedBadge,
} from "@/components/Icons";

export const dynamic = "force-dynamic";

function fmtDate(d?: Date | null) {
  return d ? new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" }) : "—";
}
function fmtDateTime(d?: Date | null) {
  return d ? new Date(d).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }) : "—";
}
function playtime(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} мин`;
  return `${h} ч ${m} мин`;
}
function daysWith(d: Date) {
  return Math.max(1, Math.ceil((Date.now() - new Date(d).getTime()) / 86400000));
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const user = await prisma.user.findUnique({ where: { username: decodeURIComponent(username) } });
  if (!user) notFound();

  const [keys, downloads, firstDownload, lastDownload, sessions, messages, topServersRaw] =
    await Promise.all([
      prisma.licenseKey.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "desc" } }),
      prisma.downloadStat.count({ where: { userId: user.id } }),
      prisma.downloadStat.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
      prisma.downloadStat.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
      prisma.playSession.findMany({ where: { userId: user.id }, orderBy: { startedAt: "desc" }, take: 200 }),
      prisma.chatMessage.count({ where: { userId: user.id, isDeleted: false } }),
      prisma.playSession.groupBy({
        by: ["serverIp"],
        where: { userId: user.id, serverIp: { not: null } },
        _sum: { minutes: true },
        _count: { _all: true },
      }),
    ]);

  const topServers = topServersRaw
    .map((s) => ({ ip: s.serverIp as string, minutes: s._sum.minutes ?? 0, joins: s._count._all }))
    .sort((a, b) => b.minutes - a.minutes || b.joins - a.joins)
    .slice(0, 6);
  const maxMin = Math.max(1, ...topServers.map((s) => s.minutes));

  const activeKeys = keys.filter((k) => k.status === "ACTIVE").length;
  const lastSession = sessions[0];

  const stat = [
    { icon: <IconClock size={16} />, label: "Наиграно в клиенте", value: playtime(user.playtimeMinutes) },
    { icon: <IconCalendar size={16} />, label: "Зарегистрирован", value: fmtDate(user.createdAt) },
    { icon: <IconChart size={16} />, label: "Дней с нами", value: String(daysWith(user.createdAt)) },
    { icon: <IconDownload size={16} />, label: "Скачиваний", value: String(downloads) },
    { icon: <IconKey size={16} />, label: "Ключей (активных)", value: `${keys.length} (${activeKeys})` },
    { icon: <IconServer size={16} />, label: "Серверов посещено", value: String(topServers.length) },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
      {/* шапка */}
      <div className="rounded-[24px] glass p-6 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
        <div className="relative">
          <img
            src={user.avatarUrl || "/lobok.jpg"}
            className={`w-24 h-24 rounded-2xl object-cover border-2 ${
              user.role === "ADMIN"
                ? "border-white/40"
                : user.role === "MODERATOR"
                  ? "border-white/30"
                  : "border-white/10"
            }`}
            alt=""
          />
          {(user.role === "ADMIN" || user.role === "MODERATOR") && (
            <span className="absolute -bottom-1.5 -right-1.5 rounded-full bg-[#111111] p-0.5">
              <VerifiedBadge role={user.role} size={26} />
            </span>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-2xl font-bold ${
                user.role === "ADMIN"
                  ? "text-white/60 font-black"
                  : user.role === "MODERATOR"
                    ? "text-white/60"
                    : "text-zinc-300"
              }`}
            >
              {user.username}
            </span>
            <VerifiedBadge role={user.role} size={20} />
          </div>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <RoleBadge role={user.role} />
            {user.telegramUsername && (
              <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-white/10 text-white/60">
                <IconTelegram size={13} /> @{user.telegramUsername}
              </span>
            )}
            {user.isBanned && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-white/60 font-bold">
                Забанен
              </span>
            )}
            {user.isMuted && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-white/60 font-bold">
                Мут
              </span>
            )}
          </div>
          <div className="text-xs text-white/40 mt-2">
            Последняя активность: {fmtDateTime(user.lastSeenAt)} • Сообщений в чате: {messages}
          </div>
        </div>
      </div>

      {/* статистика */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {stat.map((s) => (
          <div key={s.label} className="rounded-[18px] glass p-4">
            <div className="flex items-center gap-2 text-white/40 text-xs">
              {s.icon} {s.label}
            </div>
            <div className="text-xl font-black mt-1.5">{s.value}</div>
          </div>
        ))}
      </div>

      {/* активность */}
      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-[22px] glass p-5">
          <h3 className="font-bold flex items-center gap-2">
            <IconServer size={18} /> Топ серверов игрока
          </h3>
          <div className="mt-3 space-y-2.5">
            {topServers.length === 0 && (
              <p className="text-sm text-white/30">
                Пока нет данных. Статистика появится после игры с клиентом.
              </p>
            )}
            {topServers.map((s) => (
              <div key={s.ip}>
                <div className="flex justify-between text-xs">
                  <span className="truncate font-medium">{s.ip}</span>
                  <span className="text-white/40 shrink-0 ml-2">
                    {playtime(s.minutes)} • {s.joins} зах.
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-white/30 to-white/10"
                    style={{ width: `${Math.round((s.minutes / maxMin) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[22px] glass p-5">
          <h3 className="font-bold flex items-center gap-2">
            <IconCalendar size={18} /> Хронология
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            {[
              ["Регистрация", fmtDateTime(user.createdAt)],
              ["Первое скачивание", fmtDateTime(firstDownload?.createdAt)],
              ["Последнее скачивание", fmtDateTime(lastDownload?.createdAt)],
              ["Последняя игра", fmtDateTime(lastSession?.startedAt)],
              ["Последний вход на сайт", fmtDateTime(user.lastSeenAt)],
            ].map(([k, v]) => (
              <li key={k} className="flex justify-between gap-3 border-b border-white/5 pb-1.5 last:border-0">
                <span className="text-white/50">{k}</span>
                <span className="text-white/80 text-right">{v}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ключи */}
      <div className="rounded-[22px] glass p-5">
        <h3 className="font-bold flex items-center gap-2">
          <IconKey size={18} /> Ключи пользователя
        </h3>
        <div className="mt-3 space-y-2">
          {keys.length === 0 && <div className="text-sm text-white/30">Нет ключей</div>}
          {keys.map((k) => (
            <div
              key={k.id}
              className="text-sm p-2.5 rounded-xl bg-white/[0.04] border border-white/5 flex justify-between items-center gap-3"
            >
              {/* сам ключ не светим публично */}
              <span className="font-mono text-white/70">
                {k.key.slice(0, 6)}••••••{k.key.slice(-7)}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-white/40">{k.type}</span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                    k.status === "ACTIVE"
                      ? "bg-white/80 text-black"
                      : k.status === "REVOKED"
                        ? "bg-white/10 text-white/60"
                        : "bg-white/10 text-white/60"
                  }`}
                >
                  {k.status}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
