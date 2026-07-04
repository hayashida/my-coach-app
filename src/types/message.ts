// session-history スペックとの共有契約

export type MessageImage = {
  data: string;     // base64（プレフィックスなし）
  mimeType: string; // "image/jpeg"
};

export type Message = {
  role: "user" | "assistant";
  content: string;        // テキスト内容、または画像メッセージでは "[写真]"
  image?: MessageImage;   // メモリ上のみ（localStorage には保存しない）
};
