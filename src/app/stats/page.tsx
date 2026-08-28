"use client";
import { useEffect, useState } from "react";

export default function StatsPage(){
  const [stats,setStats]=useState<any>(null);
  const [servers,setServers]=useState<any[]>([]);
  useEffect(()=>{
    fetch("/api/stats").then(r=>r.json()).then(setStats);
    fetch("/api/stats/server?limit=20").then(r=>r.json()).then(d=>setServers(d.servers||[]));
  },[]);
  async function reportServer(){
    const ip=prompt("IP сервера для подсчёта (при заходе на сервер клиент шлёт IP сюда):","MetaHvH.net");
    if(!ip) return;
    const username=prompt("Твой @username (необязательно):","")||undefined;
    await fetch("/api/stats/server",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ip, username})});
    alert("Учёт +1"); location.reload();
  }
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        {[
          ["Скачиваний", stats?.downloads ?? "—"],
          ["Серверов", stats?.servers ?? "—"],
          ["Всего заходов", stats?.totalJoins ?? "—"],
          ["Активных ключей", stats?.activeKeys ?? "—"],
        ].map(([t,v])=>(
          <div key={t as string} className="rounded-[22px] glass p-5 text-center">
            <div className="text-xs text-white/40">{t}</div><div className="text-2xl font-black mt-1">{v as string}</div>
          </div>
        ))}
      </div>
      <div className="rounded-[22px] glass p-6 flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h3 className="font-bold">Статистика серверов</h3>
          <p className="text-sm text-white/50">При заходе на сервер клиент отправляет IP на /api/stats/server → идёт подсчёт</p>
        </div>
        <button onClick={reportServer} className="px-5 py-2.5 rounded-full btn-primary text-white font-bold">Отправить IP (тест)</button>
      </div>
      <div className="rounded-[22px] glass p-4">
        <h4 className="font-bold text-sm mb-3">Топ серверов где играют с Lobok</h4>
        {servers.length===0 ? <div className="text-sm text-white/30 py-6 text-center">Пока нет данных — первые заходы появятся после POST /api/stats/server {"{ip}"} </div> : (
          <div className="space-y-2">
            {servers.map((s:any)=>(
              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="font-mono text-sm">{s.ip}</span><span className="text-sm font-bold">{s.count} заходов</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 text-xs text-white/30">
          <div>Пример интеграции в лаунчер (Java):</div>
          <pre className="mt-2 p-3 rounded-xl bg-black/40 overflow-x-auto">fetch("https://lobok-client.vercel.app/api/stats/server", {"{"}
  method:"POST",
  headers:{"{"}"Content-Type":"application/json"{"}"},
  body: JSON.stringify({"{"} ip: serverIP, username: mcUsername {"}"})
{"}"});</pre>
        </div>
      </div>
    </div>
  )
}
