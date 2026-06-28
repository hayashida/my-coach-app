/**
 * メールアドレスが許可リストに含まれるかを照合する純粋関数。
 * 大文字小文字の違いを無視して比較する。
 */
export function checkAllowedEmail(
  email: string,
  allowedEmails: string[]
): boolean {
  return allowedEmails
    .map((e) => e.toLowerCase())
    .includes(email.toLowerCase());
}
