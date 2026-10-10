import { randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/features/authorization/errors";
import { DEFAULT_PROJECT_LABELS } from "@/features/labels/label-service";
import type { ProjectRecord, ProjectRepository } from "./project-service";

const PROJECT_SELECT = {
  id: true,
  name: true,
  key: true,
  taskCounter: true,
  description: true,
  archivedAt: true,
  workspaceId: true,
} as const;

function toProjectRecord(row: {
  id: string;
  name: string;
  key: string;
  taskCounter: number;
  description: string | null;
  archivedAt: Date | null;
  workspaceId: string;
}): ProjectRecord {
  return {
    id: row.id,
    name: row.name,
    key: row.key,
    taskCounter: row.taskCounter,
    description: row.description,
    archivedAt: row.archivedAt,
    workspaceId: row.workspaceId,
  };
}

function duplicateKeyError(err: unknown): void {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    throw new ValidationError("Project key is already taken in this workspace.");
  }
  throw err;
}

/**
 * Implement `ProjectRepository` bằng Prisma (DB thật). Mọi guard/quyền vẫn do
 * service layer đảm bảo; lớp này chỉ đọc/ghi và sinh id.
 */
export const prismaProjectRepository: ProjectRepository = {
  async listActiveProjects(workspaceId: string): Promise<ProjectRecord[]> {
    const rows = await prisma.project.findMany({
      where: { workspaceId, archivedAt: null },
      select: PROJECT_SELECT,
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toProjectRecord);
  },

  async listArchivedProjects(workspaceId: string): Promise<ProjectRecord[]> {
    const rows = await prisma.project.findMany({
      where: { workspaceId, archivedAt: { not: null } },
      select: PROJECT_SELECT,
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(toProjectRecord);
  },

  async getProject(projectId: string): Promise<ProjectRecord | null> {
    const row = await prisma.project.findUnique({
      where: { id: projectId },
      select: PROJECT_SELECT,
    });
    return row ? toProjectRecord(row) : null;
  },

  async findProjectByKey(workspaceId: string, key: string): Promise<ProjectRecord | null> {
    const row = await prisma.project.findUnique({
      where: { workspaceId_key: { workspaceId, key } },
      select: PROJECT_SELECT,
    });
    return row ? toProjectRecord(row) : null;
  },

  async createProject(input: {
    workspaceId: string;
    name: string;
    key: string;
    description: string | null;
  }): Promise<ProjectRecord> {
    const projectId = randomUUID();
    try {
      const [row] = await prisma.$transaction([
        prisma.project.create({
          data: {
            id: projectId,
            workspaceId: input.workspaceId,
            name: input.name,
            key: input.key,
            description: input.description,
          },
          select: PROJECT_SELECT,
        }),
      prisma.status.createMany({
        data: [
          { id: randomUUID(), projectId, name: "To Do", position: 1000, isDefault: true },
          { id: randomUUID(), projectId, name: "In Progress", position: 2000, isDefault: false },
          { id: randomUUID(), projectId, name: "Done", position: 3000, isDefault: false, isDone: true },
        ],
      }),
      prisma.label.createMany({
        data: DEFAULT_PROJECT_LABELS.map((l) => ({
          id: randomUUID(),
          projectId,
          name: l.name,
          color: l.color,
        })),
      }),
      ]);
      return toProjectRecord(row);
    } catch (err) {
      duplicateKeyError(err);
      throw err;
    }
  },

  async updateProject(input: {
    projectId: string;
    name?: string;
    description?: string | null;
  }): Promise<ProjectRecord> {
    const data: { name?: string; description?: string | null } = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    const row = await prisma.project.update({
      where: { id: input.projectId },
      data,
      select: PROJECT_SELECT,
    });
    return toProjectRecord(row);
  },

  async setProjectArchived(input: { projectId: string; archivedAt: Date | null }): Promise<ProjectRecord> {
    const row = await prisma.project.update({
      where: { id: input.projectId },
      data: { archivedAt: input.archivedAt },
      select: PROJECT_SELECT,
    });
    return toProjectRecord(row);
  },

  async deleteProject(projectId: string): Promise<void> {
    // Cascade trong schema (Project -> Task -> Comment, Activity) loại toàn bộ dữ liệu (BR-013).
    await prisma.project.delete({ where: { id: projectId } });
  },

  /**
   * Tạo project + ProjectMember Owner + Default Statuses + Default Labels trong cùng một transaction (Mốc 11 & 12 & 22).
   * Đảm bảo creator luôn là Owner của project mới tạo, có sẵn 3 status và 5 label mặc định.
   */
  async createProjectWithOwner(input: {
    workspaceId: string;
    name: string;
    key: string;
    description: string | null;
    creatorId: string;
  }): Promise<ProjectRecord> {
    const projectId = randomUUID();
    try {
      const [project] = await prisma.$transaction([
        prisma.project.create({
          data: {
            id: projectId,
            workspaceId: input.workspaceId,
            name: input.name,
            key: input.key,
            description: input.description,
          },
          select: PROJECT_SELECT,
        }),
      prisma.projectMember.create({
        data: {
          projectId,
          userId: input.creatorId,
          role: "Owner",
        },
      }),
      prisma.status.createMany({
        data: [
          { id: randomUUID(), projectId, name: "To Do", position: 1000, isDefault: true },
          { id: randomUUID(), projectId, name: "In Progress", position: 2000, isDefault: false },
          { id: randomUUID(), projectId, name: "Done", position: 3000, isDefault: false, isDone: true },
        ],
      }),
      prisma.label.createMany({
        data: DEFAULT_PROJECT_LABELS.map((l) => ({
          id: randomUUID(),
          projectId,
          name: l.name,
          color: l.color,
        })),
      }),
      ]);
      return toProjectRecord(project);
    } catch (err) {
      duplicateKeyError(err);
      throw err;
    }
  },

  /** Danh sách userId của tất cả workspace member (để validate khi thêm project member). */
  async listWorkspaceMemberIds(workspaceId: string): Promise<string[]> {
    const rows = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  },
};
