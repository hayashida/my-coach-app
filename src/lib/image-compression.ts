export type CompressedImage = {
  /** base64 文字列（"data:image/jpeg;base64," プレフィックスなし） */
  data: string;
  mimeType: "image/jpeg";
};

const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.7;

/**
 * 入力画像を最大 1024px / JPEG 0.7 品質に圧縮して base64 文字列を返す。
 *
 * @param file - 圧縮対象の画像ファイル（MIME: image/*）
 * @returns CompressedImage — data はプレフィックスなしの base64 文字列
 * @throws Error("サポートされていないファイル形式です") — MIME が image/* 以外の場合
 */
export async function compressImage(file: File): Promise<CompressedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("サポートされていないファイル形式です");
  }

  const bitmap = await createImageBitmap(file);

  let { width, height } = bitmap;

  // アスペクト比を維持したまま最大辺を MAX_DIMENSION に収める
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    if (width >= height) {
      height = Math.round((height * MAX_DIMENSION) / width);
      width = MAX_DIMENSION;
    } else {
      width = Math.round((width * MAX_DIMENSION) / height);
      height = MAX_DIMENSION;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D コンテキストの取得に失敗しました");
  }

  ctx.drawImage(bitmap, 0, 0, width, height);

  return new Promise<CompressedImage>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("画像の圧縮に失敗しました"));
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          // "data:image/jpeg;base64,<base64>" から base64 部分のみを取り出す
          const base64 = dataUrl.split(",")[1];
          resolve({ data: base64, mimeType: "image/jpeg" });
        };
        reader.onerror = () => {
          reject(new Error("画像データの読み込みに失敗しました"));
        };
        reader.readAsDataURL(blob);
      },
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}
