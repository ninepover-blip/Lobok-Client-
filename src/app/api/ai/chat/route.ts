import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const SYSTEM_PROMPT = "Ты — помощник Lobok Client. Отвечай на русском языке. Помогаешь с вопросами по лаунчеру, ключам, оплате, настройке клиента. Будь дружелюбным и кратким. Если не знаешь ответ — скажи что нужно обратиться в поддержку. Клиент работает на Minecraft 1.16.5, HvH, MetaHvH, обходит Matrix/Vulcan/AAC/Verus/Grim.";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

// g4f-compatible free endpoints (OpenAI-compatible API format)
const G4F_ENDPOINTS = [
  { url: "https://api.g4f.site/v1/chat/completions", model: "gpt-3.5-turbo" },
  { url: "https://api.pawan.krd/v1/chat/completions", model: "gpt-3.5-turbo" },
  { url: "https://free.chatgpt.tech/v1/chat/completions", model: "gpt-3.5-turbo" },
  { url: "https://api.openai-proxy.org/v1/chat/completions", model: "gpt-3.5-turbo" },
  { url: "https://chatgpt-api.openai.com/v1/chat/completions", model: "gpt-3.5-turbo" },
];

function generateConversationId(): string {
  return crypto.randomBytes(12).toString("hex");
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callOpenAI(messages: ChatMessage[]): Promise<string> {
  const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "Нет ответа от модели.";
}

async function callG4FEndpoint(
  messages: ChatMessage[],
  endpoint: { url: string; model: string }
): Promise<string> {
  const res = await fetch(endpoint.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: endpoint.model,
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`g4f error (${endpoint.url}): ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "Нет ответа от модели.";
}

async function getAIResponse(messages: ChatMessage[]): Promise<string> {
  // Try OpenAI API key first
  if (OPENAI_API_KEY) {
    try {
      return await callOpenAI(messages);
    } catch (e) {
      console.error("OpenAI failed, trying g4f endpoints:", e);
    }
  }

  // Try g4f free endpoints in order
  for (const endpoint of G4F_ENDPOINTS) {
    try {
      return await callG4FEndpoint(messages, endpoint);
    } catch (e) {
      console.error(`g4f endpoint ${endpoint.url} failed:`, e);
    }
  }

  // Fallback: helpful static response
  return "Извините, AI-помощник временно недоступен. Вот что я могу подсказать:\n\n" +
    "🔑 Ключи — в кабинете на сайте\n" +
    "🔐 2FA — через Telegram-бота\n" +
    "💬 Поддержка — создай тикет в кабинете или напиши боту\n" +
    "📥 Лаунчер — скачай на главной странице\n\n" +
    "По остальным вопросам обращайся в поддержку: discord.gg/ASXzHaQfvj";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, conversationId } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const id = conversationId || generateConversationId();

    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: message },
    ];

    const reply = await getAIResponse(messages);

    return NextResponse.json({ reply, conversationId: id });
  } catch (e) {
    console.error("AI chat error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
