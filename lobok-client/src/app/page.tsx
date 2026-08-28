import Link from "next/link";
import prisma from "@/lib/prisma";
import {
  IconSword, IconRocket, IconShield, IconEye, IconWrench, IconChart,
  IconKey, IconChat, IconDownload, IconGift, IconDiscord, IconServer, IconPlay,
} from "@/components/Icons";

export const dynamic = "force-dynamic";

/** Преобразует ссылку YouTube/VK в embed-URL для iframe. */
function toEmbed(url: string): string {
  if (!url) return "";
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  return url;
}

async function getStats() {
  try {
    const [downloads, servers, activeKeys, joins, topServers, playAgg] = await Promise.all([
      prisma.downloadStat.count(),
      prisma.serverStat.count(),
      prisma.licenseKey.count({ where: { status: "ACTIVE" } }),
      prisma.serverStat.aggregate({ _sum: { count: true } }),
      prisma.serverStat.findMany({ orderBy: { count: "desc" }, take: 5 }),
      prisma.user.aggregate({ _sum: { playtimeMinutes: true } }),
    ]);
    const videoSetting = await prisma.setting.findUnique({ where: { key: "guideVideoUrl" } });
    return {
      downloads,
      servers,
      activeKeys,
      totalJoins: joins._sum.count ?? 0,
      topServers,
      playHours: Math.round((playAgg._sum.playtimeMinutes ?? 0) / 60),
      guideVideoUrl: videoSetting?.value || "",
    };
  } catch {
    return null;
  }
}

