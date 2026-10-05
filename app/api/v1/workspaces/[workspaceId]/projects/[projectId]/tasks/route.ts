import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  handleApiError,
  jsonError,
  jsonSuccess,
  requireApiActor,
} from "@/features/api-keys/api-response";
import { PRIORITIES, type Priority } from "@/features/authorization/permissions";
import { ruleEngine } from "@/features/automation/rule-engine";
import { liveNotificationPublisher } from "@/features/notifications/live-notification-publisher-prisma";
import { prismaTaskRepository } from "@/features/tasks/prisma-task-repository";
import { createTaskService, type TaskFilterInput } from "@/features/tasks/task-service";

export const runtime = "nodejs";

const taskService = createTaskService({
  repo: prismaTaskRepository,
  notifications: liveNotificationPublisher,
  ruleEvaluator: ruleEngine,
});

const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required and must be at least 1 character.")
    .max(200, "Title must be at most 200 characters."),
  description: z.string().trim().max(5000, "Description is too long.").nullable().optional(),
  statusId: z.string().trim().min(1, "Status ID cannot be empty.").optional(),
  priority: z.enum(PRIORITIES).optional(),
  assigneeId: z.string().trim().min(1).nullable().optional(),
  dueDate: z
    .union([z.string().trim().min(1), z.null(), z.undefined()])
    .transform((val) => {
      if (!val) return null;
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    })
    .optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; projectId: string }> },
) {
  try {
    const { workspaceId, projectId } = await params;
    const { actor } = await requireApiActor(request, workspaceId);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true, archivedAt: true },
    });

    if (!project || project.workspaceId !== actor.workspaceId || project.archivedAt) {
      return jsonError("NOT_FOUND", "Project not found in this workspace.", 404);
    }

    const { searchParams } = new URL(request.url);
    const statusId = searchParams.get("statusId") || undefined;
    const priority = searchParams.get("priority") as Priority | undefined;
    const assigneeId = searchParams.get("assigneeId") || undefined;
    const q = searchParams.get("q") || searchParams.get("query") || undefined;
    const sprintId = searchParams.get("sprintId") || undefined;
    const labelId = searchParams.get("labelId") || undefined;

    const filter: TaskFilterInput = {
      statusId,
      priority: priority && PRIORITIES.includes(priority) ? priority : undefined,
      assigneeId,
      query: q,
      sprintId,
      labelId,
    };

    const tasks = await taskService.listBoard(actor, projectId, filter);
    return jsonSuccess(tasks);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; projectId: string }> },
) {
  try {
    const { workspaceId, projectId } = await params;
    const { actor } = await requireApiActor(request, workspaceId);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true, archivedAt: true },
    });

    if (!project || project.workspaceId !== actor.workspaceId || project.archivedAt) {
      return jsonError("NOT_FOUND", "Project not found in this workspace.", 404);
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return jsonError("VALIDATION_ERROR", "Request body must be valid JSON.", 400);
    }

    const parsed = createTaskSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }

    const { title, description, statusId, priority, assigneeId, dueDate } = parsed.data;

    const created = await taskService.createTask(actor, projectId, {
      title,
      description,
      statusId,
      priority,
      assigneeId,
      dueDate,
    });

    return jsonSuccess(created, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
