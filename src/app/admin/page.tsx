"use client";
import { useEffect, useState } from "react";

export default function AdminPage(){
  const [me,setMe]=useState<any>(null);
  const [keys,setKeys]=useState<any[]>([]);
  const [users,setUsers]=useState<any[]>([]);
  const [filter,setFilter]=useState("");
  const [gen,setGen]=useState({type:"D30", username:"", count:1});
  const [ver,setVer]=useState({version:"", changelog:"", downloadUrl:"", forClient:false});
  const [msg,setMsg]=useState("");

  useEffect(()=>{
    fetch("/api/auth/me").then(r=>r.json()).then(d=>{ setMe(d.user); if(d.user?.role!=="ADMIN") location.href="/"; });
    reload();
  },[]);
  async function reload(){
    const [k,u]=await Promise.all([fetch("/api/keys").then(r=>r.json()), fetch("/api/admin/users").then(r=>r.json())]);
    setKeys(k.keys||[]); setUsers(u.users||[]);
  }
  async function generate(){
    const r=await fetch("/api/keys",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(gen)});
    const d=await r.json(); if(r.ok){ setMsg(`Создано ${d.keys.length}`); reload(); } else setMsg(d.error);
  }
  async function keyAction(id:string, action:string, extra:any={}){
    const r=await fetch(`/api/keys/${id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({action, ...extra})});
    const d=await r.json(); if(!r.ok) setMsg(d.error); else reload();
  }
  async function setRole(uid:string, role:string){
    await fetch("/api/admin/users",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:uid, role})});
    reload();
  }
  async function publishNews(e:React.FormEvent){
    e.preventDefault();
    const fd=new FormData(e.target as HTMLFormElement);
    const r=await fetch("/api/news",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:fd.get("title"), content:fd.get("content"), mediaUrls: String(fd.get("media")||"").split(",").map(s=>s.trim()).filter(Boolean)})});
    if(r.ok) alert("Новость опубликована"); else alert((await r.json()).error);
  }
  async function pushVersion(){
    const r=await fetch("/api/launcher/update",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(ver)});
    if(r.ok) setMsg("Версия сохранена"); else setMsg((await r.json()).error);
  }

  const filtered = keys.filter(k=> !filter || k.key.toLowerCase().includes(filter.toLowerCase()) || (k.ownerUsername||"").toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-black">Админ панель <span className="text-violet-400">Lobok</span></h1>
      {msg && <div className="p-2 rounded-xl bg-violet-500/15 text-violet-200 text-sm">{msg}</div>}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="rounded-[22px] glass p-5 space-y-3">
          <h3 className="font-bold">Генерация ключей</h3>
          <p className="text-xs text-white/40">Формат Lobok-12chars-client • привязываются к @USER+IP • 1 ключ 1 устройство</p>
          <select value={gen.type} onChange={e=>setGen({...gen,type:e.target.value})} className="w-full px-3 py-2 rounded-xl bg-[#1a1a2e] border border-white/10 text-sm">
            <option value="D30">30д — 100₽/50₴</option>
            <option value="D90">90д — 250₽/125₴</option>
            <option value="FOREVER">Навсегда — 400₽/200₴</option>
            <option value="FREE">FREE 7д</option>
          </select>
          <input value={gen.username} onChange={e=>setGen({...gen,username:e.target.value})} placeholder="@username (пусто = не привязан)" className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm" />
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={50} value={gen.count} onChange={e=>setGen({...gen,count:parseInt(e.target.value)||1})} className="w-20 px-3 py-2 rounded-xl bg-white/5 border border-white/10" />
            <span className="text-xs text-white/40">штук (до 50)</span>
          </div>
          <button onClick={generate} className="w-full py-2.5 rounded-full btn-primary text-white font-bold">Сгенерировать</button>
        </div>

        <div className="rounded-[22px] glass p-5 space-y-3">
          <h3 className="font-bold">Новости / Видео / Фото</h3>
          <form onSubmit={publishNews} className="space-y-2">
            <input name="title" placeholder="Заголовок" required className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm" />
            <textarea name="content" placeholder="Текст новости..." required rows={3} className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm" />
            <input name="media" placeholder="Ссылки на фото/видео через запятую" className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm" />
            <button className="w-full py-2.5 rounded-full bg-white text-black font-bold">Опубликовать (только админы)</button>
          </form>
        </div>

        <div className="rounded-[22px] glass p-5 space-y-3">
          <h3 className="font-bold">Лаунчер / Клиент обновление</h3>
          <input value={ver.version} onChange={e=>setVer({...ver,version:e.target.value})} placeholder="Версия напр. 1.0.3" className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm" />
          <input value={ver.downloadUrl} onChange={e=>setVer({...ver,downloadUrl:e.target.value})} placeholder="Ссылка скачивания" className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm" />
          <input value={ver.changelog} onChange={e=>setVer({...ver,changelog:e.target.value})} placeholder="Changelog" className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ver.forClient} onChange={e=>setVer({...ver,forClient:e.target.checked})} /> Это клиент (внутри лаунчера)</label>
          <button onClick={pushVersion} className="w-full py-2.5 rounded-full btn-ghost font-bold">Сохранить версию</button>
          <a href="/api/launcher/version" className="text-xs text-violet-300">/api/launcher/version</a>
        </div>
      </div>

      <div className="rounded-[22px] glass p-5">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <h3 className="font-bold">Все ключи ({keys.length})</h3>
          <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Поиск по ключу / @user" className="px-3 py-2 rounded-full bg-white/5 border border-white/10 text-sm w-64" />
        </div>
        <div className="mt-4 space-y-2 max-h-[500px] overflow-y-auto">
          {filtered.map(k=>(
            <div key={k.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col lg:flex-row lg:items-center gap-2 justify-between">
              <div className="min-w-0">
                <div className="font-mono text-sm font-bold truncate">{k.key}</div>
                <div className="text-xs text-white/40"> {k.type} • {k.status} • @{k.ownerUsername||"—"} • {k.owner?.username||""} • HWID:{k.hwid||"—"} IP:{k.ip||"—"} • {k.expiresAt? new Date(k.expiresAt).toLocaleString("ru-RU"):"∞"} </div>
              </div>
              <div className="flex flex-wrap gap-1">
                <button onClick={()=>keyAction(k.id,"revoke")} className="px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 text-xs">Revoke</button>
                <button onClick={()=>keyAction(k.id,"unrevoke")} className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs">Unrevoke</button>
                <button onClick={()=>keyAction(k.id,"regenerate")} className="px-2.5 py-1 rounded-full bg-white/10 text-xs">Regen</button>
                <button onClick={()=>{
                  const u=prompt("Новый @username (пусто чтобы отвязать)",k.ownerUsername||"");
                  if(u!==null) keyAction(k.id,"bind",{username: u||null});
                }} className="px-2.5 py-1 rounded-full bg-violet-500/20 text-violet-300 text-xs">Bind</button>
                <button onClick={()=>keyAction(k.id,"unbind")} className="px-2.5 py-1 rounded-full bg-white/5 text-xs">Unbind</button>
                <button onClick={()=>{ if(confirm("Удалить?")) fetch(`/api/keys/${k.id}`,{method:"DELETE"}).then(()=>reload());}} className="px-2.5 py-1 rounded-full bg-black text-red-400 text-xs border border-red-500/20">Del</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[22px] glass p-5">
        <h3 className="font-bold">Пользователи ({users.length}) — назначить модераторов</h3>
        <p className="text-xs text-white/40">Только админы могут выдавать роли • команды модеров: /mute /ban /warn /banip</p>
        <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[400px] overflow-y-auto">
          {users.map(u=>(
            <div key={u.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-3">
              <img src={u.avatarUrl||"/lobok.jpg"} className="w-9 h-9 rounded-full object-cover" alt="" />
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-bold truncate ${u.role==="ADMIN"?"text-red-400":u.role==="MODERATOR"?"text-blue-400":"text-white"}`}>{u.username}</div>
                <div className="text-xs text-white/40">{u.role} {u.isBanned?"BANNED":""} {u.isMuted?"MUTED":""}</div>
              </div>
              <select value={u.role} onChange={e=>setRole(u.id,e.target.value)} className="text-xs px-2 py-1 rounded-full bg-[#1a1a2e] border border-white/10">
                <option value="USER">USER</option>
                <option value="MODERATOR">MODERATOR</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
