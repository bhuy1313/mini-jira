import type { Actor } from "@/features/authorization/actor";
import { effectiveRole, requirePermission, requireTaskFieldEdit } from "@/features/authorization/actor";
import { UnauthorizedError, ValidationError } from "@/features/authorization/errors";
import {
  canAssignTask,
  canChangeDueDate,
  canChangePriority,
  canCreateTask,
  canDeleteTask,
  canViewTasks,
  type Priority,
  type TaskField,
} from "@/features/authorization/permissions";
import { insertionPosition } from "@/features/tasks/position";
import { logger } from "@/lib/logger";
import type { NotificationPublisher } from "@/features/notifications/notification-service";
import type { RuleTriggerEvent } from "@/features/automation/automation-types";
import type { WebhookDispatcher } from "@/features/webhooks/webhook-dispatcher";

/**
 * Service task — mọi method nhận `Actor` và đi qua guard trước khi chạm dữ liệu.
 *
 * Task luôn được xác minh thuộc workspace của actor (qua `workspaceId` của task).
 * Position dùng fractional ordering (FR-052); chỉ rebalance cùng cột khi không còn
 * khoảng số hợp lệ (FR-053). Move bằng menu/control (FR-054).
 *
 * Ghi Activity immutable trong cùng transaction với: task create, title/status/priority/assignee/due date change (FR-070).
 * Không ghi Activity cho description (FR-071).
 *
 * Hỗ trợ Search & Filter (FR-080..FR-085).
 */

export interface SubtaskSummary {
  id: string;
  title: string;
  statusId: string;
  statusName: string;
  isDone: boolean;
  priority: Priority;
  assigneeId: string | null;
}

export interface TaskRecord {
  id: string;
  projectId: string;
  workspaceId: string;
  creatorId: string;
  assigneeId: string | null;
  title: string;
  description: string | null;
  statusId: string;
  statusName?: string;
  sprintId: string | null;
  sprintName?: string;
  priority: Priority;
  dueDate: Date | null;
  position: number;
  parentId: string | null;
  parentTitle?: string | null;
  subtaskCount: number;
  subtaskDoneCount: number;
  subtasks?: SubtaskSummary[];
  originalEstimateMinutes?: number | null;
}

export interface TaskFilterInput {
  query?: string;
  statusId?: string;
  priority?: Priority;
  assigneeId?: string | "unassigned";
  labelId?: string;
  /** Mốc 15: lọc theo sprint. "backlog" = task chưa thuộc sprint nào. */
  sprintId?: string | "backlog";
  /**
   * Giới hạn số task repo trả về. Board luôn set để cột không phình vô hạn;
   * caller phát hiện cắt cụt bằng cách xin limit+1 rồi dùng applyBoardLimit.
   */
  limit?: number;
}

/**
 * Safety cap cho board: đủ lớn để board thực tế không bao giờ chạm, đủ nhỏ
 * để một project bệnh hoạn không kéo sập page. Pagination UX thật
 * (virtualize/load-more từng cột) để dành khi có số liệu cần.
 */
export const BOARD_TASK_LIMIT = 500;

/** Cắt tasks về limit, báo truncated để UI hiện banner thay vì mất lặng lẽ. */
export function applyBoardLimit(
  tasks: TaskRecord[],
  limit: number = BOARD_TASK_LIMIT,
): { tasks: TaskRecord[]; truncated: boolean } {
  if (tasks.length <= limit) return { tasks, truncated: false };
  return { tasks: tasks.slice(0, limit), truncated: true };
}

