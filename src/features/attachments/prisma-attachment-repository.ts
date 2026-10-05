import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import type { AttachmentRecord, AttachmentRepository } from "./attachment-service";
const ATTACHMENT_SELECT = {
  id: true,
  taskId: true,
  userId: true,
  filename: true,
  mimeType: true,
  size: true,
  storageKey: true,
  createdAt: true,
task: {
        select: {
          project: {
            select: {
              workspaceId: true,
              id: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
} as const;

function mapRow(row: {
  id: string;
  taskId: string;
  userId: string;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;
  createdAt: Date;
  task: { project: { workspaceId: string; id: string } };
  user: { id: string; name: string; email: string };
}): AttachmentRecord {
  return {
    id: row.id,
    taskId: row.taskId,
    workspaceId: row.task.project.workspaceId,
    projectId: row.task.project.id,
    userId: row.userId,
    filename: row.filename,
    mimeType: row.mimeType,
    size: row.size,
    storageKey: row.storageKey,
    createdAt: row.createdAt,
    user: row.user,
  };
}

export const prismaAttachmentRepository: AttachmentRepository & {
  listAttachmentsByTaskIds(taskIds: string[]): Promise<AttachmentRecord[]>;
} = {
  async getAttachment(attachmentId: string): Promise<AttachmentRecord | null> {
    const row = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      select: ATTACHMENT_SELECT,
    });
    return row ? mapRow(row) : null;
  },

  async listAttachmentsByTask(taskId: string): Promise<AttachmentRecord[]> {
    const rows = await prisma.attachment.findMany({
      where: { taskId },
      orderBy: { createdAt: "asc" },
      select: ATTACHMENT_SELECT,
    });
    return rows.map(mapRow);
  },

  async listAttachmentsByTaskIds(taskIds: string[]): Promise<AttachmentRecord[]> {
    if (taskIds.length === 0) return [];
    const rows = await prisma.attachment.findMany({
      where: { taskId: { in: taskIds } },
      orderBy: { createdAt: "asc" },
      select: ATTACHMENT_SELECT,
    });
    return rows.map(mapRow);
  },

  async getTaskWorkspaceId(taskId: string): Promise<string | null> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        project: {
          select: {
            workspaceId: true,
          },
        },
      },
    });
    return task?.project.workspaceId ?? null;
  },

  async getTaskProjectId(taskId: string): Promise<string | null> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });
    return task?.projectId ?? null;
  },

  async createAttachment(input: {
    taskId: string;
    userId: string;
    filename: string;
    mimeType: string;
    size: number;
    storageKey: string;
  }): Promise<AttachmentRecord> {
    const row = await prisma.attachment.create({
      data: {
        id: randomUUID(),
        taskId: input.taskId,
        userId: input.userId,
        filename: input.filename,
        mimeType: input.mimeType,
        size: input.size,
        storageKey: input.storageKey,
      },
      select: ATTACHMENT_SELECT,
    });
    return mapRow(row);
  },

  async deleteAttachment(attachmentId: string): Promise<void> {
    await prisma.attachment.delete({
      where: { id: attachmentId },
    });
  },
};