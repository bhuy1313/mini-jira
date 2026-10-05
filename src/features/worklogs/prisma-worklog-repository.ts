import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { WorklogRecord, WorklogRepository } from "./worklog-service";
import type {
  TimesheetFilter,
  TimesheetRepository,
  TimesheetWorklogItem,
} from "./timesheet-service";

const WORKLOG_SELECT = {
  id: true,
  taskId: true,
  authorId: true,
  timeSpentMinutes: true,
  startedAt: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  task: {
    select: {
      projectId: true,
      project: {
        select: {
          workspaceId: true,
        },
      },
    },
  },
  author: {
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  },
} as const;

type RawWorklog = {
  id: string;
  taskId: string;
  authorId: string;
  timeSpentMinutes: number;
  startedAt: Date;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  task: {
    projectId: string;
    project: {
      workspaceId: string;
    };
  };
  author: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
};

function toWorklogRecord(row: RawWorklog): WorklogRecord {
  return {
    id: row.id,
    taskId: row.taskId,
    workspaceId: row.task.project.workspaceId,
    projectId: row.task.projectId,
    authorId: row.authorId,
    timeSpentMinutes: row.timeSpentMinutes,
    startedAt: row.startedAt,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    author: row.author,
  };
}

export const prismaWorklogRepository: WorklogRepository & TimesheetRepository = {
  async getWorklog(worklogId: string): Promise<WorklogRecord | null> {
    const row = await prisma.worklog.findUnique({
      where: { id: worklogId },
      select: WORKLOG_SELECT,
    });
    return row ? toWorklogRecord(row) : null;
  },

  async listWorklogsByTask(taskId: string): Promise<WorklogRecord[]> {
    const rows = await prisma.worklog.findMany({
      where: { taskId },
      orderBy: { startedAt: "desc" },
      select: WORKLOG_SELECT,
    });
    return rows.map(toWorklogRecord);
  },

  async listWorklogsByTaskIds(taskIds: string[]): Promise<Record<string, WorklogRecord[]>> {
    const map: Record<string, WorklogRecord[]> = {};
    for (const id of taskIds) {
      map[id] = [];
    }

    if (taskIds.length === 0) return map;

    const rows = await prisma.worklog.findMany({
      where: { taskId: { in: taskIds } },
      orderBy: { startedAt: "desc" },
      select: WORKLOG_SELECT,
    });

    for (const row of rows) {
      const rec = toWorklogRecord(row);
      if (!map[rec.taskId]) {
        map[rec.taskId] = [];
      }
      map[rec.taskId].push(rec);
    }

    return map;
  },

  async createWorklog(input): Promise<WorklogRecord> {
    const id = randomUUID();
    const row = await prisma.worklog.create({
      data: {
        id,
        taskId: input.taskId,
        authorId: input.authorId,
        timeSpentMinutes: input.timeSpentMinutes,
        startedAt: input.startedAt ?? new Date(),
        description: input.description ?? null,
      },
      select: WORKLOG_SELECT,
    });
    return toWorklogRecord(row);
  },

  async updateWorklog(input): Promise<WorklogRecord> {
    const data: {
      timeSpentMinutes?: number;
      startedAt?: Date;
      description?: string | null;
    } = {};

    if (input.timeSpentMinutes !== undefined) {
      data.timeSpentMinutes = input.timeSpentMinutes;
    }
    if (input.startedAt !== undefined) {
      data.startedAt = input.startedAt;
    }
    if (input.description !== undefined) {
      data.description = input.description;
    }

    const row = await prisma.worklog.update({
      where: { id: input.worklogId },
      data,
      select: WORKLOG_SELECT,
    });
    return toWorklogRecord(row);
  },

  async deleteWorklog(worklogId: string): Promise<void> {
    await prisma.worklog.delete({
      where: { id: worklogId },
    });
  },

  async queryTimesheetWorklogs(
    workspaceId: string,
    filter: TimesheetFilter,
  ): Promise<TimesheetWorklogItem[]> {
    const where: {
      startedAt: { gte: Date; lte: Date };
      task: { project: { workspaceId: string }; projectId?: string };
      authorId?: string;
    } = {
      startedAt: {
        gte: filter.startDate,
        lte: filter.endDate,
      },
      task: {
        project: {
          workspaceId,
        },
      },
    };

    if (filter.projectId) {
      where.task.projectId = filter.projectId;
    }
    if (filter.authorId) {
      where.authorId = filter.authorId;
    }

    const rows = await prisma.worklog.findMany({
      where,
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        taskId: true,
        authorId: true,
        timeSpentMinutes: true,
        startedAt: true,
        description: true,
        createdAt: true,
        task: {
          select: {
            title: true,
            projectId: true,
            project: {
              select: {
                id: true,
                name: true,
                workspaceId: true,
              },
            },
          },
        },
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      taskId: row.taskId,
      taskTitle: row.task.title,
      authorId: row.authorId,
      authorName: row.author.name,
      authorEmail: row.author.email,
      authorImage: row.author.image,
      projectId: row.task.projectId,
      projectName: row.task.project.name,
      timeSpentMinutes: row.timeSpentMinutes,
      startedAt: row.startedAt,
      description: row.description,
      createdAt: row.createdAt,
    }));
  },
};
