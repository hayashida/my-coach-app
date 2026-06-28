// session-history スペックとの共有契約
export type Message = {
  role: "user" | "assistant";
  content: string;
};
