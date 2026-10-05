import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import type { StatusRecord, StatusRepository } from "./status-service";

const STATUS_SELECT = {
  id: true,
  name: true,
  position: true,
  isDefault: true,
  isDone: true,
  createdAt: true,
  projectId: true,
  project: { select: { workspaceId: true } },
} as const;

function mapRow(row: {
  id: string;
  name: string;
  position: Prisma.Decimal | string;
  isDefault: boolean;
  isDone: boolean;
  createdAt: Date;
  projectId: string;
  project: { workspaceId: string };
}): StatusRecord {
  return {
    id: row.id,
    name: row.name,
    position: row.position.toString(),
    isDefault: row.isDefault,
    isDone: row.isDone,
    createdAt: row.createdAt,
    projectId: row.projectId,
    workspaceId: row.project.workspaceId,
  };
}

export const prismaStatusRepository: StatusRepository = {
  async getStatus(statusId: string): Promise<StatusRecord | null> {
    const row = await prisma.status.findUnique({
      where: { id: statusId },
      select: STATUS_SELECT,
    });
    return row ? mapRow(row) : null;
  },

  async getProjectWorkspaceId(projectId: string): Promise<string | null> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    });
    return project?.workspaceId ?? null;
  },

  async listStatusesByProject(projectId: string): Promise<StatusRecord[]> {
    const rows = await prisma.status.findMany({
      where: { projectId },
      orderBy: { position: "asc" },
      select: STATUS_SELECT,
    });
    return rows.map(mapRow);
  },

  async createStatus(input: {
    projectId: string;
    name: string;
    position: string;
    isDefault?: boolean;
    isDone?: boolean;
  }): Promise<StatusRecord> {
    const id = randomUUID();
    const position = new Prisma.Decimal(input.position);

    if (input.isDefault) {
      return prisma.$transaction(async (tx) => {
        await tx.status.updateMany({
          where: { projectId: input.projectId, isDefault: true },
          data: { isDefault: false },
        });
        const row = await tx.status.create({
          data: {
            id,
            projectId: input.projectId,
            name: input.name,
            position,
            isDefault: true,
            isDone: input.isDone ?? false,
          },
          select: STATUS_SELECT,
        });
        return mapRow(row);
      });
    }

    const row = await prisma.status.create({
      data: {
        id,
        projectId: input.projectId,
        name: input.name,
        position,
        isDefault: input.isDefault ?? false,
        isDone: input.isDone ?? false,
      },
      select: STATUS_SELECT,
    });
    return mapRow(row);
  },

  async updateStatus(input: {
    statusId: string;
    name?: string;
    position?: string;
    isDefault?: boolean;
    isDone?: boolean;
  }): Promise<StatusRecord> {
    const data: Prisma.StatusUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.position !== undefined) data.position = new Prisma.Decimal(input.position);
    if (input.isDefault !== undefined) data.isDefault = input.isDefault;
    if (input.isDone !== undefined) data.isDone = input.isDone;

    if (input.isDefault) {
      return prisma.$transaction(async (tx) => {
        const current = await tx.status.findUnique({
          where: { id: input.statusId },
          select: { projectId: true },
        });
        if (current) {
          await tx.status.updateMany({
            where: { projectId: current.projectId, isDefault: true },
            data: { isDefault: false },
          });
        }
        const row = await tx.status.update({
          where: { id: input.statusId },
          data,
          select: STATUS_SELECT,
        });
        return mapRow(row);
      });
    }

    const row = await prisma.status.update({
      where: { id: input.statusId },
      data,
      select: STATUS_SELECT,
    });
    return mapRow(row);
  },

  async deleteStatus(statusId: string): Promise<void> {
    await prisma.status.delete({
      where: { id: statusId },
    });
  },

  async countTasksInStatus(statusId: string): Promise<number> {
    return prisma.task.count({
      where: { statusId },
    });
  },

  async countStatusesInProject(projectId: string): Promise<number> {
    return prisma.status.count({
      where: { projectId },
    });
  },

  async getDefaultStatus(projectId: string): Promise<StatusRecord | null> {
    const row = await prisma.status.findFirst({
      where: { projectId, isDefault: true },
      select: STATUS_SELECT,
    });
    if (row) return mapRow(row);

    const first = await prisma.status.findFirst({
      where: { projectId },
      orderBy: { position: "asc" },
      select: STATUS_SELECT,
    });
    return first ? mapRow(first) : null;
  },

  async reorderStatuses(items: { id: string; position: string }[]): Promise<void> {
    await prisma.$transaction(
      items.map((item) =>
        prisma.status.update({
          where: { id: item.id },
          data: { position: new Prisma.Decimal(item.position) },
        }),
      ),
    );
  },
};
