"use client";
import { useState } from "react";
import Link from "next/link";

export default function LoginPage(){
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const [code,setCode]=useState("");
  const [need2FA,setNeed2FA]=useState(false);
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);

  async function submit(e:React.FormEvent){
    e.preventDefault(); setErr(""); setLoading(true);
    const res = await fetch("/api/auth/login",{method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ username,password, code: need2FA?code:undefined })});
    const data = await res.json();
    setLoading(false);
    if(data.need2FA){ setNeed2FA(true); return; }
    if(!res.ok){ setErr(data.error||"Ошибка"); return; }
    location.href="/cabinet";
  }
  async function request2FA(){
    const r=await fetch("/api/telegram/2fa/request",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username})});
    const d=await r.json();
    alert(d.message||d.error);
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="rounded-[24px] glass p-6 sm:p-8 space-y-5">
        <h1 className="text-2xl font-black">Вход в Lobok</h1>
        <p className="text-sm text-white/50">Админы: LayF / Vybe • 2FA по Telegram</p>
        <form onSubmit={submit} className="space-y-3">
          <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Логин" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500" />
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Пароль" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500" />
          {need2FA && (
            <div className="space-y-2">
              <input value={code} onChange={e=>setCode(e.target.value)} placeholder="Код 2FA из Telegram (6 цифр)" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-violet-500/40" />
              <button type="button" onClick={request2FA} className="text-xs text-violet-300 underline">Отправить код в Telegram</button>
            </div>
          )}
          {err && <div className="text-sm text-red-400 bg-red-500/10 p-2 rounded-xl">{err}</div>}
          <button disabled={loading} className="w-full py-3 rounded-xl btn-primary text-white font-bold">{loading?"Вход...":"Войти"}</button>
        </form>
        <div className="text-sm text-center text-white/50">Нет аккаунта? <Link href="/auth/register" className="text-violet-400">Регистрация</Link></div>
      </div>
    </div>
  )
}
