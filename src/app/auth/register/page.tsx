"use client";
import { useState } from "react";
import Link from "next/link";

export default function RegisterPage(){
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);
  async function submit(e:React.FormEvent){
    e.preventDefault(); setErr(""); setLoading(true);
    const res = await fetch("/api/auth/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password})});
    const data=await res.json();
    setLoading(false);
    if(!res.ok){ setErr(data.error); return; }
    location.href="/cabinet";
  }
  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="rounded-[24px] glass p-6 sm:p-8 space-y-5">
        <h1 className="text-2xl font-black">Регистрация</h1>
        <p className="text-sm text-white/50">1 ключ = 1 устройство • привязка @USER + IP</p>
        <form onSubmit={submit} className="space-y-3">
          <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Логин (3-20, латиница)" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500" />
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Пароль (мин 4)" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-violet-500" />
          {err && <div className="text-sm text-red-400 bg-red-500/10 p-2 rounded-xl">{err}</div>}
          <button disabled={loading} className="w-full py-3 rounded-xl btn-primary text-white font-bold">{loading?"...":"Создать аккаунт"}</button>
          <p className="text-[11px] text-center text-white/35 leading-relaxed">
            Создавая аккаунт, ты принимаешь{" "}
            <Link href="/legal" className="text-violet-400/80 hover:text-violet-300 underline">
              политику конфиденциальности и условия
            </Link>
          </p>
        </form>
        <div className="text-sm text-center text-white/50">Есть аккаунт? <Link href="/auth/login" className="text-violet-400">Войти</Link></div>
      </div>
    </div>
  )
}
