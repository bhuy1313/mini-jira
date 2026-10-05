import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { AttachmentStorage } from "./attachment-service";

/**
 * Local disk storage — demo (không để trong `public/` để file không bị serve
 * tĩnh; mọi download đi qua route authenticated `/api/attachments/[id]`).
 * Khi lên production có thể thay bằng S3/R2 giữ nguyên interface.
 */
function storageDir(): string {
  if (process.env.ATTACHMENT_UPLOAD_DIR) return process.env.ATTACHMENT_UPLOAD_DIR;
  return join(/*turbopackIgnore: true*/ process.cwd(), "storage", "uploads");
}

function filePath(storageKey: string): string {
  return join(storageDir(), storageKey);
}

export const localAttachmentStorage: AttachmentStorage = {
  async save(input) {
    await mkdir(storageDir(), { recursive: true });
    await writeFile(filePath(input.storageKey), input.data);
  },

  async read(storageKey) {
    try {
      const bytes = await readFile(filePath(storageKey));
      return new Uint8Array(bytes);
    } catch {
      return null;
    }
  },

  async delete(storageKey) {
    await rm(filePath(storageKey), { force: true });
  },
};