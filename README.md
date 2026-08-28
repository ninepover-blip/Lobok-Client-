# Lobok Client — сайт для продажи HvH чита

**URL:** https://lobok-client.vercel.app  
**Стиль:** Muted Violet Cyber / Dark Minimal Glass  
**База:** Neon PostgreSQL • Prisma  
**Боты:** Telegram (2FA + выдача ключей) токен `8936060898:AAH...`

## Админы ( сразу 2 )
- **LayF** / `sashalordan` → ADMIN (градиент фиолетовый-синий)
- **Vybe** / `LobokClient` → ADMIN

Модераторов назначают админы в `/admin` → роль `MODERATOR` (синяя галочка ✓).

## Установка локально

```bash
npm install
npx prisma generate
npx prisma db push
npx prisma db seed   # создаст LayF/Vybe + версии лаунчера
npm run dev
```

Env уже лежит в `C:\Users\11\Desktop\lobok-client.env` и `import.env` (копия). Скопируй в `.env` проекта.

## Функции

- **Регистрация/Авторизация** (`/auth/login`, `/auth/register`), JWT cookie, проверка бана/IP
- **2FA по Telegram** — в кабинете `Привязать Telegram` → `https://t.me/LobokClientBot?start=link_<userId>` → вкл `is2FAEnabled`. Код 6 цифр на 5 мин, бот шлёт сообщение. Также `/api/telegram/2fa/request`
- **Смена логина/пароля/аватара** — `PUT /api/auth/settings` (из кабинета)
- **Кабинеты** — `/cabinet` (свой), `/profile/[username]` (публичный). Роли: USER серый, MODERATOR толстый синий + синяя галочка, ADMIN толстый красный + градиент аватарка
- **Аватарки** — поле `avatarUrl`, по умолчанию `/lobok.jpg`
- **Новости** — POST `/api/news` только админы (фото/видео массив `mediaUrls`), GET `/news`
- **Глобальный чат** — `/chat` → `GET/POST /api/chat/global`. Команды модеров:
  ```
  /mute @user 10m / 2h / 7d
  /ban @user 30d
  /warn @user 7d   (3 варна за месяц → автобан 30d)
  /banip 1.2.3.4 30d
  /unban @user , /unmute @user
  ```
  Сообщения админов/модеров сразу `isPinned=true` (закреп). Удаление — `DELETE /api/chat/message/[id]` модерами
- **Саппорт** — `/support`. `GET /api/support/tickets` (юзер видит только свои, модеры — все), `POST /api/support/tickets`, `POST /api/support/tickets/[id]` (сообщения видят только автор + сапорты)
- **Ключи** `Lobok-XXXXXXXXXXXX-client`
  - Цены: 30д 100₽/50₴ • 90д 250₽/125₴ • навсегда 400₽/200₴
  - Привязка `@USER + IP + HWID`, 1 ключ 1 устройство, при передаче HWID mismatch → ошибка, админ может изъять/отозвать
  - Админ-панель `/admin` только для ADMIN: генерация по @username или пустой, `POST /api/keys`, `PUT /api/keys/[id]` (revoke/unrevoke/regenerate/bind/unbind), `GET /api/keys`
  - Кабинет `/cabinet` → `GET /api/keys?mine=1`
  - Валидация для лаунчера `POST /api/keys/validate {key, username, hwid, ip}`
- **Фри-ключ** `POST /api/free-key/claim` — 1 в день на весь сайт, проверка `discordConfirmed` + ссылка https://discord.gg/ASXzHaQfvj → `GET /api/free-key/claim` статус.
- **Статистика** `/stats` — скачиваний `POST /api/stats/download`, серверов `POST /api/stats/server {ip, username}` → `GET /api/stats/server` топ. Главная тянет `/api/stats`
- **Лаунчер** — скачивание `GET /api/launcher/download` (логирует DownloadStat), версия `GET /api/launcher/version`, обновление `POST /api/launcher/update` (админ)
- **Боты Telegram** — `/api/bot/telegram` webhook
  - `/start link_<id>` — привязка
  - `/2fa` — код
  - `/getkey @user D30` — выдача (только ADMIN)

## Деплой на Vercel

Проект уже настроен для `https://lobok-client.vercel.app`.

```bash
vercel --prod
# или через GitHub integration
vercel env add DATABASE_URL
# добавь все переменные из import.env
```

Env на Vercel — импорт файла `import.env` лежащего на рабочем столе.

## Структура
- `prisma/schema.prisma` — User, LicenseKey, News, ChatMessage, SupportTicket, Punishment, ServerStat, DownloadStat, FreeKeyClaim, LauncherVersion
- `src/lib/auth.ts` — JWT, bcrypt, generateKey, parseDuration
- `src/app/page.tsx` — лендинг с ценами, статистикой, фри-ключом, скачиванием
- `src/components/Navbar.tsx` + `globals.css` — Muted Violet Glass

## Import .env
Файл сохранён на рабочем столе:
- `C:\Users\11\Desktop\lobok-client.env`
- `C:\Users\11\Desktop\import.env` (для Vercel → Settings → Environment Variables → Import .env)

Не коммить `.env` (в .gitignore).
