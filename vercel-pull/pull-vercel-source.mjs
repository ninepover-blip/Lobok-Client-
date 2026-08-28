#!/usr/bin/env node
/**
 * pull-vercel-source.mjs
 * ----------------------
 * Скачивает ИСХОДНЫЙ КОД деплоя с Vercel (вкладка "Source" в дашборде)
 * в локальную папку, чтобы с ним можно было работать в opencode / VS Code.
 *
 * Зависимостей нет — нужен только Node.js 18+ (встроенный fetch).
 *
 * Использование:
 *   set VERCEL_TOKEN=xxxxx            (Windows CMD)
 *   $env:VERCEL_TOKEN="xxxxx"         (PowerShell)
 *   export VERCEL_TOKEN=xxxxx         (bash / macOS / Linux)
 *
 *   node pull-vercel-source.mjs <deployment> [папка-назначения] [опции]
 *
 * <deployment> — одно из:
 *   - ID из адреса дашборда:  2G1XCQUCBH8xje1V2CPYJTPtD3s4
 *   - полный ID:              dpl_2G1XCQUCBH8xje1V2CPYJTPtD3s4
 *   - домен деплоя:           lobok-client.vercel.app
 *   - целиком URL дашборда:   https://vercel.com/team/project/2G1XC.../source
 *
 * Опции:
 *   --team=<slug|team_id>   команда/скоуп (например --team=123-70f4)
 *   --token=<token>         токен вместо переменной окружения
 *   --keep-root             не срезать корневую папку "src" из путей
 *   --list                  только показать дерево файлов, ничего не скачивать
 *   --concurrency=<n>       параллельных загрузок (по умолчанию 8)
 */

import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";

const API = "https://api.vercel.com";

// ---------------------------------------------------------------- аргументы
const rawArgs = process.argv.slice(2);
const flags = {};
const positional = [];
for (const a of rawArgs) {
  if (a.startsWith("--")) {
    const [k, v] = a.slice(2).split("=");
    flags[k] = v === undefined ? true : v;
  } else {
    positional.push(a);
  }
}

if (flags.help || flags.h || positional.length === 0) {
  console.log(
    `
Скачивание исходников деплоя Vercel
-----------------------------------
  node pull-vercel-source.mjs <deployment> [папка] [--team=slug] [--token=xxx]
                              [--keep-root] [--list] [--concurrency=8]

Примеры:
  node pull-vercel-source.mjs 2G1XCQUCBH8xje1V2CPYJTPtD3s4 lobok-client --team=123-70f4
  node pull-vercel-source.mjs lobok-client.vercel.app ./lobok-client
  node pull-vercel-source.mjs dpl_2G1XCQ... --list

Токен: https://vercel.com/account/settings/tokens  (scope = ваша команда)
`.trim()
  );
  process.exit(positional.length === 0 ? 1 : 0);
}

const TOKEN = flags.token || process.env.VERCEL_TOKEN;
if (!TOKEN) {
  console.error(
    "❌ Нет токена.\n" +
      "   Создайте его тут: https://vercel.com/account/settings/tokens\n" +
      '   Потом:  set VERCEL_TOKEN=xxxxx   (CMD)\n' +
      '           $env:VERCEL_TOKEN="xxxxx"  (PowerShell)\n' +
      "           export VERCEL_TOKEN=xxxxx  (bash)\n" +
      "   Или передайте через --token=xxxxx"
  );
  process.exit(1);
}

const TEAM = flags.team || process.env.VERCEL_TEAM || null;
const CONCURRENCY = Number(flags.concurrency) > 0 ? Number(flags.concurrency) : 8;

/** Достаём идентификатор деплоя из того, что дал пользователь. */
function normalizeDeployment(input) {
  let v = String(input).trim();

  // Целиком скопированный URL дашборда:
  // https://vercel.com/<team>/<project>/<deploymentId>/source?f=...
  const dash = v.match(/vercel\.com\/([^/]+)\/([^/]+)\/([A-Za-z0-9]{20,})/);
  if (dash) return { id: `dpl_${dash[3]}`, teamFromUrl: dash[1] };

  // Просто URL сайта
  v = v.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  if (v.startsWith("dpl_")) return { id: v, teamFromUrl: null };
  // Голый ID из адресной строки дашборда (без точек — значит не домен)
  if (/^[A-Za-z0-9]{20,}$/.test(v) && !v.includes("."))
    return { id: `dpl_${v}`, teamFromUrl: null };

  return { id: v, teamFromUrl: null }; // домен вида project.vercel.app
}

const { id: rawDeployment, teamFromUrl } = normalizeDeployment(positional[0]);
const team = TEAM || teamFromUrl;
const destDir = path.resolve(positional[1] || "vercel-source");

// ------------------------------------------------------------------- helpers
function withScope(pathname) {
  if (!team) return pathname;
  const key = String(team).startsWith("team_") ? "teamId" : "slug";
  return pathname + (pathname.includes("?") ? "&" : "?") + `${key}=${encodeURIComponent(team)}`;
}

