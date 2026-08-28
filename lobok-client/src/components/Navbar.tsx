"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { VerifiedBadge } from "@/components/Icons";

type Me = { id:string; username:string; role:string; avatarUrl?:string } | null;

export default function Navbar() {
  const [me,setMe]=useState<Me>(null);
  const [open,setOpen]=useState(false);
  useEffect(()=>{
    fetch("/api/auth/me").then(r=>r.json()).then(d=>setMe(d.user||null)).catch(()=>{});
  },[]);
  async function logout(){
    await fetch("/api/auth/logout",{method:"POST"});
    location.href="/";
  }
  return (
    <nav className="sticky top-0 z-50 glass border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[64px] flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3">
          <img src="/lobok.jpg" alt="Lobok" className="w-9 h-9 rounded-xl object-cover glow" />
          <span className="font-bold tracking-tight text-lg">Lobok <span className="gradient-text">Client</span></span>
          <span className="hidden sm:inline text-xs px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/60">HvH • 1.16.5</span>
        </Link>
        <div className="hidden md:flex items-center gap-1.5 text-sm">
          <Link className="px-3 py-2 rounded-full hover:bg-white/5" href="/">Главная</Link>
          <Link className="px-3 py-2 rounded-full hover:bg-white/5" href="/news">Новости</Link>
          <Link className="px-3 py-2 rounded-full hover:bg-white/5" href="/chat">Чат</Link>
          <Link className="px-3 py-2 rounded-full hover:bg-white/5" href="/support">Саппорт</Link>
          <Link className="px-3 py-2 rounded-full hover:bg-white/5" href="/stats">Статистика</Link>
          {me && <Link className="px-3 py-2 rounded-full hover:bg-white/5" href="/cabinet">Кабинет</Link>}
          {me?.role==="ADMIN" && <Link className="px-3 py-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600" href="/admin">Админ</Link>}
          {me?.role==="MODERATOR" && <Link className="px-3 py-2 rounded-full bg-blue-600" href="/admin">Модерация</Link>}
        </div>
        <div className="flex items-center gap-2">
          {me ? (
            <>
              <Link href={`/profile/${me.username}`} className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full glass">
                <img src={me.avatarUrl||"/lobok.jpg"} className="w-7 h-7 rounded-full object-cover" alt="" />
                <span className={`text-sm font-medium ${me.role==="ADMIN"?"text-red-400 font-bold": me.role==="MODERATOR"?"text-blue-400 font-bold":"text-zinc-300"}`}>{me.username}</span>
                <VerifiedBadge role={me.role} size={15} />
              </Link>
              <button onClick={logout} className="hidden sm:block text-xs px-3 py-2 rounded-full bg-white/5 hover:bg-white/10">Выйти</button>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="text-sm px-5 py-2 rounded-full btn-ghost">Войти</Link>
              <Link href="/auth/register" className="text-sm px-5 py-2 rounded-full btn-primary text-white font-medium">Регистрация</Link>
            </>
          )}
          <button onClick={()=>setOpen(!open)} className="md:hidden w-9 h-9 rounded-full glass grid place-items-center">☰</button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-white/5 p-3 grid gap-1 text-sm bg-[#0a0a14]">
          <Link onClick={()=>setOpen(false)} href="/" className="px-3 py-2 rounded-xl hover:bg-white/5">Главная</Link>
          <Link onClick={()=>setOpen(false)} href="/chat" className="px-3 py-2 rounded-xl hover:bg-white/5">Чат</Link>
          <Link onClick={()=>setOpen(false)} href="/support" className="px-3 py-2 rounded-xl hover:bg-white/5">Саппорт</Link>
          <Link onClick={()=>setOpen(false)} href="/stats" className="px-3 py-2 rounded-xl hover:bg-white/5">Статистика</Link>
          <Link onClick={()=>setOpen(false)} href="/news" className="px-3 py-2 rounded-xl hover:bg-white/5">Новости</Link>
          {me && <Link onClick={()=>setOpen(false)} href={`/cabinet`} className="px-3 py-2 rounded-xl hover:bg-white/5">Кабинет</Link>}
          {me?.role==="ADMIN" && <Link onClick={()=>setOpen(false)} href="/admin" className="px-3 py-2 rounded-xl bg-violet-600 text-white">Админ</Link>}
        </div>
      )}
    </nav>
  )
}
