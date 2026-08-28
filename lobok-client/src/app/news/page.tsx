"use client";
import { useEffect, useState } from "react";
import { RoleName } from "@/components/Icons";

export default function NewsPage(){
  const [news,setNews]=useState<any[]>([]);
  useEffect(()=>{ fetch("/api/news").then(r=>r.json()).then(d=>setNews(d.news||[])); },[]);
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-black">Новости Lobok Client</h1>
      {news.length===0 && <div className="rounded-[22px] glass p-8 text-center text-white/40">Новостей пока нет.</div>}
      {news.map(n=>(
        <div key={n.id} className="rounded-[22px] glass p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs text-white/40"><img src={n.author.avatarUrl||"/lobok.jpg"} className="w-6 h-6 rounded-full object-cover" alt="" /><RoleName username={n.author.username} role={n.author.role} size={12} /> • {new Date(n.createdAt).toLocaleString("ru-RU")}</div>
          <h3 className="font-bold text-lg">{n.title}</h3>
          <p className="text-sm text-white/70 whitespace-pre-wrap">{n.content}</p>
          {n.mediaUrls?.length>0 && (
            <div className="grid sm:grid-cols-2 gap-2">
              {n.mediaUrls.map((u:string,i:number)=> u.match(/\.(mp4|webm|mov)$/i) ? <video key={i} src={u} controls className="rounded-xl w-full" /> : <img key={i} src={u} alt="" className="rounded-xl w-full object-cover" />)}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
