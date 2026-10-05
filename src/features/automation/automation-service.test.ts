import { describe, expect, it } from "vitest";

import type { ProjectActor } from "@/features/authorization/actor";
import { UnauthorizedError } from "@/features/authorization/errors";
import {
  createAutomationService,
} from "./automation-service";
import type { AutomationRepository } from "./prisma-automation-repository";
import type {
  AutomationExecutionLogRecord,
  AutomationRuleRecord,
} from "./automation-types";

function createMockRepo(initialState?: {
  rules?: AutomationRuleRecord[];
  logs?: AutomationExecutionLogRecord[];
}): AutomationRepository {
  const rules: AutomationRuleRecord[] = initialState?.rules ?? [];
  const logs: AutomationExecutionLogRecord[] = initialState?.logs ?? [];

  return {
    async getRule(ruleId: string) {
      return rules.find((r) => r.id === ruleId) ?? null;
    },
    async getProjectWorkspaceId(_projectId: string) {
      return "ws-1";
    },
    async listRulesByProject(projectId: string, onlyEnabled = false) {
      return rules.filter(
        (r) => r.projectId === projectId && (!onlyEnabled || r.enabled),
      );
    },
    async createRule(input) {
      const rule: AutomationRuleRecord = {
        id: `rule-${rules.length + 1}`,
        projectId: input.projectId,
        name: input.name,
        enabled: input.enabled ?? true,
        triggerType: input.triggerType,
        triggerConfig: input.triggerConfig ?? null,
        actionType: input.actionType,
        actionConfig: input.actionConfig,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      rules.push(rule);
      return rule;
    },
    async updateRule(input) {
      const rule = rules.find((r) => r.id === input.ruleId);
      if (!rule) throw new Error("Not found");
      if (input.name !== undefined) rule.name = input.name;
      if (input.enabled !== undefined) rule.enabled = input.enabled;
      if (input.triggerType !== undefined) rule.triggerType = input.triggerType;
      if (input.triggerConfig !== undefined) rule.triggerConfig = input.triggerConfig;
      if (input.actionType !== undefined) rule.actionType = input.actionType;
      if (input.actionConfig !== undefined) rule.actionConfig = input.actionConfig;
      rule.updatedAt = new Date();
      return rule;
    },
    async deleteRule(ruleId: string) {
      const index = rules.findIndex((r) => r.id === ruleId);
      if (index !== -1) rules.splice(index, 1);
    },
    async toggleRule(ruleId: string, enabled: boolean) {
      const rule = rules.find((r) => r.id === ruleId);
      if (!rule) throw new Error("Not found");
      rule.enabled = enabled;
      return rule;
    },
    async createExecutionLog(input) {
      const log: AutomationExecutionLogRecord = {
        id: `log-${logs.length + 1}`,
        ruleId: input.ruleId,
        taskId: input.taskId,
        status: input.status,
        message: input.message ?? null,
        createdAt: new Date(),
      };
      logs.push(log);
      return log;
    },
    async listLogsByProject(projectId: string, limit = 50) {
      return logs
        .filter((l) => rules.some((r) => r.id === l.ruleId && r.projectId === projectId))
        .slice(0, limit);
    },
    async listLogsByRule(ruleId: string, limit = 50) {
      return logs.filter((l) => l.ruleId === ruleId).slice(0, limit);
    },
  };
}

const ownerActor: ProjectActor = {
  userId: "user-owner",
  workspaceId: "ws-1",
  role: "Owner",
  projectId: "proj-1",
  projectRole: "Owner",
};

const adminActor: ProjectActor = {
  userId: "user-admin",
  workspaceId: "ws-1",
  role: "Admin",
  projectId: "proj-1",
  projectRole: "Admin",
};

const memberActor: ProjectActor = {
  userId: "user-member",
  workspaceId: "ws-1",
  role: "Member",
  projectId: "proj-1",
  projectRole: "Member",
};

describe("AutomationService", () => {
  it("allows Owner to create an automation rule", async () => {
    const repo = createMockRepo();
    const service = createAutomationService({ repo });

    const rule = await service.createRule(ownerActor, "proj-1", {
      name: "Auto Urgent on In Progress",
      triggerType: "StatusChanged",
      triggerConfig: { toStatusId: "status-in-progress" },
      actionType: "ChangePriority",
      actionConfig: { priority: "Urgent" },
    });

    expect(rule.id).toBeDefined();
    expect(rule.name).toBe("Auto Urgent on In Progress");
    expect(rule.enabled).toBe(true);
  });

  it("allows Admin to create an automation rule", async () => {
    const repo = createMockRepo();
    const service = createAutomationService({ repo });

    const rule = await service.createRule(adminActor, "proj-1", {
      name: "Assign to Dev on TaskCreated",
      triggerType: "TaskCreated",
      actionType: "ChangeAssignee",
      actionConfig: { assigneeId: "user-dev" },
    });

    expect(rule.name).toBe("Assign to Dev on TaskCreated");
  });

  it("forbids Member from creating an automation rule", async () => {
    const repo = createMockRepo();
    const service = createAutomationService({ repo });

    await expect(
      service.createRule(memberActor, "proj-1", {
        name: "Auto Rule",
        triggerType: "TaskCreated",
        actionType: "AddComment",
        actionConfig: { comment: "Hello" },
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("rejects creating rule if name is empty", async () => {
    const repo = createMockRepo();
    const service = createAutomationService({ repo });

    await expect(
      service.createRule(ownerActor, "proj-1", {
        name: "   ",
        triggerType: "TaskCreated",
        actionType: "AddComment",
        actionConfig: { comment: "Test" },
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("rejects creating rule if projectId mismatches actor", async () => {
    const repo = createMockRepo();
    const service = createAutomationService({ repo });

    await expect(
      service.createRule(ownerActor, "proj-other", {
        name: "Rule",
        triggerType: "TaskCreated",
        actionType: "AddComment",
        actionConfig: { comment: "Test" },
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("allows Owner to update a rule", async () => {
    const initialRule: AutomationRuleRecord = {
      id: "rule-1",
      projectId: "proj-1",
      name: "Old Name",
      enabled: true,
      triggerType: "TaskCreated",
      triggerConfig: null,
      actionType: "AddComment",
      actionConfig: { comment: "Initial" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const repo = createMockRepo({ rules: [initialRule] });
    const service = createAutomationService({ repo });

    const updated = await service.updateRule(ownerActor, {
      ruleId: "rule-1",
      name: "New Name",
    });

    expect(updated.name).toBe("New Name");
  });

  it("forbids Member from updating a rule", async () => {
    const initialRule: AutomationRuleRecord = {
      id: "rule-1",
      projectId: "proj-1",
      name: "Rule 1",
      enabled: true,
      triggerType: "TaskCreated",
      triggerConfig: null,
      actionType: "AddComment",
      actionConfig: { comment: "Initial" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const repo = createMockRepo({ rules: [initialRule] });
    const service = createAutomationService({ repo });

    await expect(
      service.updateRule(memberActor, {
        ruleId: "rule-1",
        name: "Updated Name",
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("allows Owner to toggle a rule on and off", async () => {
    const initialRule: AutomationRuleRecord = {
      id: "rule-1",
      projectId: "proj-1",
      name: "Rule 1",
      enabled: true,
      triggerType: "TaskCreated",
      triggerConfig: null,
      actionType: "AddComment",
      actionConfig: { comment: "Initial" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const repo = createMockRepo({ rules: [initialRule] });
    const service = createAutomationService({ repo });

    const toggledOff = await service.toggleRule(ownerActor, "rule-1", false);
    expect(toggledOff.enabled).toBe(false);

    const toggledOn = await service.toggleRule(ownerActor, "rule-1", true);
    expect(toggledOn.enabled).toBe(true);
  });

  it("allows Owner to delete a rule", async () => {
    const initialRule: AutomationRuleRecord = {
      id: "rule-1",
      projectId: "proj-1",
      name: "Rule 1",
      enabled: true,
      triggerType: "TaskCreated",
      triggerConfig: null,
      actionType: "AddComment",
      actionConfig: { comment: "Initial" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const repo = createMockRepo({ rules: [initialRule] });
    const service = createAutomationService({ repo });

    await service.deleteRule(ownerActor, "rule-1");
    const rules = await service.listRules(ownerActor, "proj-1");
    expect(rules).toHaveLength(0);
  });

  it("lists rules for project including enabled/disabled filtering", async () => {
    const r1: AutomationRuleRecord = {
      id: "rule-1",
      projectId: "proj-1",
      name: "Rule 1",
      enabled: true,
      triggerType: "TaskCreated",
      triggerConfig: null,
      actionType: "AddComment",
      actionConfig: { comment: "R1" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const r2: AutomationRuleRecord = {
      id: "rule-2",
      projectId: "proj-1",
      name: "Rule 2",
      enabled: false,
      triggerType: "StatusChanged",
      triggerConfig: null,
      actionType: "ChangePriority",
      actionConfig: { priority: "High" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const repo = createMockRepo({ rules: [r1, r2] });
    const service = createAutomationService({ repo });

    const all = await service.listRules(memberActor, "proj-1", false);
    expect(all).toHaveLength(2);

    const enabledOnly = await service.listRules(memberActor, "proj-1", true);
    expect(enabledOnly).toHaveLength(1);
    expect(enabledOnly[0].id).toBe("rule-1");
  });

  it("lists execution logs for project", async () => {
    const r1: AutomationRuleRecord = {
      id: "rule-1",
      projectId: "proj-1",
      name: "Rule 1",
      enabled: true,
      triggerType: "TaskCreated",
      triggerConfig: null,
      actionType: "AddComment",
      actionConfig: { comment: "R1" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const log1: AutomationExecutionLogRecord = {
      id: "log-1",
      ruleId: "rule-1",
      taskId: "task-1",
      status: "Success",
      message: "Comment added",
      createdAt: new Date(),
    };
    const repo = createMockRepo({ rules: [r1], logs: [log1] });
    const service = createAutomationService({ repo });

    const logs = await service.listExecutionLogs(memberActor, "proj-1");
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe("Success");
  });
});
