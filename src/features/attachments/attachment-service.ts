import type { Actor } from "@/features/authorization/actor";
import { effectiveRole, requirePermission } from "@/features/authorization/actor";
import {
  ValidationError,
  UnauthorizedError,
} from "@/features/authorization/errors";
import {
  canAddAttachment,
  canDeleteAttachment,
  canViewAttachments,
} from "@/features/authorization/permissions";

export const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024; // 5MB (FR-093)
export const MAX_FILENAME_LENGTH = 255;

export interface AttachmentUserInfo {
  id: string;
  name: string;
  email: string;
}

export interface AttachmentRecord {
  id: string;
  taskId: string;
  workspaceId: string;
  projectId: string;
  userId: string;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;
  createdAt: Date;
  user?: AttachmentUserInfo;
}

export interface AttachmentRepository {
  getAttachment(attachmentId: string): Promise<AttachmentRecord | null>;
  listAttachmentsByTask(taskId: string): Promise<AttachmentRecord[]>;
  getTaskWorkspaceId(taskId: string): Promise<string | null>;
  getTaskProjectId(taskId: string): Promise<string | null>;
  createAttachment(input: {
    taskId: string;
    userId: string;
    filename: string;
    mimeType: string;
    size: number;
    storageKey: string;
  }): Promise<AttachmentRecord>;
  deleteAttachment(attachmentId: string): Promise<void>;
}

/** Lớp lưu trữ file vật lý — local disk cho demo, swap sang S3/R2 khi lên production. */
export interface AttachmentStorage {
  save(input: {
    storageKey: string;
    data: Uint8Array;
    mimeType: string;
  }): Promise<void>;
  read(storageKey: string): Promise<Uint8Array | null>;
  delete(storageKey: string): Promise<void>;
}

interface Deps {
  repo: AttachmentRepository;
  storage: AttachmentStorage;
}

/** Xác minh task thuộc workspace (và project nếu có) của actor; trả projectId hoặc ném lỗi. */
async function fetchOwnedTaskScope(
  repo: AttachmentRepository,
  actor: Actor,
  taskId: string,
): Promise<string> {
  const [workspaceId, projectId] = await Promise.all([
    repo.getTaskWorkspaceId(taskId),
    repo.getTaskProjectId(taskId),
  ]);
  if (!workspaceId || workspaceId !== actor.workspaceId || !projectId) {
    throw new UnauthorizedError("Task not found or does not belong to your workspace.");
  }
  if ("projectId" in actor && projectId !== (actor as { projectId: string }).projectId) {
    throw new UnauthorizedError("Task does not belong to this project.");
  }
  return projectId;
}

/** Tên file được lưu lại để hiển thị/tải xuống; không định danh file trên disk (dùng storageKey). */
function sanitizeFilename(raw: string): string {
  const base = raw.split(/[\\/]/).pop()?.trim() ?? "";
  if (base.length === 0) throw new ValidationError("File name cannot be empty.");
  if (base.length > MAX_FILENAME_LENGTH) {
    throw new ValidationError("File name is too long (max 255 characters).");
  }
  if (base.startsWith(".") || /[\u0000-\u001f\u007f]/.test(base)) {
    throw new ValidationError("File name is not allowed.");
  }
  return base;
}

export function createAttachmentService({ repo, storage }: Deps) {
  /** Xem danh sách attachment của task — mọi member (FR-091). */
  async function listAttachments(actor: Actor, taskId: string): Promise<AttachmentRecord[]> {
    requirePermission(actor, canViewAttachments(effectiveRole(actor)), "You do not have permission to view attachments.");
    await fetchOwnedTaskScope(repo, actor, taskId);
    return repo.listAttachmentsByTask(taskId);
  }

  /**
   * Upload attachment — mọi member (FR-090). Kiểm tra thư mục workspace, ghi file
   * xuống storage rồi tạo bản ghi; nếu DB fail thì dọn file đã ghi (best-effort).
   */
  async function addAttachment(
    actor: Actor,
    taskId: string,
    file: { filename: string; mimeType: string; size: number; data: Uint8Array },
  ): Promise<AttachmentRecord> {
    requirePermission(actor, canAddAttachment(effectiveRole(actor)), "You do not have permission to add attachments.");
    await fetchOwnedTaskScope(repo, actor, taskId);

    const filename = sanitizeFilename(file.filename);
    if (file.size <= 0) {
      throw new ValidationError("File is empty.");
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      throw new ValidationError("File is too large (max 5MB).");
    }

    const storageKey = crypto.randomUUID();
    await storage.save({
      storageKey,
      data: file.data,
      mimeType: file.mimeType,
    });

    try {
      return await repo.createAttachment({
        taskId,
        userId: actor.userId,
        filename,
        mimeType: file.mimeType,
        size: file.size,
        storageKey,
      });
    } catch (error) {
      await storage.delete(storageKey).catch(() => {});
      throw error;
    }
  }

  /** Xoá attachment: uploader hoặc Owner/Admin (FR-092). */
  async function deleteAttachment(actor: Actor, attachmentId: string): Promise<void> {
    const attachment = await repo.getAttachment(attachmentId);
    if (
      !attachment ||
      attachment.workspaceId !== actor.workspaceId ||
      ("projectId" in actor && attachment.projectId !== (actor as { projectId: string }).projectId)
    ) {
      throw new UnauthorizedError("Attachment not found or does not belong to your workspace.");
    }

    const isUploader = attachment.userId === actor.userId;
    requirePermission(
      actor,
      canDeleteAttachment(effectiveRole(actor), isUploader),
      "You do not have permission to delete this attachment.",
    );

    await repo.deleteAttachment(attachmentId);
    await storage.delete(attachment.storageKey).catch(() => {});
  }

  return { listAttachments, addAttachment, deleteAttachment };
}

export type AttachmentService = ReturnType<typeof createAttachmentService>;