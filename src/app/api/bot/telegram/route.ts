import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendTelegramMessage, generate2FACode } from "@/lib/telegram";
import { generateKey } from "@/lib/auth";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

export async function POST(req: NextRequest){
  const body = await req.json();
  // Telegram webhook update
  const message = body.message;
  if(!message) return NextResponse.json({ ok:true });
  const chatId = String(message.chat.id);
  const text: string = message.text || "";
  const fromUsername = message.from?.username || "";

  if(text.startsWith("/start")){
    // link code: /start link_<userId>
    const parts = text.split(" ");
    const arg = parts[1]||"";
    if(arg.startsWith("link_")){
      const userId = arg.replace("link_","");
      const user = await prisma.user.findUnique({ where:{ id:userId }});
      if(user){
        await prisma.user.update({ where:{id:userId}, data:{ telegramId: chatId, telegramUsername: fromUsername }});
        await sendTelegramMessage(chatId, `✅ Telegram привязан к аккаунту <b>${user.username}</b>\nТеперь можешь включить 2FA на сайте.`);
      } else {
        await sendTelegramMessage(chatId, `❌ Пользователь не найден. Зайди на сайт и нажми "Привязать Telegram"`);
      }
    } else {
      await sendTelegramMessage(chatId, `👋 Привет! Я бот Lobok Client.\n\nКоманды:\n/link — привязать аккаунт (кнопка на сайте)\n/2fa — получить код\n/getkey — выдать ключ (только админ сайта должен быть авторизован через сайт, используй /auth)\n\nСайт: https://lobok-client.vercel.app`);
    }
    return NextResponse.json({ok:true});
  }

  if(text.startsWith("/2fa")){
    const user = await prisma.user.findFirst({ where:{ telegramId: chatId }});
    if(!user) { await sendTelegramMessage(chatId, `❌ Сначала привяжи аккаунт на сайте → Настройки → Привязать Telegram`); return NextResponse.json({ok:true});}
    const code = generate2FACode();
    await prisma.user.update({ where:{id:user.id}, data:{ twoFACode:code, twoFACodeExpires:new Date(Date.now()+5*60*1000)}});
    await sendTelegramMessage(chatId, `🔐 Код 2FA: <b>${code}</b>\nДействует 5 минут.`);
    return NextResponse.json({ok:true});
  }

  if(text.startsWith("/getkey")){
    // admin-only key issuance via bot: must be ADMIN user linked
    const user = await prisma.user.findFirst({ where:{ telegramId: chatId }});
    if(!user || user.role!=="ADMIN"){
      await sendTelegramMessage(chatId, `❌ Только админ может выдавать ключи. Авторизуйся на сайте как LayF/Vybe и привяжи Telegram.`);
      return NextResponse.json({ok:true});
    }
    // parse: /getkey @username D30  or /getkey D90
    const parts = text.split(/\s+/);
    let username: string|null=null;
    let type="D30";
    for(const p of parts.slice(1)){
      if(p.startsWith("@")) username=p.replace("@","");
      else if(["D30","D90","FOREVER","FREE","30d","90d","forever"].includes(p.toUpperCase())) type=p.toUpperCase();
    }
    if(type==="30D") type="D30";
    if(type==="90D") type="D90";
    if(type==="FOREVER") type="FOREVER";
    const keyStr = generateKey();
    let durationDays:number|null=30, priceRub=100, priceUah=50, expiresAt:Date|null=new Date(Date.now()+30*86400000);
    if(type==="D90"){ durationDays=90; priceRub=250; priceUah=125; expiresAt=new Date(Date.now()+90*86400000); }
    if(type==="FOREVER"){ durationDays=null; priceRub=400; priceUah=200; expiresAt=null; }
    if(type==="FREE"){ durationDays=7; priceRub=0; priceUah=0; expiresAt=new Date(Date.now()+7*86400000); }
    let ownerId=null, ownerUsername=username;
    if(username){
      const u = await prisma.user.findUnique({ where:{ username }});
      if(u) ownerId=u.id;
    }
    const k = await prisma.licenseKey.create({ data:{ key:keyStr, type: type as any, status: ownerId?"ACTIVE":"UNUSED", durationDays, priceRub, priceUah, expiresAt, ownerId, ownerUsername, createdById: user.id, activatedAt: ownerId? new Date():null }});
    await sendTelegramMessage(chatId, `✅ Ключ создан:\n<code>${k.key}</code>\nТип: ${type}\nПривязан: ${ownerUsername||"— (не привязан)"}\nИстекает: ${expiresAt? expiresAt.toLocaleString("ru-RU"):"никогда"}`);
    return NextResponse.json({ok:true});
  }

  // default echo
  await sendTelegramMessage(chatId, `Не понял команду. Попробуй /2fa или /getkey @user D30`);
  return NextResponse.json({ok:true});
}

export async function GET(){
  // for setting webhook manually: GET /api/bot/telegram?setWebhook=1
  return NextResponse.json({ ok:true, bot: BOT_TOKEN? "configured":"missing token" });
}
