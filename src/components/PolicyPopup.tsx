"use client";
import { useState, useEffect } from "react";

export default function PolicyPopup() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem("policy_accepted");
    if (!accepted) setShow(true);
  }, []);

  const accept = () => {
    localStorage.setItem("policy_accepted", "1");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="glass-strong rounded-2xl p-6 max-w-lg mx-4 space-y-4 border border-white/10">
        <h3 className="font-bold text-lg">Политика конфиденциальности</h3>
        <div className="text-sm text-white/60 space-y-2 max-h-60 overflow-y-auto">
          <p><b>1. Сбор данных.</b> Мы собираем: имя пользователя, email, IP-адрес, HWID (аппаратный идентификатор), данные об использовании клиента.</p>
          <p><b>2. Использование.</b> Данные используются для: идентификации аккаунта, привязки ключа к устройству, обеспечения безопасности, статистики использования.</p>
          <p><b>3. Хранение.</b> Данные хранятся на защищённых серверах. Мы не продаём и не передаём данные третьим лицам.</p>
          <p><b>4. Cookies.</b> Сайт использует cookies для авторизации и сессий.</p>
          <p><b>5. Удаление.</b> Вы можете запросить удаление аккаунта и всех данных через поддержку.</p>
          <p><b>6. Контакты.</b> По вопросам пишите в поддержку: discord.gg/ASXzHaQfvj</p>
        </div>
        <button
          onClick={accept}
          className="w-full py-3 rounded-full btn-primary text-white font-semibold"
        >
          Принять и продолжить
        </button>
      </div>
    </div>
  );
}
