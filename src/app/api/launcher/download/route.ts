import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const forClient = url.searchParams.get("client") === "1";
  const type = forClient ? "mod" : "launcher";

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  await prisma.downloadStat.create({ data: { ip, version: type } }).catch(() => {});

  const ver = await prisma.release.findFirst({
    where: { type, isLatest: true, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  const downloadUrl = ver?.filePath;

  if (downloadUrl && downloadUrl.startsWith("http")) {
    return NextResponse.redirect(downloadUrl);
  }

  return new NextResponse(
    `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Скачивание — Lobok Client</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0a0a0a; color: #c8c8d7; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: rgba(22,22,22,0.8); border: 1px solid rgba(80,80,80,0.3); border-radius: 20px; padding: 48px; max-width: 480px; text-align: center; }
    h1 { font-size: 24px; color: #e0e0e0; margin-bottom: 12px; }
    p { color: #6e6e6e; margin-bottom: 20px; line-height: 1.6; }
    .version { display: inline-block; background: rgba(200,200,200,0.1); border: 1px solid rgba(200,200,200,0.2); padding: 6px 16px; border-radius: 20px; font-size: 13px; color: #aaa; margin-bottom: 24px; }
    a.btn { display: inline-block; padding: 14px 32px; background: #e0e0e0; color: #0a0a0a; text-decoration: none; border-radius: 12px; font-weight: 600; transition: background 0.2s; }
    a.btn:hover { background: #ffffff; }
    .note { font-size: 12px; color: #4a4a4a; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Lobok Client</h1>
    <div class="version">Версия: ${ver?.version || "1.0.0"}</div>
    <p>${forClient ? "Клиент для Minecraft 1.16.5" : "Лаунчер Lobok Client"}<br>
    ${"Автообновление, привязка ключа к аккаунту."}</p>
    <a href="/" class="btn">Вернуться на сайт</a>
    <div class="note">Если скачивание не началось — обратитесь в поддержку</div>
  </div>
</body>
</html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