export default async function Home() {
  const stats = await getStats();
  const downloads = stats?.downloads ?? 0;
  const servers = stats?.servers ?? 0;
  const activeKeys = stats?.activeKeys ?? 0;
  const totalJoins = stats?.totalJoins ?? 0;
  const playHours = stats?.playHours ?? 0;
  const topServers = stats?.topServers ?? [];
  const guideVideoUrl = stats?.guideVideoUrl ?? "";
  const embed = toEmbed(guideVideoUrl);
  const topMax = Math.max(1, ...topServers.map((t: { count: number }) => t.count));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      {/* hero */}
      <section className="relative overflow-hidden rounded-[28px] glass gradient-border p-6 sm:p-10">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/15 via-transparent to-cyan-500/10 pointer-events-none" />
        <div className="relative grid lg:grid-cols-[1.2fr_0.8fr] gap-8 items-center">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Скачиваний {downloads.toLocaleString("ru-RU")} • Активных ключей {activeKeys}
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-[0.95]">
              Lobok Client<br /><span className="gradient-text">HvH доминация</span>
            </h1>
            <p className="text-white/60 leading-relaxed max-w-xl">
              Приватный чит-клиент для Minecraft 1.16.5+ • Заточён под <b className="text-white">MetaHvH</b> и все HvH сервера. 
              KillAura, AntiBot, Resolver, Velocity, обходы Matrix/AAC/Vulcan. Лаунчер с автообновлением и привязкой ключа к @USER + IP • 1 ключ = 1 устройство.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="#pricing" className="px-6 py-3 rounded-full btn-primary text-white font-semibold">Купить ключ — от 100₽</a>
              <Link href="/chat" className="px-6 py-3 rounded-full btn-ghost">Глобальный чат</Link>
              <a href="https://discord.gg/ASXzHaQfvj" target="_blank" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#5865F2] text-white font-medium"><IconDiscord size={18} /> Discord</a>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-white/50">
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/5">MetaHvH #1</span>
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/5">HvH • 1.16.5</span>
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/5">HWID + IP защита</span>
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/5">Авто-обновление</span>
            </div>
          </div>
          <div className="relative">
            <div className="rounded-[22px] overflow-hidden glass-strong p-4">
              <div className="aspect-square rounded-2xl overflow-hidden bg-black relative">
                <img src="/lobok.jpg" alt="Lobok" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <div className="text-xs px-2.5 py-1 rounded-full bg-black/60 border border-white/10 backdrop-blur">v2.4 • HvH Edition</div>
                  <div className="text-xs px-2.5 py-1 rounded-full bg-emerald-500 text-black font-bold">✓ Undetected</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
                <div className="rounded-xl bg-white/5 p-3 border border-white/5"><div className="text-lg font-bold">{downloads.toLocaleString("ru-RU")}</div><div className="text-white/40">скачиваний</div></div>
                <div className="rounded-xl bg-white/5 p-3 border border-white/5"><div className="text-lg font-bold">{servers}</div><div className="text-white/40">серверов</div></div>
                <div className="rounded-xl bg-white/5 p-3 border border-white/5"><div className="text-lg font-bold">{playHours}</div><div className="text-white/40">часов в игре</div></div>
              </div>
              <Link href="/api/launcher/download" className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-black font-bold hover:bg-zinc-100"><IconDownload size={18} /> Скачать лаунчер</Link>
              <p className="text-[11px] text-center text-white/30 mt-2">Windows 10/11 • Автообновление лаунчера и клиента</p>
            </div>
          </div>
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className="grid md:grid-cols-3 gap-4">
        {[
          { title:"30 дней", rub:100, uah:50, days:30, popular:false, desc:"Старт • все функции" },
          { title:"90 дней", rub:250, uah:125, days:90, popular:true, desc:"Хит • выгода 17%" },
          { title:"Навсегда", rub:400, uah:200, days:0, popular:false, desc:"Топ • lifetime обновления" },
        ].map(p=>(
          <div key={p.title} className={`relative rounded-[22px] p-6 flex flex-col ${p.popular?"glass-strong ring-1 ring-violet-500/40 scale-[1.02]":"glass"}`}>
            {p.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs px-3 py-1 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 font-bold">РЕКОМЕНДУЕМ</div>}
            <h3 className="font-bold text-lg">{p.title}</h3>
            <p className="text-sm text-white/50">{p.desc}</p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-black">{p.rub}₽</span>
              <span className="text-white/40">/ {p.uah}₴</span>
            </div>
            <ul className="mt-4 space-y-1.5 text-sm text-white/70">
              <li>✓ Привязка @USER + IP</li>
              <li>✓ 1 устройство</li>
              <li>✓ MetaHvH конфиги</li>
              <li>✓ Поддержка 24/7</li>
            </ul>
            <Link href="/cabinet" className={`mt-6 w-full py-3 rounded-full text-center font-semibold ${p.popular?"btn-primary text-white":"bg-white text-black hover:bg-zinc-100"}`}>Получить ключ</Link>
          </div>
        ))}
      </section>

      {/* free key & launcher */}
      <section className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-[22px] glass p-6 space-y-3">
          <h3 className="font-bold text-lg flex items-center gap-2"><IconGift size={20} /> Бесплатный ключ — 1 в день</h3>
          <p className="text-sm text-white/60">Каждый день разыгрывается 1 фри-ключ на 24 часа. Условие — подписка на Discord. Успей забрать первым!</p>
          <div className="flex gap-2">
            <a href="https://discord.gg/ASXzHaQfvj" target="_blank" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#5865F2] text-white font-medium"><IconDiscord size={16} /> Подписаться на DS</a>
            <Link href="/cabinet" className="px-5 py-2.5 rounded-full btn-ghost">Забрать ключ</Link>
          </div>
          <p className="text-xs text-white/30">Проверка подписки через Discord • 1 ключ = 1 аккаунт • сбрасывается в 00:00 МСК</p>
        </div>
        <div className="rounded-[22px] glass p-6 space-y-3">
          <h3 className="font-bold text-lg flex items-center gap-2"><IconDownload size={20} /> Лаунчер Lobok</h3>
          <p className="text-sm text-white/60">Автообновление лаунчера и клиента внутри. Скачай, войди в аккаунт и вставь свой ключ.</p>
          <div className="flex gap-2">
            <a href="/api/launcher/download" className="px-5 py-2.5 rounded-full bg-white text-black font-bold">Скачать .exe</a>
            <Link href="/stats" className="px-5 py-2.5 rounded-full btn-ghost">Статистика</Link>
          </div>
          <p className="text-xs text-white/30">Версия лаунчера проверяется при каждом запуске • клиент подтягивает обновления автоматически</p>
        </div>
      </section>

      {/* features */}
      <section className="rounded-[22px] glass p-6">
        <h3 className="font-bold">Возможности клиента</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 text-sm">
          {[
            { icon: <IconSword size={18} />, t: "Combat", d: "KillAura, Criticals, AntiBot, Resolver, TargetStrafe" },
            { icon: <IconRocket size={18} />, t: "Movement", d: "LongJump, Fly, Speed, Timer, NoFall" },
            { icon: <IconShield size={18} />, t: "Bypass", d: "Matrix, Vulcan, AAC, Verus, Grim" },
            { icon: <IconEye size={18} />, t: "Visual", d: "ESP, Tracers, Chams, FullBright, HUD" },
            { icon: <IconWrench size={18} />, t: "Utility", d: "Scaffold, AutoTotem, ChestStealer" },
            { icon: <IconChart size={18} />, t: "HvH", d: "MetaHvH конфиги, AntiPush, BackTrack" },
            { icon: <IconKey size={18} />, t: "Защита", d: "HWID+IP привязка, изъятие при передаче" },
            { icon: <IconChat size={18} />, t: "Соц", d: "Глобальный чат + саппорт-тикет" },
          ].map((f) => (
            <div key={f.t} className="rounded-xl bg-white/[0.04] border border-white/5 p-4 hover:bg-white/[0.07] transition">
              <div className="flex items-center gap-2 font-semibold">
                <span className="grid place-items-center w-8 h-8 rounded-lg bg-violet-500/15 text-violet-300">{f.icon}</span>
                {f.t}
              </div>
              <div className="text-white/50 text-xs mt-2">{f.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* stats preview */}
      <section className="grid md:grid-cols-3 gap-4">
        <div className="rounded-[22px] glass p-6">
          <h4 className="font-bold flex items-center gap-2"><IconDownload size={18} /> Скачивания</h4>
          <p className="text-3xl font-black mt-2">{downloads.toLocaleString("ru-RU")}</p>
          <p className="text-xs text-white/40">всего заходов на сервера: {totalJoins.toLocaleString("ru-RU")}</p>
          <Link href="/stats" className="inline-block mt-3 text-xs px-3 py-1 rounded-full bg-white/5 hover:bg-white/10">Подробнее →</Link>
        </div>

        <div className="rounded-[22px] glass p-6">
          <h4 className="font-bold flex items-center gap-2"><IconServer size={18} /> Топ серверов HvH</h4>
          <div className="mt-3 space-y-2 text-sm">
            {topServers.length === 0 && <div className="text-white/30 text-xs">Пока нет данных — статистика появится после заходов на сервера.</div>}
            {topServers.map((srv: { id: string; ip: string; count: number }) => (
              <div key={srv.id}>
                <div className="flex justify-between text-xs">
                  <span className="truncate">{srv.ip}</span>
                  <span className="text-white/40">{srv.count}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${Math.round((srv.count / topMax) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[22px] glass p-6">
          <h4 className="font-bold flex items-center gap-2"><IconServer size={18} /> Обновления</h4>
          <p className="text-sm text-white/60 mt-2">Лаунчер и клиент обновляются без переустановки. Версия проверяется на сервере.</p>
          <a href="/api/launcher/version" className="inline-block mt-3 text-xs px-3 py-1 rounded-full bg-white/5 hover:bg-white/10">/api/launcher/version →</a>
        </div>
      </section>

      {/* видеоинструкция */}
      <section id="guide" className="rounded-[22px] glass p-6">
        <h3 className="font-bold flex items-center gap-2"><IconPlay size={18} /> Видеоинструкция — как начать</h3>
        <p className="text-sm text-white/50 mt-1">Пять шагов от регистрации до захода на сервер.</p>
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-5 mt-4">
          {embed ? (
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-black aspect-video">
              <iframe
                src={embed}
                title="Видеоинструкция Lobok Client"
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-black aspect-video grid place-items-center text-center p-6">
              <div>
                <div className="mx-auto w-14 h-14 rounded-full bg-violet-500/20 text-violet-300 grid place-items-center"><IconPlay size={28} /></div>
                <p className="mt-3 text-sm text-white/60">Видео скоро появится</p>
                <p className="text-xs text-white/30 mt-1">Админ добавляет ссылку в панели: вкладка «Сайт»</p>
              </div>
            </div>
          )}
          <ol className="space-y-2 text-sm">
            {[
              "Зарегистрируйся на сайте и войди в кабинет",
              "Купи ключ или забери бесплатный (1 в день, на 24 часа)",
              "Скачай лаунчер и запусти его от имени администратора",
              "Вставь ключ — он привяжется к твоему аккаунту и устройству",
              "Заходи на MetaHvH и играй, статистика считается автоматически",
            ].map((step, i) => (
              <li key={i} className="flex gap-3 rounded-xl bg-white/[0.04] border border-white/5 p-3">
                <span className="w-6 h-6 shrink-0 rounded-full bg-violet-500/20 text-violet-300 grid place-items-center text-xs font-bold">{i + 1}</span>
                <span className="text-white/70">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
