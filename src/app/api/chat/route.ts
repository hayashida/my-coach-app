import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import type { Message } from "@/types/message";

type ChatRequest = {
  message?: string;
  image?: { data: string; mimeType: string };
  history: Message[];
};

export async function POST(request: NextRequest): Promise<Response> {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as ChatRequest;
    const { message, image, history } = body;

    // バリデーション: message と image のどちらか一方が必須
    if (!message && !image) {
      return NextResponse.json(
        { error: "message または image が必要です" },
        { status: 400 }
      );
    }

    // バリデーション: image.mimeType は image/ で始まる必要がある
    if (image && !image.mimeType.startsWith("image/")) {
      return NextResponse.json(
        { error: "無効な mimeType です" },
        { status: 400 }
      );
    }

    // 履歴変換（image フィールドがある場合は inlineData パーツを使用）
    const geminiHistory = history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: m.image
        ? [{ inlineData: { data: m.image.data, mimeType: m.image.mimeType } }]
        : [{ text: m.content }],
    }));

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const chat = ai.chats.create({
      model: "gemini-3.1-flash-lite",
      history: geminiHistory,
      config: { systemInstruction: SYSTEM_PROMPT },
    });

    const stream = await chat.sendMessageStream({
      message: image
        ? [{ inlineData: { data: image.data, mimeType: image.mimeType } }]
        : message!,
    });

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.text;
            if (text) {
              controller.enqueue(new TextEncoder().encode(text));
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      ((error as Error & { status?: number }).status === 429 ||
        error.message.includes("429"))
    ) {
      return NextResponse.json({ error: "rate_limit" }, { status: 429 });
    }
    return new NextResponse(null, { status: 500 });
  }
}
