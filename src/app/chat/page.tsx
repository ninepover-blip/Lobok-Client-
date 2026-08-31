"use client";
import { useEffect, useState, useRef } from "react";
import { RoleName } from "@/components/Icons";

export default function ChatPage(){
  const [msgs,setMsgs]=useState<any[]>([]);
  const [text,setText]=useState("");
  const [me,setMe]=useState<any>(null);
  const [err,setErr]=useState("");
  const bottomRef=useRef<HTMLDivElement>(null);
  async function load(){
    const r=await fetch("/api/chat/global?limit=100");
    const d=await r.json();
    setMsgs(d.messages||[]);
    setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}),100);
  }
  useEffect(()=>{
    fetch("/api/auth/me").then(r=>r.json()).then(d=>setMe(d.user));
    load();
    const id=setInterval(load,3000);
    return ()=>clearInterval(id);
  },[]);
  async function send(e:React.FormEvent){
    e.preventDefault(); setErr("");
    const r=await fetch("/api/chat/global",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:text})});
    const d=await r.json();
    if(!r.ok) setErr(d.error); else { setText(""); load(); }
  }
  async function del(id:string){
    await fetch(`/api/chat/message/${id}`,{method:"DELETE"});
    load();
  }
  const isMod = me?.role==="ADMIN"||me?.role==="MODERATOR";
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col h-[calc(100vh-64px-60px)]">
      <div className="rounded-t-[22px] glass p-4 flex items-center justify-between">
        <h1 className="font-bold">Глобальный чат</h1>
        <span className="text-xs text-white/40">{msgs.length} сообщений • {isMod?"модерация доступна":""}</span>
      </div>
      <div className="flex-1 overflow-y-auto glass border-t-0 rounded-b-none p-4 space-y-2 bg-black/20">
        {msgs.map(m=>(
          <div key={m.id} className={`flex gap-3 p-3 rounded-xl ${m.isPinned?"bg-white/5 border border-white/10":"bg-white/[0.03] border border-white/5"}`}>
            <img src={m.user.avatarUrl||"/lobok.jpg"} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt="" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs">
                <RoleName username={m.user.username} role={m.user.role} size={13} />
                {m.isPinned && <span className="px-1.5 py-0.5 rounded bg-amber-500 text-black text-[10px] font-bold">ЗАКРЕП</span>}
                <span className="text-white/30 ml-auto">{new Date(m.createdAt).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</span>
                {isMod && <button onClick={()=>del(m.id)} className="text-red-400 hover:underline ml-2">удалить</button>}
              </div>
              <div className="text-sm text-white/90 break-words mt-1">{m.content}</div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="glass rounded-b-[22px] border-t-0 p-3 flex gap-2">
        <input value={text} onChange={e=>setText(e.target.value)} placeholder="Написать сообщение..." className="flex-1 px-4 py-3 rounded-full bg-white/5 border border-white/10 outline-none text-sm" />
        <button className="px-6 py-3 rounded-full btn-primary text-white font-bold text-sm">Отправить</button>
      </form>
      {err && <div className="mt-2 text-sm text-red-400 bg-red-500/10 p-2 rounded-xl">{err}</div>}
    </div>
  )
}
