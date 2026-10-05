import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import type { LabelRecord, LabelRepository } from "./label-service";

const LABEL_SELECT = {
  id: true,
  name: true,
  color: true,
  projectId: true,
  project: { select: { workspaceId: true } },
} as const;

function mapRow(row: {
  id: string;
  name: string;
  color: string;
  projectId: string;
  project: { workspaceId: string };
}): LabelRecord {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    projectId: row.projectId,
    workspaceId: row.project.workspaceId,
  };
}

export const prismaLabelRepository: LabelRepository & {
  listLabelsByTaskIds(taskIds: string[]): Promise<{ taskId: string; label: LabelRecord }[]>;
} = {
  async getLabel(labelId: string): Promise<LabelRecord | null> {
    const row = await prisma.label.findUnique({
      where: { id: labelId },
      select: LABEL_SELECT,
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

  async getTaskWorkspaceId(taskId: string): Promise<string | null> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { project: { select: { workspaceId: true } } },
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

  async listLabelsByProject(projectId: string): Promise<LabelRecord[]> {
    const rows = await prisma.label.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
      select: LABEL_SELECT,
    });
    return rows.map(mapRow);
  },

  async createLabel(input: { projectId: string; name: string; color: string }): Promise<LabelRecord> {
    const row = await prisma.label.create({
      data: { id: randomUUID(), projectId: input.projectId, name: input.name, color: input.color },
      select: LABEL_SELECT,
    });
    return mapRow(row);
  },

  async updateLabel(input: { labelId: string; name?: string; color?: string }): Promise<LabelRecord> {
    const data: { name?: string; color?: string } = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.color !== undefined) data.color = input.color;
    const row = await prisma.label.update({
      where: { id: input.labelId },
      data,
      select: LABEL_SELECT,
    });
    return mapRow(row);
  },

  async deleteLabel(labelId: string): Promise<void> {
    // TaskLabel cascade dọn theo trong schema.
    await prisma.label.delete({ where: { id: labelId } });
  },

  async listTaskLabelIds(taskId: string): Promise<string[]> {
    const rows = await prisma.taskLabel.findMany({
      where: { taskId },
      select: { labelId: true },
    });
    return rows.map((r) => r.labelId);
  },

  async addLabelToTask(taskId: string, labelId: string): Promise<void> {
    await prisma.taskLabel.create({
      data: { taskId, labelId },
    });
  },

  async removeLabelFromTask(taskId: string, labelId: string): Promise<void> {
    await prisma.taskLabel.delete({
      where: { taskId_labelId: { taskId, labelId } },
    });
  },

  async listLabelsByTaskIds(taskIds: string[]): Promise<{ taskId: string; label: LabelRecord }[]> {
    if (taskIds.length === 0) return [];
    const rows = await prisma.taskLabel.findMany({
      where: { taskId: { in: taskIds } },
      orderBy: { label: { name: "asc" } },
      select: {
        taskId: true,
        label: { select: LABEL_SELECT },
      },
    });
    return rows.map((r) => ({ taskId: r.taskId, label: mapRow(r.label) }));
  },
};