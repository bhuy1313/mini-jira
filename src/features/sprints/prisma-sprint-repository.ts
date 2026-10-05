import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import type { SprintRecord, SprintRepository } from "./sprint-service";

const SPRINT_SELECT = {
  id: true,
  name: true,
  goal: true,
  startDate: true,
  endDate: true,
  position: true,
  createdAt: true,
  projectId: true,
  project: { select: { workspaceId: true } },
} as const;

function mapRow(row: {
  id: string;
  name: string;
  goal: string | null;
  startDate: Date | null;
  endDate: Date | null;
  position: Prisma.Decimal | string;
  createdAt: Date;
  projectId: string;
  project: { workspaceId: string };
}): SprintRecord {
  return {
    id: row.id,
    name: row.name,
    goal: row.goal,
    startDate: row.startDate,
    endDate: row.endDate,
    position: row.position.toString(),
    createdAt: row.createdAt,
    projectId: row.projectId,
    workspaceId: row.project.workspaceId,
  };
}

export const prismaSprintRepository: SprintRepository = {
  async getSprint(sprintId: string): Promise<SprintRecord | null> {
    const row = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: SPRINT_SELECT,
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

  async getSprintProjectId(sprintId: string): Promise<string | null> {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: { projectId: true },
    });
    return sprint?.projectId ?? null;
  },

  async listSprintsByProject(projectId: string): Promise<SprintRecord[]> {
    const rows = await prisma.sprint.findMany({
      where: { projectId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: SPRINT_SELECT,
    });
    return rows.map(mapRow);
  },

  async createSprint(input: {
    projectId: string;
    name: string;
    goal: string | null;
    startDate: Date | null;
    endDate: Date | null;
    position: string;
  }): Promise<SprintRecord> {
    const row = await prisma.sprint.create({
      data: {
        id: randomUUID(),
        projectId: input.projectId,
        name: input.name,
        goal: input.goal,
        startDate: input.startDate,
        endDate: input.endDate,
        position: new Prisma.Decimal(input.position),
      },
      select: SPRINT_SELECT,
    });
    return mapRow(row);
  },

  async updateSprint(input: {
    sprintId: string;
    name?: string;
    goal?: string | null;
    startDate?: Date | null;
    endDate?: Date | null;
    position?: string;
  }): Promise<SprintRecord> {
    const data: Prisma.SprintUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.goal !== undefined) data.goal = input.goal;
    if (input.startDate !== undefined) data.startDate = input.startDate;
    if (input.endDate !== undefined) data.endDate = input.endDate;
    if (input.position !== undefined) data.position = new Prisma.Decimal(input.position);

    const row = await prisma.sprint.update({
      where: { id: input.sprintId },
      data,
      select: SPRINT_SELECT,
    });
    return mapRow(row);
  },

  async deleteSprint(sprintId: string): Promise<void> {
    // Task.sprintId SetNull dọn task về backlog.
    await prisma.sprint.delete({ where: { id: sprintId } });
  },

  async countTasksBySprint(projectId: string): Promise<Record<string, number>> {
    const rows = await prisma.task.groupBy({
      by: ["sprintId"],
      where: { projectId },
      _count: { _all: true },
    });
    const out: Record<string, number> = { backlog: 0 };
    for (const r of rows) {
      const key = r.sprintId ?? "backlog";
      out[key] = r._count._all;
    }
    return out;
  },

  async countDoneTasksBySprint(projectId: string): Promise<Record<string, number>> {
    const rows = await prisma.task.groupBy({
      by: ["sprintId"],
      where: { projectId, status: { isDone: true } },
      _count: { _all: true },
    });
    const out: Record<string, number> = {};
    for (const r of rows) {
      out[r.sprintId ?? "backlog"] = r._count._all;
    }
    return out;
  },

  async reorderSprints(items: { id: string; position: string }[]): Promise<void> {
    await prisma.$transaction(
      items.map((item) =>
        prisma.sprint.update({
          where: { id: item.id },
          data: { position: new Prisma.Decimal(item.position) },
        }),
      ),
    );
  },
};