async function api(pathname, { raw = false, retries = 3 } = {}) {
  const url = API + withScope(pathname);
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      if (res.status === 429) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      if (!res.ok) {
        const body = await res.text();
        const err = new Error(`HTTP ${res.status} ${res.statusText} — ${url}\n${body.slice(0, 400)}`);
        err.status = res.status;
        // 401/403/404 повторять смысла нет
        if ([400, 401, 403, 404].includes(res.status)) throw err;
        lastErr = err;
        await sleep(800 * (attempt + 1));
        continue;
      }
      return raw ? Buffer.from(await res.arrayBuffer()) : await res.json();
    } catch (e) {
      if (e.status && [400, 401, 403, 404].includes(e.status)) throw e;
      lastErr = e;
      await sleep(800 * (attempt + 1));
    }
  }
  throw lastErr;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Дерево Vercel -> плоский список {name, type, uid} */
function flatten(node, prefix = "") {
  const out = [];
  const name = prefix ? `${prefix}/${node.name}` : node.name;
  out.push({ ...node, name });
  for (const child of node.children || []) out.push(...flatten(child, name));
  return out;
}

async function resolveDeploymentId(input) {
  if (input.startsWith("dpl_")) return input;
  const info = await api(`/v13/deployments/${encodeURIComponent(input)}`);
  return info.id;
}

// ---------------------------------------------------------------------- main
async function main() {
  console.log(`🔎 Деплой: ${rawDeployment}${team ? `   (команда: ${team})` : ""}`);

  const deploymentId = await resolveDeploymentId(rawDeployment);
  if (deploymentId !== rawDeployment) console.log(`   → id: ${deploymentId}`);

  const tree = await api(`/v6/deployments/${deploymentId}/files`);
  if (!Array.isArray(tree)) throw new Error("Неожиданный ответ API: " + JSON.stringify(tree).slice(0, 300));

  let entries = tree.flatMap((n) => flatten(n));

  // Дашборд показывает исходники внутри корневой папки "src".
  const hasSrcRoot = tree.some((n) => n.name === "src" && n.type === "directory");
  const stripRoot = hasSrcRoot && !flags["keep-root"];
  if (stripRoot) {
    entries = entries
      .filter((e) => e.name === "src" || e.name.startsWith("src/"))
      .map((e) => ({ ...e, name: e.name.replace(/^src\/?/, "") }))
      .filter((e) => e.name.length > 0);
  }

  const files = entries.filter((e) => e.type === "file");
  const dirs = entries.filter((e) => e.type === "directory");

  if (flags.list) {
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      console.log(`${e.type === "directory" ? "📁" : "📄"} ${e.name}`);
    }
    console.log(`\nВсего: ${files.length} файлов, ${dirs.length} папок`);
    return;
  }

  await fsp.mkdir(destDir, { recursive: true });
  for (const d of dirs) await fsp.mkdir(path.join(destDir, d.name), { recursive: true });

  console.log(`⬇  Качаю ${files.length} файлов в ${destDir}\n`);

  let done = 0;
  let failed = 0;
  const queue = [...files];

  async function worker() {
    while (queue.length) {
      const file = queue.shift();
      const target = path.join(destDir, file.name);
      try {
        await fsp.mkdir(path.dirname(target), { recursive: true });
        const body = await api(`/v7/deployments/${deploymentId}/files/${file.uid}`, { raw: true });

        // API отдаёт либо {"data": "<base64>"}, либо сырой файл.
        let buf = body;
        const head = body.subarray(0, 12).toString("utf8");
        if (head.trimStart().startsWith('{"data"')) {
          try {
            const parsed = JSON.parse(body.toString("utf8"));
            if (typeof parsed.data === "string") buf = Buffer.from(parsed.data, "base64");
          } catch {
            /* оставляем как есть */
          }
        }
        await fsp.writeFile(target, buf);
        done++;
        process.stdout.write(`\r   ${done}/${files.length}  ${file.name.slice(-60).padEnd(60)}`);
      } catch (e) {
        failed++;
        console.error(`\n   ⚠  ${file.name}: ${e.message.split("\n")[0]}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length || 1) }, worker));

  console.log(`\n\n✅ Готово: ${done} файлов${failed ? `, ошибок: ${failed}` : ""}`);
  console.log(`📂 ${destDir}`);
  console.log(`\nДальше:`);
  console.log(`   cd "${destDir}"`);
  console.log(`   npm install`);
  console.log(`   git init && git add -A && git commit -m "recovered from vercel"`);
  console.log(`   opencode          # теперь он видит файлы`);
}

main().catch((e) => {
  console.error("\n❌ " + (e.stack || e.message));
  if (e.status === 403 || e.status === 401) {
    console.error(
      "\nПодсказка: токен без доступа к команде. Пересоздайте токен, выбрав scope\n" +
        "вашей команды, и/или добавьте --team=<slug из URL, напр. 123-70f4>"
    );
  }
  if (e.status === 404) {
    console.error(
      "\nПодсказка: дерево файлов доступно не всегда.\n" +
        "Если деплой создан из Git-репозитория — исходники лежат в GitHub/GitLab,\n" +
        "проще склонировать оттуда (Project → Settings → Git)."
    );
  }
  process.exit(1);
});
