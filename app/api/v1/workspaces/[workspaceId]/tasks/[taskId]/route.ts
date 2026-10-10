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
import { createTaskService } from "@/features/tasks/task-service";

export const runtime = "nodejs";

const taskService = createTaskService({
  repo: prismaTaskRepository,
  notifications: liveNotificationPublisher,
  ruleEvaluator: ruleEngine,
});

const updateTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title must be at least 1 character.")
    .max(200, "Title must be at most 200 characters.")
    .optional(),
  description: z.string().trim().max(5000, "Description is too long.").nullable().optional(),
  statusId: z.string().trim().min(1, "Status ID cannot be empty.").optional(),
  priority: z.enum(PRIORITIES).optional(),
  assigneeId: z.string().trim().min(1).nullable().optional(),
  dueDate: z
    .union([z.string().trim().min(1), z.null(), z.undefined()])
    .transform((val) => {
      if (val === undefined) return undefined;
      if (!val) return null;
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    })
    .optional(),
  sprintId: z.string().trim().min(1).nullable().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; taskId: string }> },
) {
  try {
    const { workspaceId, taskId } = await params;
    const { actor } = await requireApiActor(request, workspaceId);

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        status: {
          select: {
            id: true,
            name: true,
            position: true,
            isDefault: true,
            isDone: true,
          },
        },
        sprint: {
          select: {
            id: true,
            name: true,
            goal: true,
            startDate: true,
            endDate: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            key: true,
            workspaceId: true,
          },
        },
        labels: {
          include: {
            label: true,
          },
        },
        customFieldValues: {
          include: {
            field: true,
          },
        },
        _count: {
          select: {
            comments: true,
            attachments: true,
            activities: true,
          },
        },
      },
    });

    if (!task || task.project.workspaceId !== actor.workspaceId) {
      return jsonError("NOT_FOUND", "Task not found in this workspace.", 404);
    }

    return jsonSuccess({
      id: task.id,
      key: task.key,
      title: task.title,
      description: task.description,
      priority: task.priority,
      dueDate: task.dueDate,
      position: task.position,
      projectId: task.projectId,
      projectName: task.project.name,
      status: task.status,
      sprint: task.sprint,
      creator: task.creator,
      assignee: task.assignee,
      labels: task.labels.map((l) => l.label),
      customFieldValues: task.customFieldValues.map((cf) => ({
        fieldId: cf.fieldId,
        fieldName: cf.field.name,
        fieldType: cf.field.type,
        value: cf.value,
      })),
      counts: task._count,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; taskId: string }> },
) {
  try {
    const { workspaceId, taskId } = await params;
    const { actor } = await requireApiActor(request, workspaceId);

    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        projectId: true,
        project: { select: { workspaceId: true } },
      },
    });

    if (!existingTask || existingTask.project.workspaceId !== actor.workspaceId) {
      return jsonError("NOT_FOUND", "Task not found in this workspace.", 404);
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return jsonError("VALIDATION_ERROR", "Request body must be valid JSON.", 400);
    }

    const parsed = updateTaskSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }

    const updates = parsed.data;

    if (updates.title !== undefined) {
      await taskService.updateTask(actor, taskId, "title", updates.title);
    }
    if (updates.description !== undefined) {
      await taskService.updateTask(actor, taskId, "description", updates.description);
    }
    if (updates.statusId !== undefined) {
      await taskService.updateTask(actor, taskId, "status", updates.statusId);
    }
    if (updates.priority !== undefined) {
      await taskService.updateTask(actor, taskId, "priority", updates.priority);
    }
    if (updates.assigneeId !== undefined) {
      await taskService.updateTask(actor, taskId, "assigneeId", updates.assigneeId);
    }
    if (updates.dueDate !== undefined) {
      await taskService.updateTask(actor, taskId, "dueDate", updates.dueDate);
    }
    if (updates.sprintId !== undefined) {
      await taskService.updateTask(actor, taskId, "sprintId", updates.sprintId);
    }

    const updatedTask = await taskService.getTask(actor, taskId);
    return jsonSuccess(updatedTask);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; taskId: string }> },
) {
  try {
    const { workspaceId, taskId } = await params;
    const { actor } = await requireApiActor(request, workspaceId);

    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        project: { select: { workspaceId: true } },
      },
    });

    if (!existingTask || existingTask.project.workspaceId !== actor.workspaceId) {
      return jsonError("NOT_FOUND", "Task not found in this workspace.", 404);
    }

    await taskService.deleteTask(actor, taskId);
    return jsonSuccess({ message: "Task deleted successfully." });
  } catch (err) {
    return handleApiError(err);
  }
}
