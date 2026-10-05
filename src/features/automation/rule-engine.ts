import { randomUUID } from "node:crypto";
import type { Priority } from "@/features/authorization/permissions";
import type { AutomationRepository } from "./prisma-automation-repository";
import type {
  AddCommentActionConfig,
  AutomationRuleRecord,
  ChangeAssigneeActionConfig,
  ChangePriorityActionConfig,
  ChangeStatusActionConfig,
  PriorityChangedTriggerConfig,
  RuleTriggerEvent,
  StatusChangedTriggerConfig,
  TaskCreatedTriggerConfig,
} from "./automation-types";

async function getPrisma() {
  const { prisma } = await import("@/lib/prisma");
  return prisma;
}

export interface AutomationTaskExecutor {
  updateTask(
    taskId: string,
    data: { statusId?: string; priority?: Priority; assigneeId?: string | null },
  ): Promise<{
    id: string;
    projectId: string;
    statusId: string;
    priority: Priority;
    assigneeId: string | null;
  }>;
  addComment(taskId: string, content: string, authorId?: string): Promise<void>;
  getTask(
    taskId: string,
  ): Promise<{
    id: string;
    projectId: string;
    statusId: string;
    priority: Priority;
    assigneeId: string | null;
    creatorId: string;
  } | null>;
}

export const defaultTaskExecutor: AutomationTaskExecutor = {
  async updateTask(taskId, data) {
    const prisma = await getPrisma();
    const row = await prisma.task.update({
      where: { id: taskId },
      data: {
        ...(data.statusId !== undefined ? { statusId: data.statusId } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.assigneeId !== undefined ? { assigneeId: data.assigneeId } : {}),
      },
      select: {
        id: true,
        projectId: true,
        statusId: true,
        priority: true,
        assigneeId: true,
      },
    });
    return row as {
      id: string;
      projectId: string;
      statusId: string;
      priority: Priority;
      assigneeId: string | null;
    };
  },

  async addComment(taskId, content, authorId) {
    const prisma = await getPrisma();
    let resolvedAuthorId = authorId;
    if (!resolvedAuthorId) {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { creatorId: true },
      });
      resolvedAuthorId = task?.creatorId;
    }
    if (!resolvedAuthorId) {
      const firstUser = await prisma.user.findFirst({ select: { id: true } });
      resolvedAuthorId = firstUser?.id;
    }
    if (!resolvedAuthorId) {
      throw new Error("No author available to add automation comment.");
    }

    await prisma.comment.create({
      data: {
        id: randomUUID(),
        taskId,
        authorId: resolvedAuthorId,
        content,
      },
    });
  },

  async getTask(taskId) {
    const prisma = await getPrisma();
    const row = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        projectId: true,
        statusId: true,
        priority: true,
        assigneeId: true,
        creatorId: true,
      },
    });
    if (!row) return null;
    return row as {
      id: string;
      projectId: string;
      statusId: string;
      priority: Priority;
      assigneeId: string | null;
      creatorId: string;
    };
  },
};

export interface RuleEngineOptions {
  repo?: AutomationRepository;
  taskExecutor?: AutomationTaskExecutor;
  maxDepth?: number;
}

export function matchesTrigger(
  rule: AutomationRuleRecord,
  event: RuleTriggerEvent,
): boolean {
  if (rule.triggerType !== event.type) return false;

  switch (event.type) {
    case "TaskCreated": {
      const config = (rule.triggerConfig as TaskCreatedTriggerConfig) ?? {};
      if (config.statusId && config.statusId !== event.task.statusId) return false;
      if (config.priority && config.priority !== event.task.priority) return false;
      if (config.assigneeId !== undefined && config.assigneeId !== event.task.assigneeId) {
        return false;
      }
      return true;
    }
    case "StatusChanged": {
      const config = (rule.triggerConfig as StatusChangedTriggerConfig) ?? {};
      if (config.fromStatusId && config.fromStatusId !== event.fromStatusId) return false;
      if (config.toStatusId && config.toStatusId !== event.toStatusId) return false;
      return true;
    }
    case "PriorityChanged": {
      const config = (rule.triggerConfig as PriorityChangedTriggerConfig) ?? {};
      if (config.fromPriority && config.fromPriority !== event.fromPriority) return false;
      if (config.toPriority && config.toPriority !== event.toPriority) return false;
      return true;
    }
    default:
      return false;
  }
}

