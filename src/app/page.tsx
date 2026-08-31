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
      <section className="relative overflow-hidden rounded-[28px] glass p-6 sm:p-10">
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
              <a href="#pricing" className="px-6 py-3 rounded-full btn-primary font-semibold">Купить ключ — от 100₽</a>
              <Link href="/chat" className="px-6 py-3 rounded-full btn-ghost">Глобальный чат</Link>
              <a href="https://discord.gg/ASXzHaQfvj" target="_blank" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#333] text-white font-medium hover:bg-[#444]"><IconDiscord size={18} /> Discord</a>
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
          <div key={p.title} className={`relative rounded-[22px] p-6 flex flex-col ${p.popular?"glass-strong ring-1 ring-white/20 scale-[1.02]":"glass"}`}>
            {p.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs px-3 py-1 rounded-full bg-white text-black font-bold">РЕКОМЕНДУЕМ</div>}
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
            <Link href="/buy" className={`mt-6 w-full py-3 rounded-full text-center font-semibold ${p.popular?"btn-primary":"bg-white/10 text-white hover:bg-white/15"}`}>Получить ключ</Link>
          </div>
        ))}
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
            <div key={f.t} className="rounded-xl bg-white/[0.04] border border-white/5 p-4 hover:bg-white/[0.07] transition-all duration-200 hover:translate-y-[-1px]">
              <div className="flex items-center gap-2 font-semibold">
                <span className="grid place-items-center w-8 h-8 rounded-lg bg-white/10 text-white/70">{f.icon}</span>
                {f.t}
              </div>
              <div className="text-white/50 text-xs mt-2">{f.d}</div>
            </div>
          ))}
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
                <div className="mx-auto w-14 h-14 rounded-full bg-white/10 text-white/60 grid place-items-center"><IconPlay size={28} /></div>
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
              <li key={i} className="flex gap-3 rounded-xl bg-white/[0.04] border border-white/5 p-3 transition-all duration-200 hover:bg-white/[0.06]">
                <span className="w-6 h-6 shrink-0 rounded-full bg-white/10 text-white/70 grid place-items-center text-xs font-bold">{i + 1}</span>
                <span className="text-white/70">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
