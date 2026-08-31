import Link from "next/link";
import {
  IconLock,
  IconCard,
  IconKey,
  IconShield,
  IconTelegram,
  IconCheck,
} from "@/components/Icons";

export const metadata = {
  title: "Политика конфиденциальности и условия — Lobok Client",
  description:
    "Какие данные собирает Lobok Client, как хранятся, правила возврата и отзыва ключей.",
};

const UPDATED = "28 августа 2026";

function Section({
  id,
  n,
  title,
  icon,
  children,
}: {
  id: string;
  n: number;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-lg font-black flex items-center gap-2 mb-3">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white/5 text-white/70 text-xs font-black shrink-0">
          {n}
        </span>
        {icon}
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-white/70">{children}</div>
    </section>
  );
}

/** Красная плашка — самое важное, что чаще всего оспаривают. */
function Danger({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/[0.07] p-3.5 flex gap-2.5">
      <span className="text-red-300 shrink-0 mt-0.5">
        <IconShield size={16} />
      </span>
      <div className="text-sm text-red-100/90 space-y-2">{children}</div>
    </div>
  );
}

function Ok({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/[0.04] p-3.5 flex gap-2.5">
      <span className="text-white/70 shrink-0 mt-0.5">
        <IconCheck size={16} />
      </span>
      <div className="text-sm text-white/70 space-y-2">{children}</div>
    </div>
  );
}

