import { prisma } from "@/lib/prisma";
import type { ActivityRecord, ActivityRepository } from "./activity-service";

export const prismaActivityRepository: ActivityRepository & {
  listActivitiesByTaskIds(taskIds: string[]): Promise<ActivityRecord[]>;
} = {
  async listActivitiesByTask(taskId: string): Promise<ActivityRecord[]> {
    const rows = await prisma.activity.findMany({
      where: { taskId },
      orderBy: { createdAt: "desc" },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      type: row.type as ActivityRecord["type"],
      taskId: row.taskId,
      actorId: row.actorId,
      oldValue: row.oldValue,
      newValue: row.newValue,
      createdAt: row.createdAt,
      actor: row.actor,
    }));
  },

  async listActivitiesByTaskIds(taskIds: string[]): Promise<ActivityRecord[]> {
    if (taskIds.length === 0) return [];
    const rows = await prisma.activity.findMany({
      where: { taskId: { in: taskIds } },
      orderBy: { createdAt: "desc" },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      type: row.type as ActivityRecord["type"],
      taskId: row.taskId,
      actorId: row.actorId,
      oldValue: row.oldValue,
      newValue: row.newValue,
      createdAt: row.createdAt,
      actor: row.actor,
    }));
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
};