export interface TaskActivityInput {
  type:
    | "TaskCreated"
    | "TitleChanged"
    | "StatusChanged"
    | "PriorityChanged"
    | "AssigneeChanged"
    | "DueDateChanged"
    | "SprintChanged"
    | "EstimateChanged"
    | "Worklogged";
  actorId: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface TaskRepository {
  getTask(taskId: string): Promise<TaskRecord | null>;
  getStatusName(statusId: string): Promise<string | null>;
  getSprintName(sprintId: string): Promise<string | null>;
  getSprintProjectId(sprintId: string): Promise<string | null>;
  getDefaultProjectStatusId(projectId: string): Promise<string | null>;
  getDoneProjectStatusId(projectId: string): Promise<string | null>;
  listTasksByProject(projectId: string, filter?: TaskFilterInput): Promise<TaskRecord[]>;
  searchWorkspaceTasks(workspaceId: string, filter: TaskFilterInput): Promise<TaskRecord[]>;
  listWorkspaceMemberIds(workspaceId: string): Promise<string[]>;
  listSubtasks(parentTaskId: string): Promise<TaskRecord[]>;
  createTask(input: {
    projectId: string;
    creatorId: string;
    title: string;
    description: string | null;
    statusId: string;
    priority: Priority;
    assigneeId: string | null;
    dueDate: Date | null;
    position: number;
    parentId?: string | null;
    sprintId?: string | null;
    originalEstimateMinutes?: number | null;
    activity?: TaskActivityInput;
  }): Promise<TaskRecord>;
  updateTask(input: {
    taskId: string;
    title?: string;
    description?: string | null;
    statusId?: string;
    priority?: Priority;
    assigneeId?: string | null;
    dueDate?: Date | null;
    sprintId?: string | null;
    parentId?: string | null;
    originalEstimateMinutes?: number | null;
    activity?: TaskActivityInput;
  }): Promise<TaskRecord>;
  updateTaskPosition(input: {
    taskId: string;
    statusId: string;
    position: number;
    activity?: TaskActivityInput;
  }): Promise<TaskRecord>;
  rebalanceColumn(input: {
    projectId: string;
    statusId: string;
    order: { taskId: string; position: number }[];
    taskId?: string;
    activity?: TaskActivityInput;
  }): Promise<void>;
  deleteTask(taskId: string): Promise<void>;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  statusId?: string;
  priority?: Priority;
  assigneeId?: string | null;
  dueDate?: Date | null;
  parentId?: string | null;
  sprintId?: string | null;
  originalEstimateMinutes?: number | null;
}

export interface TaskRuleEvaluator {
  evaluate(event: RuleTriggerEvent): Promise<void>;
}

interface Deps {
  repo: TaskRepository;
  notifications?: NotificationPublisher;
  ruleEvaluator?: TaskRuleEvaluator;
  webhooks?: WebhookDispatcher;
}

/** Xác minh task thuộc workspace của actor; trả về task hoặc ném lỗi.
 * H2: nếu actor là ProjectActor thì cũng xác minh task thuộc đúng project đó. */
async function fetchOwnedTask(repo: TaskRepository, actor: Actor, taskId: string): Promise<TaskRecord> {
  const task = await repo.getTask(taskId);
  if (!task || task.workspaceId !== actor.workspaceId) {
    throw new UnauthorizedError("Task not found or does not belong to your workspace.");
  }
  // H2: ProjectActor must not access tasks in other projects within the same workspace
  if ("projectId" in actor && task.projectId !== (actor as { projectId: string }).projectId) {
    throw new UnauthorizedError("Task does not belong to this project.");
  }
  return task;
}

/** Xác minh assignee là member của workspace (BR-007). */
async function validateAssignee(
  repo: TaskRepository,
  actor: Actor,
  assigneeId: string | null | undefined,
): Promise<string | null | undefined> {
  if (assigneeId === undefined) return assigneeId;
  if (assigneeId === null) return null;
  const memberIds = await repo.listWorkspaceMemberIds(actor.workspaceId);
  requirePermission(
    actor,
    memberIds.includes(assigneeId),
    "Assignee must be a member of this workspace (BR-007).",
  );
  return assigneeId;
}

export function createTaskService({ repo, notifications, ruleEvaluator, webhooks }: Deps) {
  /** Board: mọi member xem được, hỗ trợ filter (FR-041, FR-050, FR-082..085). */
  async function listBoard(
    actor: Actor,
    projectId: string,
    filter?: TaskFilterInput,
  ): Promise<TaskRecord[]> {
    requirePermission(actor, canViewTasks(actor.role), "You are not a member of this workspace.");
    const tasks = await repo.listTasksByProject(projectId, filter);
    return tasks.filter((t) => t.workspaceId === actor.workspaceId);
  }

  /** Search across active projects trong workspace hiện tại (FR-080, FR-081, FR-085). */
  async function searchWorkspaceTasks(
    actor: Actor,
    filter: TaskFilterInput,
  ): Promise<TaskRecord[]> {
    requirePermission(actor, canViewTasks(actor.role), "You are not a member of this workspace.");
    const tasks = await repo.searchWorkspaceTasks(actor.workspaceId, filter);
    return tasks.filter((t) => t.workspaceId === actor.workspaceId);
  }

  /** Task detail — mọi member xem (FR-041). */
  async function getTask(actor: Actor, taskId: string): Promise<TaskRecord> {
    requirePermission(actor, canViewTasks(actor.role), "You are not a member of this workspace.");
    return fetchOwnedTask(repo, actor, taskId);
  }

  /** Tạo task — mọi member (FR-040); assignee phải là member (BR-007). Ghi Activity (FR-070). */
  async function createTask(actor: Actor, projectId: string, input: CreateTaskInput): Promise<TaskRecord> {
    requirePermission(actor, canCreateTask(actor.role), "You do not have permission to create tasks.");
    const assigneeId = await validateAssignee(repo, actor, input.assigneeId);
    
    let statusId = input.statusId;
    if (!statusId) {
      const defaultStatusId = await repo.getDefaultProjectStatusId(projectId);
      if (!defaultStatusId) {
        throw new UnauthorizedError("Project has no statuses.");
      }
      statusId = defaultStatusId;
    }

    let parentTask: TaskRecord | null = null;
    if (input.parentId) {
      parentTask = await repo.getTask(input.parentId);
      if (!parentTask || parentTask.workspaceId !== actor.workspaceId || parentTask.projectId !== projectId) {
        throw new ValidationError("Parent task not found or belongs to another project.");
      }
      if (parentTask.parentId) {
        throw new ValidationError("Subtasks cannot have subtasks (max depth 1).");
      }
    }

    const sprintId = input.sprintId ?? parentTask?.sprintId ?? null;

    const column = (await repo.listTasksByProject(projectId))
      .filter((t) => t.statusId === statusId)
      .sort((a, b) => a.position - b.position);
    const last = column[column.length - 1]?.position ?? null;
    const placed = insertionPosition({ left: last, right: null });
    const position = placed.kind === "placed" ? placed.position : 0;

    const activity: TaskActivityInput = {
      type: "TaskCreated",
      actorId: actor.userId,
      oldValue: null,
      newValue: input.title.trim(),
    };

    const created = await repo.createTask({
      projectId,
      creatorId: actor.userId,
      title: input.title.trim(),
      description: input.description ?? null,
      statusId,
      priority: input.priority ?? "Medium",
      assigneeId: assigneeId ?? null,
      dueDate: input.dueDate ?? null,
      position,
      parentId: input.parentId ?? null,
      sprintId,
      originalEstimateMinutes: input.originalEstimateMinutes ?? null,
      activity,
    });

    // Notification: assignee khi được gán (Mốc 13) — không sinh thừa (FR-071).
    if (assigneeId && assigneeId !== actor.userId) {
      await notifications?.notify({
        userId: assigneeId,
        type: "TaskAssigned",
        payload: {
          taskId: created.id,
          taskTitle: created.title,
          projectId,
          workspaceId: created.workspaceId,
        },
      });
    }

    if (ruleEvaluator) {
      void ruleEvaluator
        .evaluate({
          type: "TaskCreated",
          projectId,
          taskId: created.id,
          task: {
            id: created.id,
            statusId: created.statusId,
            priority: created.priority,
            assigneeId: created.assigneeId,
          },
        })
        .catch((err) => {
          logger.error({ err }, "Rule engine evaluation error on TaskCreated");
        });
    }

    if (webhooks) {
      webhooks
        .broadcastProjectEvent(projectId, {
          event: "task.created",
          timestamp: new Date().toISOString(),
          actor: { id: actor.userId },
          project: { id: projectId, name: "Project", workspaceId: created.workspaceId },
          task: {
            id: created.id,
            title: created.title,
            description: created.description,
            statusId: created.statusId,
            priority: created.priority,
            assigneeId: created.assigneeId,
            dueDate: created.dueDate ? created.dueDate.toISOString() : null,
            projectId,
            workspaceId: created.workspaceId,
          },
        })
        .catch((err) => logger.error({ err }, "Webhook dispatch error on TaskCreated"));
    }

    return created;
  }

  /** Sửa field task theo policy (FR-042, BR-008, BR-009). Ghi Activity (FR-070). */
  async function updateTask(
    actor: Actor,
    taskId: string,
    field: TaskField,
    value: unknown,
  ): Promise<TaskRecord> {
    const task = await fetchOwnedTask(repo, actor, taskId);
    requireTaskFieldEdit(effectiveRole(actor), field, {
      isCreator: task.creatorId === actor.userId,
      isAssignee: task.assigneeId === actor.userId,
    });

    switch (field) {
      case "title": {
        if (typeof value !== "string" || value.trim().length === 0) {
          throw new UnauthorizedError("Title is required.");
        }
        const newTitle = value.trim();
        const activity: TaskActivityInput | undefined =
          newTitle !== task.title
            ? {
                type: "TitleChanged",
                actorId: actor.userId,
                oldValue: task.title,
                newValue: newTitle,
              }
            : undefined;
        return repo.updateTask({ taskId, title: newTitle, activity });
      }
      case "description": {
        // Không ghi activity cho description (FR-071)
        return repo.updateTask({ taskId, description: typeof value === "string" ? value : null });
      }
      case "status": {
        const newStatusId = String(value);
        const oldStatusId = task.statusId;
        const oldName = task.statusName || (await repo.getStatusName(task.statusId)) || task.statusId;
        const newName = (await repo.getStatusName(newStatusId)) || newStatusId;
        const activity: TaskActivityInput | undefined =
          newStatusId !== task.statusId
            ? {
                type: "StatusChanged",
                actorId: actor.userId,
                oldValue: oldName,
                newValue: newName,
              }
            : undefined;
        const updated = await repo.updateTask({ taskId, statusId: newStatusId, activity });
        if (ruleEvaluator && newStatusId !== oldStatusId) {
          void ruleEvaluator
            .evaluate({
              type: "StatusChanged",
              projectId: task.projectId,
              taskId,
              fromStatusId: oldStatusId,
              toStatusId: newStatusId,
            })
            .catch((err) => {
              logger.error({ err }, "Rule engine evaluation error on StatusChanged");
            });
        }
        if (webhooks && newStatusId !== oldStatusId) {
          webhooks
            .broadcastProjectEvent(task.projectId, {
              event: "task.status_changed",
              timestamp: new Date().toISOString(),
              actor: { id: actor.userId },
              project: { id: task.projectId, name: "Project", workspaceId: actor.workspaceId },
              task: {
                id: taskId,
                title: updated.title,
                statusId: newStatusId,
                statusName: newName,
                priority: updated.priority,
                projectId: task.projectId,
              },
              changes: { field: "status", oldValue: oldName, newValue: newName },
            })
            .catch((err) => logger.error({ err }, "Webhook dispatch error on StatusChanged"));
        }
        return updated;
      }
      case "priority": {
        requirePermission(actor, canChangePriority(effectiveRole(actor)), "Only Owners and Admins can change priority.");
        const newPriority = value as Priority;
        const oldPriority = task.priority;
        const activity: TaskActivityInput | undefined =
          newPriority !== task.priority
            ? {
                type: "PriorityChanged",
                actorId: actor.userId,
                oldValue: task.priority,
                newValue: newPriority,
              }
            : undefined;
        const updated = await repo.updateTask({ taskId, priority: newPriority, activity });
        if (ruleEvaluator && newPriority !== oldPriority) {
          void ruleEvaluator
            .evaluate({
              type: "PriorityChanged",
              projectId: task.projectId,
              taskId,
              fromPriority: oldPriority,
              toPriority: newPriority,
            })
            .catch((err) => {
              logger.error({ err }, "Rule engine evaluation error on PriorityChanged");
            });
        }
        if (webhooks && newPriority !== oldPriority) {
          webhooks
            .broadcastProjectEvent(task.projectId, {
              event: "task.priority_changed",
              timestamp: new Date().toISOString(),
              actor: { id: actor.userId },
              project: { id: task.projectId, name: "Project", workspaceId: actor.workspaceId },
              task: {
                id: taskId,
                title: updated.title,
                statusId: updated.statusId,
                priority: newPriority,
                projectId: task.projectId,
              },
              changes: { field: "priority", oldValue: oldPriority, newValue: newPriority },
            })
            .catch((err) => logger.error({ err }, "Webhook dispatch error on PriorityChanged"));
        }
        return updated;
      }
      case "assigneeId": {
        requirePermission(actor, canAssignTask(effectiveRole(actor)), "Only Owners and Admins can assign tasks.");
        const assigneeId = await validateAssignee(repo, actor, (value as string) || null);
        const resolvedAssigneeId = assigneeId ?? null;
        const activity: TaskActivityInput | undefined =
          resolvedAssigneeId !== task.assigneeId
            ? {
                type: "AssigneeChanged",
                actorId: actor.userId,
                oldValue: task.assigneeId,
                newValue: resolvedAssigneeId,
              }
            : undefined;
        const updated = await repo.updateTask({ taskId, assigneeId: resolvedAssigneeId, activity });

        // Notification: assignee mới khi được gán (Mốc 13) — chỉ khi có thay đổi thật.
        if (activity && resolvedAssigneeId && resolvedAssigneeId !== actor.userId) {
          await notifications?.notify({
            userId: resolvedAssigneeId,
            type: "TaskAssigned",
            payload: {
              taskId,
              taskTitle: updated.title,
              projectId: updated.projectId,
              workspaceId: updated.workspaceId,
            },
          });
        }

        if (webhooks && activity && resolvedAssigneeId !== task.assigneeId) {
          webhooks
            .broadcastProjectEvent(task.projectId, {
              event: "task.assigned",
              timestamp: new Date().toISOString(),
              actor: { id: actor.userId },
              project: { id: task.projectId, name: "Project", workspaceId: actor.workspaceId },
              task: {
                id: taskId,
                title: updated.title,
                statusId: updated.statusId,
                priority: updated.priority,
                assigneeId: resolvedAssigneeId,
                projectId: task.projectId,
              },
              changes: { field: "assigneeId", oldValue: task.assigneeId, newValue: resolvedAssigneeId },
            })
            .catch((err) => logger.error({ err }, "Webhook dispatch error on TaskAssigned"));
        }

        return updated;
      }
      case "dueDate": {
        requirePermission(actor, canChangeDueDate(effectiveRole(actor)), "Only Owners and Admins can change due dates.");
        const newDueDate = value === null ? null : (value as Date);
        const oldDueStr = task.dueDate ? task.dueDate.toISOString() : null;
        const newDueStr = newDueDate ? newDueDate.toISOString() : null;
        const activity: TaskActivityInput | undefined =
          oldDueStr !== newDueStr
            ? {
                type: "DueDateChanged",
                actorId: actor.userId,
                oldValue: oldDueStr,
                newValue: newDueStr,
              }
            : undefined;
        return repo.updateTask({ taskId, dueDate: newDueDate, activity });
      }
      case "sprintId": {
        const raw = value === null ? null : String(value || "");
        const newSprintId = raw === "" ? null : raw;
        // Sprint phải thuộc cùng project với task (chống gán sprint chéo project).
        if (newSprintId) {
          const sprintProjectId = await repo.getSprintProjectId(newSprintId);
          if (!sprintProjectId || sprintProjectId !== task.projectId) {
            throw new UnauthorizedError("Sprint not found in this task's project.");
          }
        }
        const oldSprintId = task.sprintId;
        if (newSprintId === oldSprintId) return task;
        const oldName =
          task.sprintName ||
          (oldSprintId ? (await repo.getSprintName(oldSprintId)) ?? oldSprintId : null);
        const newName = newSprintId
          ? (await repo.getSprintName(newSprintId)) ?? newSprintId
          : null;
        const activity: TaskActivityInput = {
          type: "SprintChanged",
          actorId: actor.userId,
          oldValue: oldName,
          newValue: newName,
        };
        return repo.updateTask({ taskId, sprintId: newSprintId, activity });
      }
      case "originalEstimateMinutes": {
        let newEstimate: number | null = null;
        if (value !== null && value !== undefined && value !== "") {
          const num = typeof value === "number" ? value : Number(value);
          if (isNaN(num) || num < 0) {
            throw new UnauthorizedError("Original estimate must be a non-negative number of minutes.");
          }
          newEstimate = Math.round(num);
        }
        const oldEstimate = task.originalEstimateMinutes ?? null;
        const activity: TaskActivityInput | undefined =
          newEstimate !== oldEstimate
            ? {
                type: "EstimateChanged",
                actorId: actor.userId,
                oldValue: oldEstimate !== null ? String(oldEstimate) : null,
                newValue: newEstimate !== null ? String(newEstimate) : null,
              }
            : undefined;
        return repo.updateTask({ taskId, originalEstimateMinutes: newEstimate, activity });
      }
      case "position": {
        throw new UnauthorizedError("Position can only change through moving the task.");
      }
      default:
        throw new UnauthorizedError("Invalid field.");
    }
  }

  /**
   * Move task giữa/trong cột: tính position theo hàng xóm; nếu hết khoảng hợp lệ
   * thì rebalance toàn bộ cột (chèn task đang move vào đúng targetIndex) (FR-051–053).
   * Ghi StatusChanged activity nếu đổi cột status (FR-070).
   */
  async function moveTask(
    actor: Actor,
    taskId: string,
    newStatusId: string,
    targetIndex: number,
  ): Promise<TaskRecord> {
    const task = await fetchOwnedTask(repo, actor, taskId);
    requireTaskFieldEdit(effectiveRole(actor), "status", {
      isCreator: task.creatorId === actor.userId,
      isAssignee: task.assigneeId === actor.userId,
    });

    const isStatusChanged = newStatusId !== task.statusId;
    const oldStatusId = task.statusId;
    const oldName = task.statusName || (await repo.getStatusName(task.statusId)) || task.statusId;
    const newName = (await repo.getStatusName(newStatusId)) || newStatusId;

    const activity: TaskActivityInput | undefined = isStatusChanged
      ? {
          type: "StatusChanged",
          actorId: actor.userId,
          oldValue: oldName,
          newValue: newName,
        }
      : undefined;

    const column = (await repo.listTasksByProject(task.projectId))
      .filter((t) => t.statusId === newStatusId && t.id !== taskId)
      .sort((a, b) => a.position - b.position);
    if (targetIndex < 0) targetIndex = 0;
    if (targetIndex > column.length) targetIndex = column.length;
    const left = column[targetIndex - 1]?.position ?? null;
    const right = column[targetIndex]?.position ?? null;

    let updated: TaskRecord;
    const placed = insertionPosition({ left, right });
    if (placed.kind === "placed") {
      updated = await repo.updateTaskPosition({ taskId, statusId: newStatusId, position: placed.position, activity });
    } else {
      // Rebalance: đánh số lại toàn cột 0..n, chèn task đang move tại targetIndex.
      const order: { taskId: string; position: number }[] = [];
      for (let i = 0; i <= column.length; i++) {
        if (i === targetIndex) order.push({ taskId, position: i });
        if (i < column.length) {
          order.push({ taskId: column[i].id, position: i + (i >= targetIndex ? 1 : 0) });
        }
      }
      await repo.rebalanceColumn({ projectId: task.projectId, statusId: newStatusId, order, taskId, activity });
      updated = (await repo.getTask(taskId))!;
    }

    if (ruleEvaluator && isStatusChanged) {
      void ruleEvaluator
        .evaluate({
          type: "StatusChanged",
          projectId: task.projectId,
          taskId,
          fromStatusId: oldStatusId,
          toStatusId: newStatusId,
        })
        .catch((err) => {
          logger.error({ err }, "Rule engine evaluation error on StatusChanged (move)");
        });
    }

    if (webhooks && isStatusChanged) {
      webhooks
        .broadcastProjectEvent(task.projectId, {
          event: "task.status_changed",
          timestamp: new Date().toISOString(),
          actor: { id: actor.userId },
          project: { id: task.projectId, name: "Project", workspaceId: actor.workspaceId },
          task: {
            id: taskId,
            title: updated.title,
            statusId: newStatusId,
            statusName: newName,
            priority: updated.priority,
            projectId: task.projectId,
          },
          changes: { field: "status", oldValue: oldName, newValue: newName },
        })
        .catch((err) => logger.error({ err }, "Webhook dispatch error on StatusChanged (move)"));
    }

    return updated;
  }

  /** Xoá task — Owner/Admin (FR-043). */
  async function deleteTask(actor: Actor, taskId: string): Promise<void> {
    const task = await fetchOwnedTask(repo, actor, taskId);
    requirePermission(actor, canDeleteTask(effectiveRole(actor)), "Only Owners and Admins can delete tasks.");
    await repo.deleteTask(task.id);

    if (webhooks) {
      webhooks
        .broadcastProjectEvent(task.projectId, {
          event: "task.deleted",
          timestamp: new Date().toISOString(),
          actor: { id: actor.userId },
          project: { id: task.projectId, name: "Project", workspaceId: actor.workspaceId },
          task: {
            id: taskId,
            title: task.title,
            statusId: task.statusId,
            priority: task.priority,
            projectId: task.projectId,
          },
        })
        .catch((err) => logger.error({ err }, "Webhook dispatch error on TaskDeleted"));
    }
  }

  /** List subtasks của 1 task */
  async function listSubtasks(actor: Actor, parentTaskId: string): Promise<TaskRecord[]> {
    requirePermission(actor, canViewTasks(actor.role), "You are not a member of this workspace.");
    await fetchOwnedTask(repo, actor, parentTaskId);
    const subtasks = await repo.listSubtasks(parentTaskId);
    return subtasks.filter((t) => t.workspaceId === actor.workspaceId);
  }

  /** Toggle nhanh hoàn thành subtask (chuyển sang Done status hoặc Default status) */
  async function toggleSubtaskDone(
    actor: Actor,
    subtaskId: string,
    isDone: boolean,
  ): Promise<TaskRecord> {
    const task = await fetchOwnedTask(repo, actor, subtaskId);
    let targetStatusId: string | null = null;
    if (isDone) {
      targetStatusId = await repo.getDoneProjectStatusId(task.projectId);
    }
    if (!targetStatusId) {
      targetStatusId = await repo.getDefaultProjectStatusId(task.projectId);
    }
    if (!targetStatusId || targetStatusId === task.statusId) {
      return task;
    }

    return updateTask(actor, subtaskId, "status", targetStatusId);
  }

  /** Tách subtask thành standalone task (bỏ parentId) */
  async function unlinkSubtask(actor: Actor, subtaskId: string): Promise<TaskRecord> {
    const task = await fetchOwnedTask(repo, actor, subtaskId);
    const role = effectiveRole(actor);
    requireTaskFieldEdit(role, "title", {
      isCreator: task.creatorId === actor.userId,
      isAssignee: task.assigneeId === actor.userId,
    });

    return repo.updateTask({
      taskId: subtaskId,
      parentId: null,
    });
  }

  return {
    listBoard,
    searchWorkspaceTasks,
    getTask,
    createTask,
    updateTask,
    moveTask,
    deleteTask,
    listSubtasks,
    toggleSubtaskDone,
    unlinkSubtask,
  };
}

export type TaskService = ReturnType<typeof createTaskService>;
