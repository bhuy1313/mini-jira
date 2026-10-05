import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import type {
  ActionConfig,
  AutomationExecutionLogRecord,
  AutomationRuleRecord,
  ExecutionStatus,
  RuleActionType,
  RuleTriggerType,
  TriggerConfig,
} from "./automation-types";

const RULE_SELECT = {
  id: true,
  projectId: true,
  name: true,
  enabled: true,
  triggerType: true,
  triggerConfig: true,
  actionType: true,
  actionConfig: true,
  createdAt: true,
  updatedAt: true,
} as const;

function mapRuleRow(row: {
  id: string;
  projectId: string;
  name: string;
  enabled: boolean;
  triggerType: string;
  triggerConfig: Prisma.JsonValue | null;
  actionType: string;
  actionConfig: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}): AutomationRuleRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    enabled: row.enabled,
    triggerType: row.triggerType as RuleTriggerType,
    triggerConfig: (row.triggerConfig as TriggerConfig) ?? null,
    actionType: row.actionType as RuleActionType,
    actionConfig: row.actionConfig as ActionConfig,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export interface AutomationRepository {
  getRule(ruleId: string): Promise<AutomationRuleRecord | null>;
  getProjectWorkspaceId(projectId: string): Promise<string | null>;
  listRulesByProject(projectId: string, onlyEnabled?: boolean): Promise<AutomationRuleRecord[]>;
  createRule(input: {
    projectId: string;
    name: string;
    enabled?: boolean;
    triggerType: RuleTriggerType;
    triggerConfig?: TriggerConfig;
    actionType: RuleActionType;
    actionConfig: ActionConfig;
  }): Promise<AutomationRuleRecord>;
  updateRule(input: {
    ruleId: string;
    name?: string;
    enabled?: boolean;
    triggerType?: RuleTriggerType;
    triggerConfig?: TriggerConfig;
    actionType?: RuleActionType;
    actionConfig?: ActionConfig;
  }): Promise<AutomationRuleRecord>;
  deleteRule(ruleId: string): Promise<void>;
  toggleRule(ruleId: string, enabled: boolean): Promise<AutomationRuleRecord>;
  createExecutionLog(input: {
    ruleId: string;
    taskId: string;
    status: ExecutionStatus;
    message?: string | null;
  }): Promise<AutomationExecutionLogRecord>;
  listLogsByProject(projectId: string, limit?: number): Promise<AutomationExecutionLogRecord[]>;
  listLogsByRule(ruleId: string, limit?: number): Promise<AutomationExecutionLogRecord[]>;
}

export const prismaAutomationRepository: AutomationRepository = {
  async getRule(ruleId: string): Promise<AutomationRuleRecord | null> {
    const row = await prisma.automationRule.findUnique({
      where: { id: ruleId },
      select: RULE_SELECT,
    });
    return row ? mapRuleRow(row) : null;
  },

  async getProjectWorkspaceId(projectId: string): Promise<string | null> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    });
    return project?.workspaceId ?? null;
  },

  async listRulesByProject(projectId: string, onlyEnabled = false): Promise<AutomationRuleRecord[]> {
    const rows = await prisma.automationRule.findMany({
      where: {
        projectId,
        ...(onlyEnabled ? { enabled: true } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: RULE_SELECT,
    });
    return rows.map(mapRuleRow);
  },

  async createRule(input: {
    projectId: string;
    name: string;
    enabled?: boolean;
    triggerType: RuleTriggerType;
    triggerConfig?: TriggerConfig;
    actionType: RuleActionType;
    actionConfig: ActionConfig;
  }): Promise<AutomationRuleRecord> {
    const id = randomUUID();
    const row = await prisma.automationRule.create({
      data: {
        id,
        projectId: input.projectId,
        name: input.name,
        enabled: input.enabled ?? true,
        triggerType: input.triggerType,
        triggerConfig: input.triggerConfig
          ? (input.triggerConfig as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        actionType: input.actionType,
        actionConfig: input.actionConfig as Prisma.InputJsonValue,
      },
      select: RULE_SELECT,
    });
    return mapRuleRow(row);
  },

  async updateRule(input: {
    ruleId: string;
    name?: string;
    enabled?: boolean;
    triggerType?: RuleTriggerType;
    triggerConfig?: TriggerConfig;
    actionType?: RuleActionType;
    actionConfig?: ActionConfig;
  }): Promise<AutomationRuleRecord> {
    const data: Prisma.AutomationRuleUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.enabled !== undefined) data.enabled = input.enabled;
    if (input.triggerType !== undefined) data.triggerType = input.triggerType;
    if (input.triggerConfig !== undefined) {
      data.triggerConfig = input.triggerConfig
        ? (input.triggerConfig as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }
    if (input.actionType !== undefined) data.actionType = input.actionType;
    if (input.actionConfig !== undefined) {
      data.actionConfig = input.actionConfig as Prisma.InputJsonValue;
    }

    const row = await prisma.automationRule.update({
      where: { id: input.ruleId },
      data,
      select: RULE_SELECT,
    });
    return mapRuleRow(row);
  },

  async deleteRule(ruleId: string): Promise<void> {
    await prisma.automationRule.delete({
      where: { id: ruleId },
    });
  },

  async toggleRule(ruleId: string, enabled: boolean): Promise<AutomationRuleRecord> {
    const row = await prisma.automationRule.update({
      where: { id: ruleId },
      data: { enabled },
      select: RULE_SELECT,
    });
    return mapRuleRow(row);
  },

  async createExecutionLog(input: {
    ruleId: string;
    taskId: string;
    status: ExecutionStatus;
    message?: string | null;
  }): Promise<AutomationExecutionLogRecord> {
    const id = randomUUID();
    const row = await prisma.automationExecutionLog.create({
      data: {
        id,
        ruleId: input.ruleId,
        taskId: input.taskId,
        status: input.status,
        message: input.message ?? null,
      },
      select: {
        id: true,
        ruleId: true,
        taskId: true,
        status: true,
        message: true,
        createdAt: true,
        rule: { select: { name: true } },
      },
    });
    return {
      id: row.id,
      ruleId: row.ruleId,
      ruleName: row.rule.name,
      taskId: row.taskId,
      status: row.status as ExecutionStatus,
      message: row.message,
      createdAt: row.createdAt,
    };
  },

  async listLogsByProject(projectId: string, limit = 50): Promise<AutomationExecutionLogRecord[]> {
    const rows = await prisma.automationExecutionLog.findMany({
      where: { rule: { projectId } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        ruleId: true,
        taskId: true,
        status: true,
        message: true,
        createdAt: true,
        rule: { select: { name: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      ruleId: r.ruleId,
      ruleName: r.rule.name,
      taskId: r.taskId,
      status: r.status as ExecutionStatus,
      message: r.message,
      createdAt: r.createdAt,
    }));
  },

  async listLogsByRule(ruleId: string, limit = 50): Promise<AutomationExecutionLogRecord[]> {
    const rows = await prisma.automationExecutionLog.findMany({
      where: { ruleId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        ruleId: true,
        taskId: true,
        status: true,
        message: true,
        createdAt: true,
        rule: { select: { name: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      ruleId: r.ruleId,
      ruleName: r.rule.name,
      taskId: r.taskId,
      status: r.status as ExecutionStatus,
      message: r.message,
      createdAt: r.createdAt,
    }));
  },
};