export class RuleEngine {
  private repo?: AutomationRepository;
  private taskExecutor?: AutomationTaskExecutor;
  private maxDepth: number;

  constructor(options: RuleEngineOptions = {}) {
    this.repo = options.repo;
    this.taskExecutor = options.taskExecutor;
    this.maxDepth = options.maxDepth ?? 2;
  }

  private async getRepo(): Promise<AutomationRepository> {
    if (this.repo) return this.repo;
    const { prismaAutomationRepository } = await import("./prisma-automation-repository");
    return prismaAutomationRepository;
  }

  private async getTaskExecutor(): Promise<AutomationTaskExecutor> {
    if (this.taskExecutor) return this.taskExecutor;
    return defaultTaskExecutor;
  }

  async evaluate(event: RuleTriggerEvent, context: { depth?: number } = {}): Promise<void> {
    const depth = context.depth ?? 1;

    if (depth > this.maxDepth) {
      // Loop protection: do not execute further rules
      return;
    }

    const repo = await this.getRepo();

    // Get enabled rules for this project
    const rules = await repo.listRulesByProject(event.projectId, true);

    for (const rule of rules) {
      if (!matchesTrigger(rule, event)) {
        continue;
      }

      await this.executeRule(rule, event, depth);
    }
  }

  private async executeRule(
    rule: AutomationRuleRecord,
    event: RuleTriggerEvent,
    currentDepth: number,
  ): Promise<void> {
    const taskId = event.taskId;
    const repo = await this.getRepo();
    const taskExecutor = await this.getTaskExecutor();

    try {
      let actionSummary = "";

      switch (rule.actionType) {
        case "ChangeAssignee": {
          const config = rule.actionConfig as ChangeAssigneeActionConfig;
          await taskExecutor.updateTask(taskId, { assigneeId: config.assigneeId });
          actionSummary = `Changed assignee to ${config.assigneeId ?? "unassigned"}`;
          break;
        }

        case "ChangePriority": {
          const config = rule.actionConfig as ChangePriorityActionConfig;
          const currentTask = await taskExecutor.getTask(taskId);
          const oldPriority = currentTask?.priority ?? "Medium";
          
          if (oldPriority !== config.priority) {
            await taskExecutor.updateTask(taskId, { priority: config.priority });
            actionSummary = `Changed priority from ${oldPriority} to ${config.priority}`;

            // Trigger recursion if depth allows
            if (currentDepth + 1 <= this.maxDepth) {
              await this.evaluate(
                {
                  type: "PriorityChanged",
                  projectId: rule.projectId,
                  taskId,
                  fromPriority: oldPriority,
                  toPriority: config.priority,
                },
                { depth: currentDepth + 1 },
              );
            }
          } else {
            actionSummary = `Priority is already ${config.priority}`;
          }
          break;
        }

        case "ChangeStatus": {
          const config = rule.actionConfig as ChangeStatusActionConfig;
          const currentTask = await taskExecutor.getTask(taskId);
          const oldStatusId = currentTask?.statusId;

          if (oldStatusId !== config.statusId) {
            await taskExecutor.updateTask(taskId, { statusId: config.statusId });
            actionSummary = `Changed status to ${config.statusId}`;

            // Trigger recursion if depth allows
            if (currentDepth + 1 <= this.maxDepth && oldStatusId) {
              await this.evaluate(
                {
                  type: "StatusChanged",
                  projectId: rule.projectId,
                  taskId,
                  fromStatusId: oldStatusId,
                  toStatusId: config.statusId,
                },
                { depth: currentDepth + 1 },
              );
            }
          } else {
            actionSummary = `Status is already ${config.statusId}`;
          }
          break;
        }

        case "AddComment": {
          const config = rule.actionConfig as AddCommentActionConfig;
          await taskExecutor.addComment(taskId, config.comment, config.authorId);
          actionSummary = `Added comment: "${config.comment.slice(0, 30)}${config.comment.length > 30 ? "..." : ""}"`;
          break;
        }

        default: {
          throw new Error(`Unknown action type: ${(rule as AutomationRuleRecord).actionType}`);
        }
      }

      await repo.createExecutionLog({
        ruleId: rule.id,
        taskId,
        status: "Success",
        message: actionSummary,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await repo.createExecutionLog({
        ruleId: rule.id,
        taskId,
        status: "Failed",
        message: errorMessage,
      });
    }
  }
}

export const ruleEngine = new RuleEngine();
