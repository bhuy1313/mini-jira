import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import type { Priority } from "@/features/authorization/permissions";
import type { TaskFilterInput, TaskRecord, TaskRepository } from "./task-service";


type RawTask = {
  id: string;
  key: string | null;
  projectId: string;
  title: string;
  description: string | null;
  statusId: string;
  status?: { id: string; name: string; isDone?: boolean } | null;
  sprintId: string | null;
  sprint?: { id: string; name: string } | null;
  parentId?: string | null;
  parent?: { id: string; title: string } | null;
  priority: "Low" | "Medium" | "High" | "Urgent";
  dueDate: Date | null;
  position: { toNumber(): number };
  creatorId: string;
  assigneeId: string | null;
  project: { workspaceId: string };
  originalEstimateMinutes?: number | null;
  subTasks?: Array<{
    id: string;
    title: string;
    statusId: string;
    status?: { id: string; name: string; isDone?: boolean } | null;
    priority: "Low" | "Medium" | "High" | "Urgent";
    assigneeId: string | null;
  }>;
};

function toTaskRecord(row: RawTask): TaskRecord {
  const subtasks = row.subTasks?.map((st) => ({
    id: st.id,
    title: st.title,
    statusId: st.statusId,
    statusName: st.status?.name ?? "",
    isDone: Boolean(st.status?.isDone),
    priority: st.priority,
    assigneeId: st.assigneeId,
  })) ?? [];

  const subtaskDoneCount = subtasks.filter((s) => s.isDone).length;

  return {
    id: row.id,
    key: row.key ?? null,
    projectId: row.projectId,
    workspaceId: row.project.workspaceId,
    creatorId: row.creatorId,
    assigneeId: row.assigneeId,
    title: row.title,
    description: row.description,
    statusId: row.statusId,
    statusName: row.status?.name ?? "",
    sprintId: row.sprintId,
    sprintName: row.sprint?.name ?? undefined,
    priority: row.priority,
    dueDate: row.dueDate,
    position: row.position.toNumber(),
    parentId: row.parentId ?? null,
    parentTitle: row.parent?.title ?? null,
    subtaskCount: subtasks.length,
    subtaskDoneCount,
    subtasks,
    originalEstimateMinutes: row.originalEstimateMinutes ?? null,
  };
}

/**
 * Row shape returned by $queryRawUnsafe for FTS queries.
 * position arrives as a plain number/string (not a Decimal object) from raw SQL.
 */
type FtsRow = {
  id: string;
  key: string | null;
  projectId: string;
  title: string;
  description: string | null;
  statusId: string;
  sprintId: string | null;
  parentId?: string | null;
  priority: string;
  dueDate: Date | null;
  position: unknown;
  creatorId: string;
  assigneeId: string | null;
  workspaceId: string;
  statusName: string;
  sprintName: string | null;
  originalEstimateMinutes?: number | null;
};

function ftsRowToTaskRecord(row: FtsRow): TaskRecord {
  return {
    id: row.id,
    key: row.key ?? null,
    projectId: row.projectId,
    workspaceId: row.workspaceId,
    creatorId: row.creatorId,
    assigneeId: row.assigneeId,
    title: row.title,
    description: row.description,
    statusId: row.statusId,
    statusName: row.statusName,
    sprintId: row.sprintId,
    sprintName: row.sprintName ?? undefined,
    priority: row.priority as Priority,
    dueDate: row.dueDate,
    position: Number(row.position),
    parentId: row.parentId ?? null,
    parentTitle: null,
    subtaskCount: 0,
    subtaskDoneCount: 0,
    subtasks: [],
    originalEstimateMinutes: row.originalEstimateMinutes ?? null,
  };
}

const TASK_SELECT = {
  id: true,
  key: true,
  projectId: true,
  title: true,
  description: true,
  statusId: true,
  status: { select: { id: true, name: true, isDone: true } },
  sprintId: true,
  sprint: { select: { id: true, name: true } },
  parentId: true,
  parent: { select: { id: true, title: true } },
  priority: true,
  dueDate: true,
  position: true,
  creatorId: true,
  assigneeId: true,
  project: { select: { workspaceId: true } },
  originalEstimateMinutes: true,
  subTasks: {
    select: {
      id: true,
      title: true,
      statusId: true,
      status: { select: { id: true, name: true, isDone: true } },
      priority: true,
      assigneeId: true,
    },
    orderBy: { position: "asc" },
  },
} as const;

/**
 * Implement `TaskRepository` bằng Prisma (DB thật). Mọi guard/quyền do service
 * layer đảm bảo; lớp này đọc/ghi và ghi Activity trong cùng transaction khi được cung cấp.
 *
 * Mốc 17: searchWorkspaceTasks và listTasksByProject dùng PostgreSQL full-text search
 * (tsvector @@ websearch_to_tsquery) khi có query string; fallback về Prisma ORM khi không có.
 */
