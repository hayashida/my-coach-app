import { checkAllowedEmail } from "@/lib/allow-list";

describe("checkAllowedEmail", () => {
  it("ALLOWED_EMAILS に含まれるメールアドレスは true を返す", () => {
    const allowed = ["user@gmail.com", "admin@example.com"];
    expect(checkAllowedEmail("user@gmail.com", allowed)).toBe(true);
  });

  it("ALLOWED_EMAILS に含まれないメールアドレスは false を返す", () => {
    const allowed = ["user@gmail.com", "admin@example.com"];
    expect(checkAllowedEmail("other@gmail.com", allowed)).toBe(false);
  });

  it("ALLOWED_EMAILS が空配列の場合は false を返す（フェイルセーフ）", () => {
    expect(checkAllowedEmail("user@gmail.com", [])).toBe(false);
  });

  it("大文字小文字の違いを無視して照合する", () => {
    const allowed = ["user@gmail.com"];
    expect(checkAllowedEmail("User@Gmail.com", allowed)).toBe(true);
    expect(checkAllowedEmail("USER@GMAIL.COM", allowed)).toBe(true);
  });

  it("許可リスト側の大文字も小文字に統一して照合する", () => {
    const allowed = ["Admin@Example.COM"];
    expect(checkAllowedEmail("admin@example.com", allowed)).toBe(true);
  });
});
