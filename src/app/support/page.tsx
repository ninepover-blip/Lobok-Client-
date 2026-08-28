"use client";
import { useEffect, useState } from "react";

export default function SupportPage(){
  const [tickets,setTickets]=useState<any[]>([]);
  const [title,setTitle]=useState(""); const [desc,setDesc]=useState("");
  const [selected,setSelected]=useState<any>(null);
  const [msg,setMsg]=useState(""); const [me,setMe]=useState<any>(null);
  async function load(){
    const r=await fetch("/api/support/tickets");
    const d=await r.json();
    if(r.ok) setTickets(d.tickets||[]);
  }
  useEffect(()=>{
    fetch("/api/auth/me").then(r=>r.json()).then(d=>setMe(d.user));
    load();
  },[]);
  async function create(){
    const r=await fetch("/api/support/tickets",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title, description:desc})});
    if(r.ok){ setTitle(""); setDesc(""); load(); }
  }
  async function open(id:string){
    const r=await fetch(`/api/support/tickets/${id}`);
    const d=await r.json();
    if(r.ok) setSelected(d.ticket);
  }
  async function send(){
    if(!selected) return;
    const r=await fetch(`/api/support/tickets/${selected.id}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:msg})});
    if(r.ok){ setMsg(""); open(selected.id); load(); }
  }
  const isMod = me?.role==="ADMIN"||me?.role==="MODERATOR";
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-[360px_1fr] gap-4">
      <div className="space-y-4">
        <div className="rounded-[22px] glass p-5 space-y-3">
          <h2 className="font-bold">Новый тикет</h2>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Тема (напр. не работает ключ)" className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm" />
          <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Опиши проблему..." rows={3} className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm" />
          <button onClick={create} className="w-full py-2.5 rounded-full btn-primary text-white font-bold text-sm">Создать</button>
          <p className="text-xs text-white/30">Видят только ты и сапорты (модеры/админы)</p>
        </div>
        <div className="rounded-[22px] glass p-3 space-y-2 max-h-[60vh] overflow-y-auto">
          <h3 className="font-bold text-sm px-2">Тикеты</h3>
          {tickets.map(t=>(
            <button key={t.id} onClick={()=>open(t.id)} className={`w-full text-left p-3 rounded-xl border ${selected?.id===t.id?"bg-violet-500/15 border-violet-500/30":"bg-white/[0.03] border-white/5 hover:bg-white/5"}`}>
              <div className="text-sm font-semibold truncate">{t.title}</div>
              <div className="text-xs text-white/40">{t.author.username} • {t.status} • {new Date(t.createdAt).toLocaleDateString("ru-RU")}</div>
            </button>
          ))}
          {tickets.length===0 && <div className="text-xs text-white/30 p-4 text-center">Тикетов нет</div>}
        </div>
      </div>
      <div className="rounded-[22px] glass p-4 flex flex-col min-h-[500px]">
        {!selected ? <div className="flex-1 grid place-items-center text-white/30 text-sm">Выбери тикет слева</div> : (
          <>
            <div className="pb-3 border-b border-white/5">
              <h2 className="font-bold">{selected.title}</h2>
              <p className="text-sm text-white/60">{selected.description}</p>
              <p className="text-xs text-white/30 mt-1">Автор: {selected.author.username} • {selected.status}</p>
            </div>
            <div className="flex-1 py-3 space-y-2 overflow-y-auto">
              {selected.messages?.map((m:any)=>(
                <div key={m.id} className={`p-3 rounded-xl max-w-[85%] ${m.isPinned?"bg-violet-500/10 border border-violet-500/20 ml-auto":"bg-white/[0.04] border border-white/5"}`}>
                  <div className="text-xs font-bold flex gap-2">{m.user.username} {m.isPinned&&<span className="text-amber-400">★ закрепа</span>} <span className="text-white/30 ml-auto">{new Date(m.createdAt).toLocaleTimeString("ru-RU")}</span></div>
                  <div className="text-sm mt-1">{m.content}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-3 border-t border-white/5">
              <input value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Ответ..." className="flex-1 px-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-sm" />
              <button onClick={send} className="px-6 py-2.5 rounded-full btn-primary text-white text-sm font-bold">Отправить</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
