import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const SYSTEM_PROMPT = "Ты — помощник Lobok Client. Отвечай на русском языке. Помогаешь с вопросами по лаунчеру, ключам, оплате, настройке клиента. Будь дружелюбным и кратким. Если не знаешь ответ — скажи что нужно обратиться в поддержку.";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

const FREE_ENDPOINTS = [
  { url: "https://api.g4f.site/v1/chat/completions", model: "gpt-3.5-turbo" },
  { url: "https://api.pawan.krd/v1/chat/completions", model: "gpt-3.5-turbo" },
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

async function callFreeEndpoint(
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
    throw new Error(`Free endpoint error (${endpoint.url}): ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "Нет ответа от модели.";
}

async function getAIResponse(messages: ChatMessage[]): Promise<string> {
  if (OPENAI_API_KEY) {
    try {
      return await callOpenAI(messages);
    } catch (e) {
      console.error("OpenAI failed, trying free endpoints:", e);
    }
  }

  for (const endpoint of FREE_ENDPOINTS) {
    try {
      return await callFreeEndpoint(messages, endpoint);
    } catch (e) {
      console.error(`Free endpoint ${endpoint.url} failed:`, e);
    }
  }

  return "Извините, AI-помощник временно недоступен. Пожалуйста, обратитесь в поддержку.";
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
