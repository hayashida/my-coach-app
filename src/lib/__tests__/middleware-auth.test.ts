import { authConfig } from "@/auth.config";

// authorized コールバックを直接取得
const authorized = authConfig.callbacks?.authorized as (args: {
  auth: { user?: { email?: string | null } } | null;
  request: { nextUrl: URL };
}) => boolean | Response;

function makeRequest(path: string) {
  return { nextUrl: new URL(`http://localhost${path}`) };
}

describe("authorized callback - ルート保護", () => {
  test("未認証で /chat にアクセスすると false を返す（/ へリダイレクト）", () => {
    const result = authorized({ auth: null, request: makeRequest("/chat") });
    expect(result).toBe(false);
  });

  test("認証済みで / にアクセスすると /chat への Response.redirect を返す", () => {
    const auth = { user: { email: "test@example.com" } };
    const result = authorized({ auth, request: makeRequest("/") });
    expect(result).toBeInstanceOf(Response);
    if (result instanceof Response) {
      expect([302, 307]).toContain(result.status);
      expect(result.headers.get("location")).toContain("/chat");
    }
  });

  test("認証済みで /chat にアクセスすると true を返す（通過）", () => {
    const auth = { user: { email: "test@example.com" } };
    const result = authorized({ auth, request: makeRequest("/chat") });
    expect(result).toBe(true);
  });
});