export const prismaTaskRepository: TaskRepository = {
  async getTask(taskId: string): Promise<TaskRecord | null> {
    const row = await prisma.task.findUnique({
      where: { id: taskId },
      select: TASK_SELECT,
    });
    return row ? toTaskRecord(row) : null;
  },

  async getStatusName(statusId: string): Promise<string | null> {
    const row = await prisma.status.findUnique({
      where: { id: statusId },
      select: { name: true },
    });
    return row?.name ?? null;
  },

  async getSprintName(sprintId: string): Promise<string | null> {
    const row = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: { name: true },
    });
    return row?.name ?? null;
  },

  async getSprintProjectId(sprintId: string): Promise<string | null> {
    const row = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: { projectId: true },
    });
    return row?.projectId ?? null;
  },

  async getDefaultProjectStatusId(projectId: string): Promise<string | null> {
    const def = await prisma.status.findFirst({
      where: { projectId, isDefault: true },
      select: { id: true },
    });
    if (def) return def.id;

    const first = await prisma.status.findFirst({
      where: { projectId },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    return first?.id ?? null;
  },

  async getDoneProjectStatusId(projectId: string): Promise<string | null> {
    const done = await prisma.status.findFirst({
      where: { projectId, isDone: true },
      select: { id: true },
    });
    if (done) return done.id;

    const byName = await prisma.status.findFirst({
      where: { projectId, name: { equals: "Done", mode: "insensitive" } },
      select: { id: true },
    });
    if (byName) return byName.id;

    const last = await prisma.status.findFirst({
      where: { projectId },
      orderBy: { position: "desc" },
      select: { id: true },
    });
    return last?.id ?? null;
  },

  async listSubtasks(parentTaskId: string): Promise<TaskRecord[]> {
    const rows = await prisma.task.findMany({
      where: { parentId: parentTaskId },
      select: TASK_SELECT,
      orderBy: { position: "asc" },
    });
    return rows.map(toTaskRecord);
  },

  async listTasksByProject(projectId: string, filter?: TaskFilterInput): Promise<TaskRecord[]> {
    const q = filter?.query?.trim() ?? "";
    // Board cap: chỉ cắt khi caller xin limit, kẹp >= 1 để tránh take(0)/LIMIT 0.
    const take = filter?.limit !== undefined ? Math.max(1, Math.floor(filter.limit)) : undefined;

    // Mốc 17: Full-text search path — khi có query, dùng tsvector
    if (q.length > 0) {
      const extraConditions: string[] = [];
      const params: unknown[] = [projectId, q]; // $1=projectId, $2=query
      let idx = 3;

      if (filter?.statusId) {
        extraConditions.push(`t."statusId" = $${idx}`);
        params.push(filter.statusId);
        idx++;
      }
      if (filter?.priority) {
        extraConditions.push(`t."priority" = $${idx}`);
        params.push(filter.priority);
        idx++;
      }
      if (filter?.assigneeId === "unassigned") {
        extraConditions.push(`t."assigneeId" IS NULL`);
      } else if (filter?.assigneeId) {
        extraConditions.push(`t."assigneeId" = $${idx}`);
        params.push(filter.assigneeId);
        idx++;
      }
      if (filter?.labelId) {
        extraConditions.push(
          `EXISTS (SELECT 1 FROM "task_label" tl WHERE tl."taskId" = t.id AND tl."labelId" = $${idx})`,
        );
        params.push(filter.labelId);
        idx++;
      }
      if (filter?.sprintId === "backlog") {
        extraConditions.push(`t."sprintId" IS NULL`);
      } else if (filter?.sprintId) {
        extraConditions.push(`t."sprintId" = $${idx}`);
        params.push(filter.sprintId);
        idx++;
      }

      const extra = extraConditions.length > 0 ? ` AND ${extraConditions.join(" AND ")}` : "";
      // Tìm theo key (PRJ-123): ILIKE trên cột key, thoát wildcard của user.
      // Đặt sau extra để chiếm $idx hiện tại, trước LIMIT.
      const keyParamIdx = idx++;
      params.push(`%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
      const limitClause = take !== undefined ? ` LIMIT $${idx}` : "";
      const limitParams: unknown[] = take !== undefined ? [take] : [];
      const sql = `
        SELECT t.id, t.key, t."projectId", t.title, t.description,
          t."statusId", t."sprintId", t.priority, t."dueDate",
          t.position, t."creatorId", t."assigneeId",
          p."workspaceId",
          s.name as "statusName",
          sp.name as "sprintName",
          ts_rank(t."search_vector", websearch_to_tsquery('simple', $2)) as rank
        FROM "task" t
        JOIN "project" p ON t."projectId" = p.id
        JOIN "status" s ON t."statusId" = s.id
        LEFT JOIN "sprint" sp ON t."sprintId" = sp.id
        WHERE t."projectId" = $1
          AND (t."search_vector" IS NULL OR t."search_vector" @@ websearch_to_tsquery('simple', $2) OR t."key" ILIKE $${keyParamIdx} ESCAPE '\\')
          ${extra}
        ORDER BY rank DESC, s.position ASC, t.position ASC
        ${limitClause}
      `;

      const rows = await prisma.$queryRawUnsafe<FtsRow[]>(sql, ...params, ...limitParams);
      return rows.map(ftsRowToTaskRecord);
    }

    // Fallback path: Prisma ORM (ILIKE / other filters) khi không có query
    const where: Prisma.TaskWhereInput = { projectId };

    if (filter?.statusId) {
      where.statusId = filter.statusId;
    }
    if (filter?.priority) {
      where.priority = filter.priority;
    }
    if (filter?.assigneeId) {
      where.assigneeId = filter.assigneeId === "unassigned" ? null : filter.assigneeId;
    }
    if (filter?.labelId) {
      where.labels = { some: { labelId: filter.labelId } };
    }
    if (filter?.sprintId) {
      where.sprintId = filter.sprintId === "backlog" ? null : filter.sprintId;
    }

    const rows = await prisma.task.findMany({
      where,
      select: TASK_SELECT,
      orderBy: [{ status: { position: "asc" } }, { position: "asc" }],
      ...(take !== undefined ? { take } : {}),
    });
    return rows.map(toTaskRecord);
  },

  async searchWorkspaceTasks(workspaceId: string, filter: TaskFilterInput): Promise<TaskRecord[]> {
    const q = filter.query?.trim() ?? "";

    // Mốc 17: Full-text search path — khi có query, dùng tsvector
    if (q.length > 0) {
      const extraConditions: string[] = [];
      const params: unknown[] = [workspaceId, q]; // $1=workspaceId, $2=query
      let idx = 3;

      if (filter.statusId) {
        extraConditions.push(`t."statusId" = $${idx}`);
        params.push(filter.statusId);
        idx++;
      }
      if (filter.priority) {
        extraConditions.push(`t."priority" = $${idx}`);
        params.push(filter.priority);
        idx++;
      }
      if (filter.assigneeId === "unassigned") {
        extraConditions.push(`t."assigneeId" IS NULL`);
      } else if (filter.assigneeId) {
        extraConditions.push(`t."assigneeId" = $${idx}`);
        params.push(filter.assigneeId);
        idx++;
      }
      if (filter.labelId) {
        extraConditions.push(
          `EXISTS (SELECT 1 FROM "task_label" tl WHERE tl."taskId" = t.id AND tl."labelId" = $${idx})`,
        );
        params.push(filter.labelId);
        idx++;
      }

      const extra = extraConditions.length > 0 ? ` AND ${extraConditions.join(" AND ")}` : "";
      const keyParamIdx = idx++;
      params.push(`%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
      const sql = `
        SELECT t.id, t.key, t."projectId", t.title, t.description,
          t."statusId", t."sprintId", t.priority, t."dueDate",
          t.position, t."creatorId", t."assigneeId",
          p."workspaceId",
          s.name as "statusName",
          sp.name as "sprintName",
          ts_rank(t."search_vector", websearch_to_tsquery('simple', $2)) as rank
        FROM "task" t
        JOIN "project" p ON t."projectId" = p.id
        JOIN "status" s ON t."statusId" = s.id
        LEFT JOIN "sprint" sp ON t."sprintId" = sp.id
        WHERE p."workspaceId" = $1
          AND p."archivedAt" IS NULL
          AND (t."search_vector" IS NULL OR t."search_vector" @@ websearch_to_tsquery('simple', $2) OR t."key" ILIKE $${keyParamIdx} ESCAPE '\\')
          ${extra}
        ORDER BY rank DESC, t."updatedAt" DESC
      `;

      const rows = await prisma.$queryRawUnsafe<FtsRow[]>(sql, ...params);
      return rows.map(ftsRowToTaskRecord);
    }

    // Fallback path: Prisma ORM khi không có query
    const where: Prisma.TaskWhereInput = {
      project: {
        workspaceId,
        archivedAt: null, // Chỉ active projects (FR-080)
      },
    };

    if (filter.statusId) where.statusId = filter.statusId;
    if (filter.priority) where.priority = filter.priority;
    if (filter.assigneeId) {
      where.assigneeId = filter.assigneeId === "unassigned" ? null : filter.assigneeId;
    }
    if (filter.labelId) where.labels = { some: { labelId: filter.labelId } };

    const rows = await prisma.task.findMany({
      where,
      select: TASK_SELECT,
      orderBy: [{ updatedAt: "desc" }],
    });
    return rows.map(toTaskRecord);
  },

  async listWorkspaceMemberIds(workspaceId: string): Promise<string[]> {
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  },

  async createTask(input): Promise<TaskRecord> {
    const taskId = randomUUID();
    return prisma.$transaction(async (tx) => {
      // Đếm nguyên tử trên row project trong cùng tx: concurrent create
      // serialize ở row-lock nên key không bao giờ trùng/khuyết số.
      const project = await tx.project.update({
        where: { id: input.projectId },
        data: { taskCounter: { increment: 1 } },
        select: { key: true, taskCounter: true },
      });
      const row = await tx.task.create({
        data: {
          id: taskId,
          key: `${project.key}-${project.taskCounter}`,
          projectId: input.projectId,
          creatorId: input.creatorId,
          title: input.title,
          description: input.description,
          statusId: input.statusId,
          priority: input.priority,
          assigneeId: input.assigneeId,
          dueDate: input.dueDate,
          position: new Prisma.Decimal(input.position),
          parentId: input.parentId ?? null,
          sprintId: input.sprintId ?? null,
          originalEstimateMinutes: input.originalEstimateMinutes ?? null,
        },
        select: TASK_SELECT,
      });

      if (input.activity) {
        await tx.activity.create({
          data: {
            id: randomUUID(),
            type: input.activity.type,
            taskId,
            actorId: input.activity.actorId,
            oldValue: input.activity.oldValue,
            newValue: input.activity.newValue,
          },
        });
      }

      return toTaskRecord(row);
    });
  },

  async updateTask(input): Promise<TaskRecord> {
    const data: Prisma.TaskUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.statusId !== undefined) {
      data.status = { connect: { id: input.statusId } };
    }
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.assigneeId !== undefined) {
      data.assignee = input.assigneeId ? { connect: { id: input.assigneeId } } : { disconnect: true };
    }
    if (input.dueDate !== undefined) data.dueDate = input.dueDate;
    if (input.sprintId !== undefined) {
      data.sprint = input.sprintId ? { connect: { id: input.sprintId } } : { disconnect: true };
    }
    if (input.parentId !== undefined) {
      data.parent = input.parentId ? { connect: { id: input.parentId } } : { disconnect: true };
    }
    if (input.originalEstimateMinutes !== undefined) {
      data.originalEstimateMinutes = input.originalEstimateMinutes;
    }

    return prisma.$transaction(async (tx) => {
      const row = await tx.task.update({
        where: { id: input.taskId },
        data,
        select: TASK_SELECT,
      });

      if (input.activity) {
        await tx.activity.create({
          data: {
            id: randomUUID(),
            type: input.activity.type,
            taskId: input.taskId,
            actorId: input.activity.actorId,
            oldValue: input.activity.oldValue,
            newValue: input.activity.newValue,
          },
        });
      }

      return toTaskRecord(row);
    });
  },

  async updateTaskPosition(input): Promise<TaskRecord> {
    return prisma.$transaction(async (tx) => {
      const row = await tx.task.update({
        where: { id: input.taskId },
        data: {
          status: { connect: { id: input.statusId } },
          position: new Prisma.Decimal(input.position),
        },
        select: TASK_SELECT,
      });

      if (input.activity) {
        await tx.activity.create({
          data: {
            id: randomUUID(),
            type: input.activity.type,
            taskId: input.taskId,
            actorId: input.activity.actorId,
            oldValue: input.activity.oldValue,
            newValue: input.activity.newValue,
          },
        });
      }

      return toTaskRecord(row);
    });
  },

  async rebalanceColumn(input): Promise<void> {
    await prisma.$transaction(async (tx) => {
      for (const o of input.order) {
        await tx.task.update({
          where: { id: o.taskId },
          data: { position: new Prisma.Decimal(o.position) },
        });
      }

      if (input.activity && input.taskId) {
        await tx.activity.create({
          data: {
            id: randomUUID(),
            type: input.activity.type,
            taskId: input.taskId,
            actorId: input.activity.actorId,
            oldValue: input.activity.oldValue,
            newValue: input.activity.newValue,
          },
        });
      }
    });
  },

  async deleteTask(taskId: string): Promise<void> {
    // Cascade trong schema (Task -> Comment, Activity) dọn theo (BR-014).
    await prisma.task.delete({ where: { id: taskId } });
  },
};
