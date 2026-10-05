import { prisma } from "@/lib/prisma";
import type {
  RawActivityData,
  RawSprintData,
  RawTaskData,
  RawWorklogData,
  SprintReportRepository,
} from "./sprint-report-service";

export const prismaSprintReportRepository: SprintReportRepository = {
  async getSprintWithProject(sprintId: string): Promise<RawSprintData | null> {
    const row = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: {
        id: true,
        name: true,
        goal: true,
        startDate: true,
        endDate: true,
        projectId: true,
        project: { select: { workspaceId: true } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      goal: row.goal,
      startDate: row.startDate,
      endDate: row.endDate,
      projectId: row.projectId,
      workspaceId: row.project.workspaceId,
    };
  },

  async getSprintTasks(sprintId: string): Promise<RawTaskData[]> {
    const rows = await prisma.task.findMany({
      where: { sprintId },
      select: {
        id: true,
        title: true,
        originalEstimateMinutes: true,
        statusId: true,
        status: {
          select: {
            name: true,
            isDone: true,
          },
        },
        priority: true,
        createdAt: true,
        updatedAt: true,
        assignee: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      originalEstimateMinutes: r.originalEstimateMinutes,
      statusId: r.statusId,
      statusName: r.status.name,
      isDone: r.status.isDone,
      priority: r.priority,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      assignee: r.assignee,
    }));
  },

  async getSprintActivities(taskIds: string[]): Promise<RawActivityData[]> {
    if (taskIds.length === 0) return [];
    const rows = await prisma.activity.findMany({
      where: {
        taskId: { in: taskIds },
      },
      select: {
        taskId: true,
        type: true,
        oldValue: true,
        newValue: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return rows.map((r) => ({
      taskId: r.taskId,
      type: r.type,
      oldValue: r.oldValue,
      newValue: r.newValue,
      createdAt: r.createdAt,
    }));
  },

  async getSprintWorklogs(taskIds: string[]): Promise<RawWorklogData[]> {
    if (taskIds.length === 0) return [];
    const rows = await prisma.worklog.findMany({
      where: {
        taskId: { in: taskIds },
      },
      select: {
        taskId: true,
        timeSpentMinutes: true,
        startedAt: true,
      },
      orderBy: { startedAt: "asc" },
    });

    return rows.map((r) => ({
      taskId: r.taskId,
      timeSpentMinutes: r.timeSpentMinutes,
      startedAt: r.startedAt,
    }));
  },
};