export default function LegalPage() {
  const toc = [
    ["data", "Какие данные мы собираем"],
    ["why", "Зачем и на каком основании"],
    ["share", "Кому передаём"],
    ["store", "Сколько храним"],
    ["refund", "Возврат средств"],
    ["revoke", "Отзыв и блокировка ключа"],
    ["rules", "Правила использования"],
    ["rights", "Твои права"],
    ["security", "Безопасность"],
    ["contact", "Связь с нами"],
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14">
      {/* шапка */}
      <div className="rounded-[24px] glass p-6 sm:p-8 mb-5">
        <div className="flex items-center gap-2 text-white/70 text-xs font-bold uppercase tracking-wider mb-2">
          <IconLock size={14} /> Документ
        </div>
        <h1 className="text-3xl sm:text-4xl font-black leading-tight">
          Политика конфиденциальности
          <br />
          <span className="text-white/50 text-2xl sm:text-3xl">и условия использования</span>
        </h1>
        <p className="text-sm text-white/50 mt-3">
          Обновлено: {UPDATED} · Действует для сайта и лаунчера Lobok Client
        </p>
      </div>

      {/* краткая выжимка */}
      <div className="rounded-[22px] glass p-5 sm:p-6 mb-5">
        <h2 className="font-black mb-3">Если коротко</h2>
        <ul className="space-y-2 text-sm text-white/70">
          <li className="flex gap-2">
            <span className="text-white/60 shrink-0">→</span>
            <span>
              Мы не просим ни имя, ни email, ни телефон. Только логин и пароль.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-white/60 shrink-0">→</span>
            <span>
              Данные карты через нас <b className="text-white">не проходят</b> — оплата идёт
              напрямую в платёжный сервис.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-red-400 shrink-0">→</span>
            <span>
              <b className="text-white">После активации ключа возврат невозможен</b> — товар
              цифровой.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-red-400 shrink-0">→</span>
            <span>
              Передал ключ другому — <b className="text-white">ключ удаляется без возврата денег</b>.
            </span>
          </li>
        </ul>
      </div>

      {/* оглавление */}
      <nav className="rounded-[22px] glass p-5 mb-5">
        <div className="text-xs text-white/40 mb-2.5 uppercase tracking-wider font-bold">
          Содержание
        </div>
        <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          {toc.map(([id, title], i) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className="text-white/60 hover:text-white/70 transition-colors"
              >
                <span className="text-white/30 mr-1.5">{i + 1}.</span>
                {title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="rounded-[22px] glass p-6 sm:p-8 space-y-9">
        <Section id="data" n={1} title="Какие данные мы собираем" icon={<IconLock size={16} />}>
          <p>
            Мы собираем минимум — только то, без чего сервис не работает. Настоящее имя, email,
            телефон и адрес мы <b className="text-white">не запрашиваем никогда</b>.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-white/40 text-xs uppercase tracking-wider">
                  <th className="pb-2 pr-4 font-bold">Данные</th>
                  <th className="pb-2 font-bold">Зачем</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {[
                  ["Логин", "Идентификация в аккаунте, чате, привязка ключа"],
                  ["Пароль", "Хранится в виде bcrypt-хэша. Мы не знаем твой пароль и не можем его прочитать"],
                  ["IP-адрес", "Защита от накрутки фри-ключей, блокировка нарушителей"],
                  ["HWID (идентификатор устройства)", "Привязка ключа к одному компьютеру — защита от перепродажи"],
                  ["Telegram ID и @username", "Только если сам привязал: 2FA, восстановление пароля, уведомления о ключах"],
                  ["Аватар", "Ссылка на изображение, если указал"],
                  ["Игровая статистика", "Время в игре, IP серверов, сессии — для профиля и общей статистики"],
                  ["История заказов", "Метка платежа, сумма, способ, статус — подтверждение покупки"],
                  ["Сообщения в чате и тикеты", "Работа чата и поддержки"],
                ].map(([a, b]) => (
                  <tr key={a} className="border-t border-white/5">
                    <td className="py-2 pr-4 text-white/90 font-medium">{a}</td>
                    <td className="py-2 text-white/60">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Ok>
            <p>
              <b>Данные банковских карт мы не получаем и не храним.</b> Номер карты, срок и CVV
              вводятся на стороне платёжного сервиса. К нам приходит только факт «оплачено» и метка
              заказа.
            </p>
          </Ok>
        </Section>

        <Section id="why" n={2} title="Зачем и на каком основании">
          <p>Данные используются исключительно для работы сервиса:</p>
          <ul className="space-y-1.5 pl-1">
            {[
              "выдача, продление и проверка лицензионных ключей",
              "вход в аккаунт и двухфакторная защита",
              "приём оплаты и подтверждение заказов",
              "поддержка пользователей и разбор спорных ситуаций",
              "защита от мошенничества, накрутки и обхода блокировок",
              "общая статистика сайта — в обезличенном виде",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <span className="text-white/60 shrink-0">•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <p>
            Мы <b className="text-white">не продаём и не передаём</b> данные третьим лицам в
            рекламных целях и не занимаемся рассылками.
          </p>
        </Section>

        <Section id="share" n={3} title="Кому передаём">
          <p>Только тем сервисам, без которых сайт не работает:</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <tbody>
                {[
                  ["Vercel", "хостинг сайта", "IP, технические логи запросов"],
                  ["Neon (PostgreSQL)", "база данных", "всё перечисленное в п. 1"],
                  ["Telegram", "2FA, уведомления, бот", "Telegram ID — только у привязавших"],
                  ["ЮMoney / Монобанк", "приём оплаты", "сумма, метка заказа"],
                ].map(([a, b, c]) => (
                  <tr key={a} className="border-t border-white/5">
                    <td className="py-2 pr-4 text-white/90 font-medium whitespace-nowrap">{a}</td>
                    <td className="py-2 pr-4 text-white/50">{b}</td>
                    <td className="py-2 text-white/60">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-white/40">
            Данные также могут быть переданы по официальному запросу уполномоченных органов, если это
            требуется по закону.
          </p>
        </Section>

        <Section id="store" n={4} title="Сколько храним">
          <ul className="space-y-1.5 pl-1">
            {[
              ["Аккаунт и его данные", "пока аккаунт существует"],
              ["История заказов", "3 года — для разбора споров по оплате"],
              ["Игровая статистика и сессии", "1 год"],
              ["Логи IP", "6 месяцев"],
              ["Коды 2FA и восстановления", "5–10 минут, затем удаляются"],
            ].map(([a, b]) => (
              <li key={a} className="flex gap-2">
                <span className="text-white/60 shrink-0">•</span>
                <span>
                  <b className="text-white/90">{a}</b> — {b}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="refund" n={5} title="Возврат средств" icon={<IconCard size={16} />}>
          <Danger>
            <p>
              <b>Ключ, который уже активирован, возврату и обмену не подлежит.</b>
            </p>
            <p>
              Лицензионный ключ — цифровой товар. В момент активации он привязывается к аккаунту и
              устройству, и «вернуть» его технически невозможно: доступ к софту уже получен.
            </p>
          </Danger>

          <p className="font-bold text-white/90 pt-1">Когда вернём деньги</p>
          <ul className="space-y-1.5 pl-1">
            {[
              "Оплата прошла, но ключ не пришёл — и это наша техническая ошибка.",
              "Оплатил дважды один и тот же заказ — вернём лишний платёж.",
              "Ключ куплен, но ещё не активирован — возврат в течение 24 часов с момента покупки.",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <span className="text-white/70 shrink-0">✓</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>

          <p className="font-bold text-white/90 pt-1">Когда не вернём</p>
          <ul className="space-y-1.5 pl-1">
            {[
              "Ключ активирован — независимо от того, сколько ты им пользовался.",
              "«Передумал», «не понравилось», «купил не тот тариф».",
              "Аккаунт в игре забанен античитом. Мы не даём и не можем дать гарантию, что тебя не забанят — это риск, который ты принимаешь сам.",
              "Ключ заблокирован за нарушение правил (см. п. 6).",
              "Софт не запускается из-за твоего антивируса, кривой сборки игры, слабого железа или настроек системы — если на нашей стороне всё работает.",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <span className="text-red-400 shrink-0">✕</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>

          <p className="font-bold text-white/90 pt-1">Если лаунчер или софт не работает</p>
          <p>
            Сначала пишем в поддержку — <b className="text-white">до</b> требования возврата. Мы
            обязаны попытаться починить: помочь с настройкой, выдать другую сборку или заменить
            ключ.
          </p>
          <p>
            Если проблема на нашей стороне и мы <b className="text-white">не устранили её за 72
            часа</b> — возвращаем деньги за неиспользованный период или продлеваем ключ на срок
            простоя. Выбор за тобой.
          </p>
          <p className="text-xs text-white/40">
            Возврат делается тем же способом, которым была оплата, в течение 10 рабочих дней.
            Комиссию платёжной системы за перевод мы не компенсируем.
          </p>
        </Section>

        <Section id="revoke" n={6} title="Отзыв и блокировка ключа" icon={<IconKey size={16} />}>
          <Danger>
            <p>
              <b>Ключ выдаётся одному человеку и работает на одном устройстве.</b>
            </p>
            <p>
              Если ключ передан, продан, выложен в открытый доступ или используется с нескольких
              компьютеров — он <b>удаляется без возврата денег</b>. Это не штраф и не спор, это
              условие покупки.
            </p>
          </Danger>

          <p className="font-bold text-white/90 pt-1">Ключ отзывается, если</p>
          <ul className="space-y-1.5 pl-1">
            {[
              "передал, продал или подарил ключ другому человеку",
              "выложил ключ в чат, на форум, в видео или слил в паблик",
              "используешь один ключ на нескольких устройствах или аккаунтах",
              "пытался обойти привязку к HWID, подделать ответ сервера или вскрыть лаунчер",
              "накручивал бесплатные ключи через VPN, несколько аккаунтов или смену IP",
              "оформил чарджбэк или отозвал платёж после получения ключа",
              "оскорбления, угрозы, реклама чужих читов в нашем чате и поддержке",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <span className="text-red-400 shrink-0">✕</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>

          <p>
            При отзыве ключ переходит в статус <span className="font-mono text-xs bg-white/10 px-1.5 py-0.5 rounded">REVOKED</span>{" "}
            и перестаёт проходить проверку в лаунчере. Аккаунт при грубых нарушениях блокируется.
          </p>
          <p>
            Считаешь, что ключ отозвали ошибочно — пиши в поддержку. Если мы ошиблись, ключ вернём и
            продлим на потерянные дни.
          </p>
        </Section>

        <Section id="rules" n={7} title="Правила использования">
          <ul className="space-y-1.5 pl-1">
            {[
              "Сервис предназначен для лиц старше 16 лет.",
              "Один аккаунт — один человек. Мультиаккаунты для накрутки фри-ключей запрещены.",
              "Бесплатный ключ выдаётся не чаще одного раза в сутки и только после подписки на Discord.",
              "Запрещено декомпилировать, распространять и перепродавать наш софт.",
              "Мы можем изменить состав функций, цены и тарифы — уже оплаченный период это не затрагивает.",
              "Мы не связаны с Mojang, Microsoft и администрациями игровых серверов.",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <span className="text-white/60 shrink-0">•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>

          <Danger>
            <p>
              <b>Про баны в игре.</b> Использование стороннего софта нарушает правила большинства
              серверов. Блокировка игрового аккаунта — твой личный риск. Мы не компенсируем бан ни
              деньгами, ни продлением ключа.
            </p>
          </Danger>
        </Section>

        <Section id="rights" n={8} title="Твои права">
          <p>В любой момент ты можешь:</p>
          <ul className="space-y-1.5 pl-1">
            {[
              "посмотреть свои данные — они видны в кабинете и профиле",
              "изменить логин, пароль и аватар",
              "отвязать Telegram — 2FA при этом отключится",
              "удалить аккаунт: напиши в поддержку, удалим в течение 7 дней",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <span className="text-white/60 shrink-0">•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-white/40">
            При удалении аккаунта история платежей сохраняется в обезличенном виде — этого требует
            учёт финансовых операций. Активные ключи аннулируются, деньги за них не возвращаются.
          </p>
        </Section>

        <Section id="security" n={9} title="Безопасность">
          <ul className="space-y-1.5 pl-1">
            {[
              "Пароли хранятся хэшированными (bcrypt) — восстановить исходный пароль невозможно.",
              "Весь трафик идёт по HTTPS.",
              "Доступна двухфакторная аутентификация через Telegram — включи её в кабинете.",
              "Коды входа и восстановления живут 5–10 минут и одноразовые.",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <span className="text-white/60 shrink-0">•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <p>
            Абсолютной защиты не существует. Не используй пароль от Lobok Client на других сайтах и
            включи 2FA — это снимает большинство рисков.
          </p>
        </Section>

        <Section id="contact" n={10} title="Связь с нами" icon={<IconTelegram size={16} />}>
          <p>По любым вопросам — возврат, отзыв ключа, удаление аккаунта, жалобы:</p>
          <ul className="space-y-1.5 pl-1">
            <li className="flex gap-2">
              <span className="text-white/60 shrink-0">•</span>
              <span>
                Поддержка на сайте —{" "}
                <Link href="/support" className="text-white/70 hover:underline">
                  /support
                </Link>{" "}
                (отвечаем быстрее всего)
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-white/60 shrink-0">•</span>
              <span>
                Telegram-бот —{" "}
                <a
                  href="https://t.me/LobokClient_bot"
                  target="_blank"
                  rel="noopener"
                  className="text-white/70 hover:underline"
                >
                  @LobokClient_bot
                </a>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-white/60 shrink-0">•</span>
              <span>
                Discord —{" "}
                <a
                  href="https://discord.gg/ASXzHaQfvj"
                  target="_blank"
                  rel="noopener"
                  className="text-white/70 hover:underline"
                >
                  discord.gg/ASXzHaQfvj
                </a>
              </span>
            </li>
          </ul>
          <p className="text-xs text-white/40 pt-2">
            Срок ответа — до 48 часов. Мы можем обновлять этот документ; дата обновления указана
            вверху страницы. Продолжая пользоваться сервисом, ты принимаешь актуальную редакцию.
          </p>
        </Section>
      </div>

      <p className="text-center text-xs text-white/30 mt-6">
        Регистрируясь и оплачивая ключ, ты подтверждаешь, что прочитал и принял эти условия.
      </p>
    </div>
  );
}
