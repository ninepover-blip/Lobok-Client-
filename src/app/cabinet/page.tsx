"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function Cabinet(){
  const [me,setMe]=useState<any>(null);
  const [keys,setKeys]=useState<any[]>([]);
  const [free,setFree]=useState<any>(null);
  const [form,setForm]=useState({newUsername:"", oldPassword:"", newPassword:"", avatarUrl:"", telegramId:"", discordConfirmed:false});
  const [msg,setMsg]=useState("");

  useEffect(()=>{
    fetch("/api/auth/me").then(r=>r.json()).then(d=>{ if(!d.user) location.href="/auth/login"; else setMe(d.user); });
    fetch("/api/keys?mine=1").then(r=>r.json()).then(d=>setKeys(d.keys||[]));
    fetch("/api/free-key/claim").then(r=>r.json()).then(setFree);
  },[]);

  async function saveSettings(){
    const res=await fetch("/api/auth/settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
    const d=await res.json();
    if(!res.ok) setMsg(d.error); else { setMsg("Сохранено"); setMe(d.user); }
  }
  async function claimFree(){
    if(!form.discordConfirmed) return setMsg("Подтверди подписку на Discord");
    const res=await fetch("/api/free-key/claim",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({discordConfirmed:true})});
    const d=await res.json();
    if(!res.ok) setMsg(d.error); else { setMsg(`Ключ выдан: ${d.key}`); fetch("/api/keys?mine=1").then(r=>r.json()).then(dd=>setKeys(dd.keys||[])); }
  }
  async function linkTelegram(){
    const tid = prompt("Введи Telegram ID (узнай у @userinfobot) или оставь пустым и нажми ОК для генерации ссылки:");
    if(tid===null) return;
    if(tid) {
      await fetch("/api/telegram/link",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({telegramId:tid})});
      alert("Привязано!"); location.reload();
    } else {
      // generate deep link
      const meData = me;
      alert(`Открой в Telegram: https://t.me/${process.env.NEXT_PUBLIC_TG_BOT||"LobokClientBot"}?start=link_${meData.id}\nБот: ${process.env.NEXT_PUBLIC_TG_BOT||"@LobokClientBot"}\nТокен: 8936060898:AAH2S9HfmqTtK9PGHQRP4v3xiuUHkUIIBVk`);
      // show link
      setMsg(`Ссылка: https://t.me/LobokClientBot?start=link_${me.id}`);
    }
  }

  if(!me) return <div className="p-10 text-center text-white/50">Загрузка...</div>;
  const roleColor = me.role==="ADMIN"?"text-red-400 font-black": me.role==="MODERATOR"?"text-blue-400 font-bold":"text-zinc-400";
  const badge = me.role==="ADMIN"? <span className="px-2 py-1 rounded-full bg-gradient-to-r from-violet-600 to-blue-600 text-white text-xs font-bold">ADMIN</span> : me.role==="MODERATOR"? <span className="px-2 py-1 rounded-full bg-blue-600 text-white text-xs">MODERATOR ✓</span> : <span className="px-2 py-1 rounded-full bg-white/10 text-white/60 text-xs">USER</span>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="grid lg:grid-cols-3 gap-6">
        {/* profile card */}
        <div className="rounded-[22px] glass p-6 space-y-4">
          <div className="flex gap-4 items-center">
            <img src={me.avatarUrl||"/lobok.jpg"} className="w-20 h-20 rounded-2xl object-cover border border-white/10" alt="" />
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xl font-bold ${roleColor}`}>{me.username}</span>
                {me.role==="MODERATOR" && <span className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_#3b82f6] inline-block" title="модер - синяя галочка" />}
                {me.role==="ADMIN" && <span className="w-3 h-3 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 shadow-[0_0_10px_#7c5cff] inline-block" title="админ - градиент" />}
              </div>
              <div className="mt-1">{badge}</div>
              <div className="text-xs text-white/40 mt-1">ID: {me.id.slice(0,8)}...</div>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <label className="text-white/60 text-xs">Аватар URL</label>
            <input value={form.avatarUrl} onChange={e=>setForm({...form,avatarUrl:e.target.value})} placeholder={me.avatarUrl||"/lobok.jpg"} className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm" />
            <label className="text-white/60 text-xs">Логин</label>
            <input value={form.newUsername} onChange={e=>setForm({...form,newUsername:e.target.value})} placeholder={me.username} className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10" />
            <label className="text-white/60 text-xs">Смена пароля</label>
            <input type="password" value={form.oldPassword} onChange={e=>setForm({...form,oldPassword:e.target.value})} placeholder="Старый пароль" className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10" />
            <input type="password" value={form.newPassword} onChange={e=>setForm({...form,newPassword:e.target.value})} placeholder="Новый пароль" className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10" />
          </div>
          <div className="flex gap-2">
            <button onClick={saveSettings} className="flex-1 py-2.5 rounded-full btn-primary text-white font-semibold text-sm">Сохранить</button>
            <Link href={`/profile/${me.username}`} className="px-4 py-2.5 rounded-full btn-ghost text-sm">Профиль</Link>
          </div>
          <div className="pt-3 border-t border-white/5 space-y-2">
            <div className="text-xs font-bold">Telegram 2FA</div>
            <div className="text-xs text-white/50">Привяжи Telegram для защиты и кодов</div>
            <div className="flex gap-2">
              <button onClick={linkTelegram} className="px-3 py-2 rounded-full bg-[#2AABEE] text-white text-xs font-medium">Привязать Telegram</button>
              <button onClick={async()=>{
                const en = !me.is2FAEnabled;
                const r=await fetch("/api/auth/settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({is2FAEnabled:en})});
                const d=await r.json(); if(r.ok){alert(en?"2FA включен":"2FA выключен"); location.reload();} else alert(d.error);
              }} className="px-3 py-2 rounded-full bg-white/5 text-xs">{me.is2FAEnabled?"Выкл 2FA":"Вкл 2FA"}</button>
            </div>
            <div className="text-[11px] text-white/30">Токен бота: 8936060898:AAH2...BVk • Бот для 2FA и выдачи ключей (только админ)</div>
          </div>
          {msg && <div className="text-sm p-2 rounded-xl bg-violet-500/15 text-violet-200">{msg}</div>}
        </div>

        {/* keys */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-[22px] glass p-6">
            <h3 className="font-bold">Мои ключи</h3>
            <p className="text-xs text-white/40">Формат Lobok-12символов-client • 1 ключ = 1 устройство (HWID+IP)</p>
            <div className="mt-4 space-y-2">
              {keys.length===0 && <div className="text-sm text-white/40 py-6 text-center">Ключей нет. Купи или забери фри-ключ →</div>}
              {keys.map(k=>(
                <div key={k.id} className="rounded-xl bg-white/[0.04] border border-white/5 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="font-mono text-sm font-bold tracking-wide">{k.key}</div>
                    <div className="text-xs text-white/40">{k.type} • {k.status} • {k.expiresAt? `до ${new Date(k.expiresAt).toLocaleDateString("ru-RU")}`:"навсегда"} • HWID: {k.hwid||"—"} • IP: {k.ip||"—"}</div>
                  </div>
                  <div className={`text-xs px-2.5 py-1 rounded-full font-bold ${k.status==="ACTIVE"?"bg-emerald-500 text-black":k.status==="REVOKED"?"bg-red-500 text-white":"bg-white/10"}`}>{k.status}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[22px] glass p-6 space-y-3">
            <h3 className="font-bold flex items-center gap-2">🎁 Фри-ключ 1 в день</h3>
            <div className="text-sm text-white/60">
              {free?.taken ? <span>Сегодня уже забрали: <b>{free.by}</b> • Следующий в 00:00 МСК</span> : <span className="text-emerald-400">Свободен — успей забрать!</span>}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.discordConfirmed} onChange={e=>setForm({...form,discordConfirmed:e.target.checked})} />
              <span>Я подписался на <a href="https://discord.gg/ASXzHaQfvj" target="_blank" className="text-[#5865F2] underline">Discord</a></span>
            </label>
            <button onClick={claimFree} className="w-full py-3 rounded-full btn-primary text-white font-bold">Забрать фри-ключ (7 дней)</button>
            <p className="text-xs text-white/30">Всего 1 ключ в день на весь сайт • проверка по IP/аккаунту</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Link href="/chat" className="rounded-[18px] glass p-4 hover:bg-white/10">
              <div className="font-bold">Глобальный чат</div><div className="text-xs text-white/50">Команды модеров: /mute /ban /warn /banip</div>
            </Link>
            <Link href="/support" className="rounded-[18px] glass p-4 hover:bg-white/10">
              <div className="font-bold">Саппорт</div><div className="text-xs text-white/50">Тикеты видят только ты и сапорты</div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
