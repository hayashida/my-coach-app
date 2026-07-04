/**
 * @jest-environment jsdom
 */
import { compressImage } from "@/lib/image-compression";

// jsdom は createImageBitmap を実装していないためグローバルモック
global.createImageBitmap = jest.fn().mockResolvedValue({
  width: 800,
  height: 600,
  close: jest.fn(),
});

// HTMLCanvasElement.getContext モック（2D コンテキストを返す）
HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
  drawImage: jest.fn(),
}) as unknown as HTMLCanvasElement["getContext"];

// HTMLCanvasElement.toBlob モック — コールバックを同期的に呼び出す
HTMLCanvasElement.prototype.toBlob = jest.fn().mockImplementation(
  (callback: BlobCallback) => {
    callback(new Blob(["fake-jpeg"], { type: "image/jpeg" }));
  }
) as unknown as HTMLCanvasElement["toBlob"];

// FileReader モック — readAsDataURL が onload を同期的に呼び出す
class MockFileReader {
  result: string = "data:image/jpeg;base64,ZmFrZS1qcGVn";
  onload: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  readAsDataURL(_blob: Blob): void {
    if (this.onload) {
      (this.onload as () => void)();
    }
  }
}

global.FileReader = MockFileReader as unknown as typeof FileReader;

describe("compressImage", () => {
  it("正常圧縮フローで CompressedImage が返ること（Req 1.3, 6.2）", async () => {
    const file = new File(["fake-image"], "test.jpg", { type: "image/jpeg" });

    const result = await compressImage(file);

    // mimeType は固定値
    expect(result.mimeType).toBe("image/jpeg");
    // data は文字列で空でないこと
    expect(typeof result.data).toBe("string");
    expect(result.data.length).toBeGreaterThan(0);
    // data に "data:image/jpeg;base64," プレフィックスが含まれていないこと
    expect(result.data).not.toContain("data:");
    expect(result.data).not.toContain(";base64,");
  });

  it("非画像ファイル入力時にエラーがスローされること（Req 6.2）", async () => {
    const file = new File(["pdf-content"], "document.pdf", {
      type: "application/pdf",
    });

    await expect(compressImage(file)).rejects.toThrow(
      "サポートされていないファイル形式です"
    );
  });
});
