import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";

export default async function ProfilePage({ params }:{ params:Promise<{username:string}>}){
  const { username } = await params;
  const user = await prisma.user.findUnique({ where:{ username: decodeURIComponent(username) }});
  if(!user) notFound();
  const keys = await prisma.licenseKey.findMany({ where:{ ownerId: user.id }});
  const roleLabel = user.role==="ADMIN"?"ADMIN": user.role==="MODERATOR"?"MODERATOR":"USER";
  const roleClass = user.role==="ADMIN"?"text-red-500 font-black": user.role==="MODERATOR"?"text-blue-400 font-bold":"text-zinc-400";
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="rounded-[24px] glass p-6 flex gap-6 items-center">
        <img src={user.avatarUrl||"/lobok.jpg"} className="w-24 h-24 rounded-2xl object-cover border border-white/10" alt="" />
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${roleClass}`}>{user.username}</span>
            {user.role==="MODERATOR" && <span className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_#3b82f6]" title="синяя галочка модера" />}
            {user.role==="ADMIN" && <span className="w-3 h-3 rounded-full bg-gradient-to-r from-violet-600 to-blue-600 shadow-[0_0_10px_#7c5cff]" title="градиент админа" />}
          </div>
          <div className="mt-1 text-xs px-2.5 py-1 rounded-full inline-block border border-white/10 bg-white/5">{roleLabel}</div>
          <div className="text-xs text-white/40 mt-2">На сайте с {new Date(user.createdAt).toLocaleDateString("ru-RU")} • Ключей: {keys.length}</div>
        </div>
      </div>
      <div className="mt-4 rounded-[22px] glass p-5">
        <h3 className="font-bold">Ключи пользователя</h3>
        <div className="mt-3 space-y-2">
          {keys.length===0 && <div className="text-sm text-white/30">Нет ключей</div>}
          {keys.map(k=>(
            <div key={k.id} className="font-mono text-sm p-2 rounded-xl bg-white/[0.04] border border-white/5 flex justify-between">
              <span>{k.key}</span><span className="text-xs text-white/40">{k.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
