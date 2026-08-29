import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const forClient = url.searchParams.get("client") === "1";

  // log download
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  await prisma.downloadStat.create({ data: { ip, version: forClient ? "client" : "launcher" } }).catch(() => {});

  // find latest version
  const ver = await prisma.launcherVersion.findFirst({
    where: { forClient, isLatest: true },
    orderBy: { createdAt: "desc" },
  });

  const downloadUrl = ver?.downloadUrl;

  if (downloadUrl && downloadUrl.startsWith("http")) {
    return NextResponse.redirect(downloadUrl);
  }

  // No download URL set — show a helpful page instead of broken redirect
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Скачивание — Lobok Client</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0a0a14; color: #c8c8d7; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: rgba(22,22,40,0.8); border: 1px solid rgba(80,70,130,0.3); border-radius: 20px; padding: 48px; max-width: 480px; text-align: center; }
    h1 { font-size: 24px; color: #8c78c8; margin-bottom: 12px; }
    p { color: #6e6e87; margin-bottom: 20px; line-height: 1.6; }
    .version { display: inline-block; background: rgba(140,120,200,0.15); border: 1px solid rgba(140,120,200,0.3); padding: 6px 16px; border-radius: 20px; font-size: 13px; color: #8c78c8; margin-bottom: 24px; }
    a.btn { display: inline-block; padding: 14px 32px; background: #8c78c8; color: #fff; text-decoration: none; border-radius: 12px; font-weight: 600; transition: background 0.2s; }
    a.btn:hover { background: #a090d8; }
    .note { font-size: 12px; color: #4a4a60; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Lobok Client</h1>
    <div class="version">Версия: ${ver?.version || "1.0.0"}</div>
    <p>${forClient ? "Клиент для Minecraft 1.16.5" : "Лаунчер Lobok Client"}<br>
    ${ver?.changelog || "Автообновление, привязка ключа к аккаунту."}</p>
    <a href="/" class="btn">Вернуться на сайт</a>
    <div class="note">Если скачивание не началось — обратитесь в поддержку</div>
  </div>
</body>
</html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
