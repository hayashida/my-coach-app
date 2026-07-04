import { POST } from "@/app/api/chat/route";
import { auth } from "@/auth";
import { GoogleGenAI } from "@google/genai";
import type { NextRequest } from "next/server";
import type { Message } from "@/types/message";

jest.mock("@/auth", () => ({
  auth: jest.fn(),
}));

jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn(),
}));

describe("POST /api/chat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (GoogleGenAI as jest.Mock).mockImplementation(() => ({
      chats: {
        create: jest.fn().mockReturnValue({
          sendMessageStream: jest.fn().mockResolvedValue(
            (async function* () {
              yield { text: "テスト返答" };
            })()
          ),
        }),
      },
    }));
  });

  function makeRequest(body: {
    message?: string;
    image?: { data: string; mimeType: string };
    history: Message[];
  }): NextRequest {
    return new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }) as unknown as NextRequest;
  }

  test("未認証の場合 401 を返す", async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await POST(makeRequest({ message: "こんにちは", history: [] }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  test("認証済みの場合 200 + ReadableStream を返す", async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { email: "test@example.com" } });
    const res = await POST(makeRequest({ message: "テスト", history: [] }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    const text = await res.text();
    expect(text).toBe("テスト返答");
  });

  test("history の assistant ロールが model にマッピングされる", async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { email: "test@example.com" } });

    const mockCreate = jest.fn().mockReturnValue({
      sendMessageStream: jest.fn().mockResolvedValue(
        (async function* () {
          yield { text: "返答" };
        })()
      ),
    });
    (GoogleGenAI as jest.Mock).mockImplementationOnce(() => ({
      chats: { create: mockCreate },
    }));

    const history: Message[] = [
      { role: "user", content: "質問" },
      { role: "assistant", content: "前の返答" },
    ];
    await POST(makeRequest({ message: "新しい質問", history }));

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        history: [
          { role: "user", parts: [{ text: "質問" }] },
          { role: "model", parts: [{ text: "前の返答" }] },
        ],
      })
    );
  });

  test("Gemini が 429 エラーを返した場合 429 を返す", async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { email: "test@example.com" } });
    const rateLimitError = Object.assign(new Error("Rate limit exceeded"), { status: 429 });
    (GoogleGenAI as jest.Mock).mockImplementationOnce(() => ({
      chats: {
        create: jest.fn().mockReturnValue({
          sendMessageStream: jest.fn().mockRejectedValue(rateLimitError),
        }),
      },
    }));
    const res = await POST(makeRequest({ message: "テスト", history: [] }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body).toEqual({ error: "rate_limit" });
  });

  test("Gemini が予期しないエラーを返した場合 500 を返す", async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { email: "test@example.com" } });
    (GoogleGenAI as jest.Mock).mockImplementationOnce(() => ({
      chats: {
        create: jest.fn().mockReturnValue({
          sendMessageStream: jest.fn().mockRejectedValue(new Error("Unknown error")),
        }),
      },
    }));
    const res = await POST(makeRequest({ message: "テスト", history: [] }));
    expect(res.status).toBe(500);
  });

  test("image 付きリクエストで sendMessageStream に inlineData パーツが渡される", async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { email: "test@example.com" } });

    const mockSendMessageStream = jest.fn().mockResolvedValue(
      (async function* () {
        yield { text: "画像コーチング返答" };
      })()
    );
    const mockCreate = jest.fn().mockReturnValue({
      sendMessageStream: mockSendMessageStream,
    });
    (GoogleGenAI as jest.Mock).mockImplementationOnce(() => ({
      chats: { create: mockCreate },
    }));

    const imagePayload = { data: "base64encodeddata", mimeType: "image/jpeg" };
    const res = await POST(
      makeRequest({ image: imagePayload, history: [] })
    );

    expect(res.status).toBe(200);
    expect(mockSendMessageStream).toHaveBeenCalledWith({
      message: [{ inlineData: { data: "base64encodeddata", mimeType: "image/jpeg" } }],
    });
  });

  test("message と image の両方が未指定の場合 400 を返す", async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { email: "test@example.com" } });
    const res = await POST(makeRequest({ history: [] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: "message または image が必要です" });
  });

  test("image.mimeType が image/ で始まらない場合 400 を返す", async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { email: "test@example.com" } });
    const res = await POST(
      makeRequest({
        image: { data: "base64data", mimeType: "application/pdf" },
        history: [],
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: "無効な mimeType です" });
  });
});
