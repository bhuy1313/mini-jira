import type { AttachmentStorage } from "./attachment-service";
import { localAttachmentStorage } from "./local-attachment-storage";
import { createR2Storage } from "./r2-attachment-storage";

/**
 * Noop driver — dùng khi không có storage backend nào khả dụng
 * (ví dụ: Vercel serverless chưa cấu hình R2).
 * Upload/download sẽ trả lỗi thân thiện thay vì crash toàn app.
 */
const noopAttachmentStorage: AttachmentStorage = {
  async save() {
    throw new Error(
      "File storage is not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME environment variables.",
    );
  },
  async read() {
    return null;
  },
  async delete() {
    // no-op
  },
};

function resolveStorage(): AttachmentStorage {
  // Ưu tiên 1: Cloudflare R2 (production có cấu hình đầy đủ)
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (accountId && accessKeyId && secretAccessKey && bucketName) {
    return createR2Storage({ accountId, accessKeyId, secretAccessKey, bucketName });
  }

  // Ưu tiên 2: Local disk (dev / self-hosted với ATTACHMENT_UPLOAD_DIR)
  // Trên Vercel, process.cwd() là read-only → chỉ dùng local khi có env var rõ ràng
  if (process.env.ATTACHMENT_UPLOAD_DIR) {
    return localAttachmentStorage;
  }

  // Nếu không phải production (NODE_ENV=development) → cho phép dùng local disk mặc định
  if (process.env.NODE_ENV !== "production") {
    return localAttachmentStorage;
  }

  // Ưu tiên 3: Noop — production serverless chưa cấu hình storage
  return noopAttachmentStorage;
}

/**
 * Storage driver duy nhất dùng chung toàn app:
 * - Có đủ 4 biến R2_* → Cloudflare R2 (production).
 * - Có ATTACHMENT_UPLOAD_DIR hoặc NODE_ENV=development → Local disk.
 * - Production serverless không có storage config → Noop (trả lỗi thân thiện).
 */
export const attachmentStorage: AttachmentStorage = resolveStorage();

export type AttachmentStorageDriver = "r2" | "local" | "noop";

export function getAttachmentStorageDriverName(): AttachmentStorageDriver {
  if (
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  ) {
    return "r2";
  }
  if (process.env.ATTACHMENT_UPLOAD_DIR || process.env.NODE_ENV !== "production") {
    return "local";
  }
  return "noop";
}

