import Link from "next/link";

async function getStats() {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const res = await fetch(`${base}/api/stats`, { cache: "no-store" }).then(r=>r.json()).catch(()=>null);
    return res;
  } catch { return null }
}

export default async function Home() {
  const stats = await getStats();
  const downloads = stats?.downloads ?? 12847;
  const servers = stats?.servers ?? 342;
  const online = stats?.online ?? 891;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      {/* hero */}
      <section className="relative overflow-hidden rounded-[28px] glass gradient-border p-6 sm:p-10">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/15 via-transparent to-cyan-500/10 pointer-events-none" />
        <div className="relative grid lg:grid-cols-[1.2fr_0.8fr] gap-8 items-center">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Онлайн {online} • Скачиваний {downloads.toLocaleString("ru-RU")}
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
              <a href="https://discord.gg/ASXzHaQfvj" target="_blank" className="px-6 py-3 rounded-full bg-[#5865F2] text-white font-medium">Discord</a>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-white/50">
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/5">MetaHvH #1</span>
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/5">HvH • 1.8-1.21</span>
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
                <div className="rounded-xl bg-white/5 p-3 border border-white/5"><div className="text-lg font-bold">4.9★</div><div className="text-white/40">рейтинг</div></div>
              </div>
              <Link href="/api/launcher/download" className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-black font-bold hover:bg-zinc-100">⬇ Скачать лаунчер</Link>
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
            <p className="text-center text-[11px] text-white/30 mt-2">Ключ: Lobok-12символов-client</p>
          </div>
        ))}
      </section>

      {/* free key & launcher */}
      <section className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-[22px] glass p-6 space-y-3">
          <h3 className="font-bold text-lg flex items-center gap-2">🎁 Бесплатный ключ — 1 в день</h3>
          <p className="text-sm text-white/60">Каждый день разыгрывается 1 фри-ключ. Условие — подписка на Discord. Успей забрать первым!</p>
          <div className="flex gap-2">
            <a href="https://discord.gg/ASXzHaQfvj" target="_blank" className="px-5 py-2.5 rounded-full bg-[#5865F2] text-white font-medium">Подписаться на DS</a>
            <Link href="/cabinet" className="px-5 py-2.5 rounded-full btn-ghost">Забрать ключ</Link>
          </div>
          <p className="text-xs text-white/30">Проверка подписки через Discord • 1 ключ = 1 аккаунт • сбрасывается в 00:00 МСК</p>
        </div>
        <div className="rounded-[22px] glass p-6 space-y-3">
          <h3 className="font-bold text-lg">⬇ Лаунчер Lobok</h3>
          <p className="text-sm text-white/60">Автообновление лаунчера и клиента внутри. Скачай и просто вставь ключ формата Lobok-XXXXXXXXXXXX-client.</p>
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
            ["⚔️ Combat", "KillAura, Criticals, AntiBot, Resolver, TargetStrafe"],
            ["🚀 Movement", "LongJump, Fly, Speed, Timer, NoFall"],
            ["🛡 Bypass", "Matrix, Vulcan, AAC, Verus, Grim"],
            ["🎨 Visual", "ESP, Tracers, Chams, FullBright, HUD"],
            ["🔧 Utility", "Scaffold, AutoTotem, ChestStealer"],
            ["📊 HvH", "MetaHvH конфиги, AntiPush, BackTrack"],
            ["🔑 Защита", "HWID+IP привязка, изъятие при передаче"],
            ["💬 Соц", "Глобальный чат + саппорт-тикет"],
          ].map(([t,d])=>(
            <div key={t} className="rounded-xl bg-white/[0.04] border border-white/5 p-4">
              <div className="font-semibold">{t}</div><div className="text-white/50 text-xs mt-1">{d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* stats preview */}
      <section className="grid md:grid-cols-3 gap-4">
        <div className="rounded-[22px] glass p-6">
          <h4 className="font-bold">Статистика скачиваний</h4>
          <p className="text-3xl font-black mt-2">{downloads.toLocaleString("ru-RU")}</p>
          <p className="text-xs text-white/40">всего • растёт каждый день</p>
          <Link href="/stats" className="inline-block mt-3 text-xs px-3 py-1 rounded-full bg-white/5">Подробнее →</Link>
        </div>
        <div className="rounded-[22px] glass p-6">
          <h4 className="font-bold">Топ серверов HvH</h4>
          <div className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><span>MetaHvH.net</span><span className="text-white/40">62%</span></div>
            <div className="flex justify-between"><span>HolyWorld</span><span className="text-white/40">18%</span></div>
            <div className="flex justify-between"><span>ReallyWorld</span><span className="text-white/40">9%</span></div>
          </div>
        </div>
        <div className="rounded-[22px] glass p-6">
          <h4 className="font-bold">Обновления</h4>
          <p className="text-sm text-white/60 mt-2">Лаунчер и клиент обновляются без переустановки. Версия проверяется на сервере.</p>
          <a href="/api/launcher/version" className="inline-block mt-3 text-xs px-3 py-1 rounded-full bg-white/5">/api/launcher/version →</a>
        </div>
      </section>
    </div>
  );
}
