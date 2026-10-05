import { describe, expect, it } from "vitest";

import type { Priority } from "@/features/authorization/permissions";
import type { AutomationRepository } from "./prisma-automation-repository";
import type {
  AutomationExecutionLogRecord,
  AutomationRuleRecord,
  RuleTriggerEvent,
} from "./automation-types";
import {
  matchesTrigger,
  RuleEngine,
  type AutomationTaskExecutor,
} from "./rule-engine";

interface MockTask {
  id: string;
  projectId: string;
  statusId: string;
  priority: Priority;
  assigneeId: string | null;
  creatorId: string;
}

function createMockEnvironment(initialState?: {
  rules?: AutomationRuleRecord[];
  tasks?: MockTask[];
}) {
  const rules: AutomationRuleRecord[] = initialState?.rules ? [...initialState.rules] : [];
  const logs: AutomationExecutionLogRecord[] = [];
  const tasks: MockTask[] = initialState?.tasks ? [...initialState.tasks] : [];
  const comments: { taskId: string; content: string; authorId?: string }[] = [];

  const repo: AutomationRepository = {
    async getRule(id) {
      return rules.find((r) => r.id === id) ?? null;
    },
    async getProjectWorkspaceId() {
      return "ws-1";
    },
    async listRulesByProject(projectId, onlyEnabled) {
      return rules.filter((r) => r.projectId === projectId && (!onlyEnabled || r.enabled));
    },
    async createRule(input) {
      const r: AutomationRuleRecord = {
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
      rules.push(r);
      return r;
    },
    async updateRule(input) {
      const r = rules.find((x) => x.id === input.ruleId)!;
      return r;
    },
    async deleteRule() {},
    async toggleRule(id, enabled) {
      const r = rules.find((x) => x.id === id)!;
      r.enabled = enabled;
      return r;
    },
    async createExecutionLog(input) {
      const l: AutomationExecutionLogRecord = {
        id: `log-${logs.length + 1}`,
        ruleId: input.ruleId,
        taskId: input.taskId,
        status: input.status,
        message: input.message ?? null,
        createdAt: new Date(),
      };
      logs.push(l);
      return l;
    },
    async listLogsByProject() {
      return logs;
    },
    async listLogsByRule(ruleId) {
      return logs.filter((l) => l.ruleId === ruleId);
    },
  };

  const taskExecutor: AutomationTaskExecutor = {
    async updateTask(taskId, data) {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) throw new Error("Task not found");
      if (data.statusId !== undefined) task.statusId = data.statusId;
      if (data.priority !== undefined) task.priority = data.priority;
      if (data.assigneeId !== undefined) task.assigneeId = data.assigneeId;
      return {
        id: task.id,
        projectId: task.projectId,
        statusId: task.statusId,
        priority: task.priority,
        assigneeId: task.assigneeId,
      };
    },
    async addComment(taskId, content, authorId) {
      comments.push({ taskId, content, authorId });
    },
    async getTask(taskId) {
      return tasks.find((t) => t.id === taskId) ?? null;
    },
  };

  return { repo, taskExecutor, rules, logs, tasks, comments };
}

describe("RuleEngine - matchesTrigger", () => {
  it("matches TaskCreated trigger without conditions", () => {
    const rule: AutomationRuleRecord = {
      id: "r1",
      projectId: "p1",
      name: "R1",
      enabled: true,
      triggerType: "TaskCreated",
      triggerConfig: null,
      actionType: "AddComment",
      actionConfig: { comment: "Hi" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const event: RuleTriggerEvent = {
      type: "TaskCreated",
      projectId: "p1",
      taskId: "t1",
      task: { id: "t1", statusId: "s1", priority: "Low", assigneeId: null },
    };

    expect(matchesTrigger(rule, event)).toBe(true);
  });

  it("matches TaskCreated trigger with exact status and priority conditions", () => {
    const rule: AutomationRuleRecord = {
      id: "r1",
      projectId: "p1",
      name: "R1",
      enabled: true,
      triggerType: "TaskCreated",
      triggerConfig: { statusId: "s1", priority: "High" },
      actionType: "AddComment",
      actionConfig: { comment: "Hi" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const matchingEvent: RuleTriggerEvent = {
      type: "TaskCreated",
      projectId: "p1",
      taskId: "t1",
      task: { id: "t1", statusId: "s1", priority: "High", assigneeId: null },
    };

    const nonMatchingEvent: RuleTriggerEvent = {
      type: "TaskCreated",
      projectId: "p1",
      taskId: "t1",
      task: { id: "t1", statusId: "s1", priority: "Low", assigneeId: null },
    };

    expect(matchesTrigger(rule, matchingEvent)).toBe(true);
    expect(matchesTrigger(rule, nonMatchingEvent)).toBe(false);
  });

  it("matches StatusChanged trigger with fromStatus and toStatus conditions", () => {
    const rule: AutomationRuleRecord = {
      id: "r1",
      projectId: "p1",
      name: "R1",
      enabled: true,
      triggerType: "StatusChanged",
      triggerConfig: { fromStatusId: "s-todo", toStatusId: "s-in-prog" },
      actionType: "ChangePriority",
      actionConfig: { priority: "Urgent" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const matchingEvent: RuleTriggerEvent = {
      type: "StatusChanged",
      projectId: "p1",
      taskId: "t1",
      fromStatusId: "s-todo",
      toStatusId: "s-in-prog",
    };

    const nonMatchingEvent: RuleTriggerEvent = {
      type: "StatusChanged",
      projectId: "p1",
      taskId: "t1",
      fromStatusId: "s-backlog",
      toStatusId: "s-in-prog",
    };

    expect(matchesTrigger(rule, matchingEvent)).toBe(true);
    expect(matchesTrigger(rule, nonMatchingEvent)).toBe(false);
  });

  it("matches PriorityChanged trigger", () => {
    const rule: AutomationRuleRecord = {
      id: "r1",
      projectId: "p1",
      name: "R1",
      enabled: true,
      triggerType: "PriorityChanged",
      triggerConfig: { toPriority: "Urgent" },
      actionType: "AddComment",
      actionConfig: { comment: "Urgent priority flagged" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const matchingEvent: RuleTriggerEvent = {
      type: "PriorityChanged",
      projectId: "p1",
      taskId: "t1",
      fromPriority: "Medium",
      toPriority: "Urgent",
    };

    const nonMatchingEvent: RuleTriggerEvent = {
      type: "PriorityChanged",
      projectId: "p1",
      taskId: "t1",
      fromPriority: "Medium",
      toPriority: "Low",
    };

    expect(matchesTrigger(rule, matchingEvent)).toBe(true);
    expect(matchesTrigger(rule, nonMatchingEvent)).toBe(false);
  });
});

describe("RuleEngine - Execution and Loop Prevention", () => {
  it("executes ChangeAssignee action on TaskCreated", async () => {
    const rule: AutomationRuleRecord = {
      id: "rule-1",
      projectId: "p1",
      name: "Auto-assign to dev",
      enabled: true,
      triggerType: "TaskCreated",
      triggerConfig: null,
      actionType: "ChangeAssignee",
      actionConfig: { assigneeId: "user-dev" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const task: MockTask = {
      id: "t1",
      projectId: "p1",
      statusId: "s-todo",
      priority: "Medium",
      assigneeId: null,
      creatorId: "u1",
    };

    const env = createMockEnvironment({ rules: [rule], tasks: [task] });
    const engine = new RuleEngine({ repo: env.repo, taskExecutor: env.taskExecutor });

    await engine.evaluate({
      type: "TaskCreated",
      projectId: "p1",
      taskId: "t1",
      task: { id: "t1", statusId: "s-todo", priority: "Medium", assigneeId: null },
    });

    expect(env.tasks[0].assigneeId).toBe("user-dev");
    expect(env.logs).toHaveLength(1);
    expect(env.logs[0].status).toBe("Success");
  });

  it("executes ChangePriority action on StatusChanged", async () => {
    const rule: AutomationRuleRecord = {
      id: "rule-1",
      projectId: "p1",
      name: "Urgent when in progress",
      enabled: true,
      triggerType: "StatusChanged",
      triggerConfig: { toStatusId: "s-in-prog" },
      actionType: "ChangePriority",
      actionConfig: { priority: "Urgent" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const task: MockTask = {
      id: "t1",
      projectId: "p1",
      statusId: "s-todo",
      priority: "Low",
      assigneeId: null,
      creatorId: "u1",
    };

    const env = createMockEnvironment({ rules: [rule], tasks: [task] });
    const engine = new RuleEngine({ repo: env.repo, taskExecutor: env.taskExecutor });

    await engine.evaluate({
      type: "StatusChanged",
      projectId: "p1",
      taskId: "t1",
      fromStatusId: "s-todo",
      toStatusId: "s-in-prog",
    });

    expect(env.tasks[0].priority).toBe("Urgent");
    expect(env.logs).toHaveLength(1);
    expect(env.logs[0].status).toBe("Success");
  });

  it("executes ChangeStatus action on TaskCreated", async () => {
    const rule: AutomationRuleRecord = {
      id: "rule-1",
      projectId: "p1",
      name: "Move Urgent tasks to In Progress",
      enabled: true,
      triggerType: "TaskCreated",
      triggerConfig: { priority: "Urgent" },
      actionType: "ChangeStatus",
      actionConfig: { statusId: "s-in-prog" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const task: MockTask = {
      id: "t1",
      projectId: "p1",
      statusId: "s-todo",
      priority: "Urgent",
      assigneeId: null,
      creatorId: "u1",
    };

    const env = createMockEnvironment({ rules: [rule], tasks: [task] });
    const engine = new RuleEngine({ repo: env.repo, taskExecutor: env.taskExecutor });

    await engine.evaluate({
      type: "TaskCreated",
      projectId: "p1",
      taskId: "t1",
      task: { id: "t1", statusId: "s-todo", priority: "Urgent", assigneeId: null },
    });

    expect(env.tasks[0].statusId).toBe("s-in-prog");
    expect(env.logs[0].status).toBe("Success");
  });

  it("executes AddComment action", async () => {
    const rule: AutomationRuleRecord = {
      id: "rule-1",
      projectId: "p1",
      name: "Add Welcome Comment",
      enabled: true,
      triggerType: "TaskCreated",
      triggerConfig: null,
      actionType: "AddComment",
      actionConfig: { comment: "Task automatically registered." },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const task: MockTask = {
      id: "t1",
      projectId: "p1",
      statusId: "s-todo",
      priority: "Medium",
      assigneeId: null,
      creatorId: "u1",
    };

    const env = createMockEnvironment({ rules: [rule], tasks: [task] });
    const engine = new RuleEngine({ repo: env.repo, taskExecutor: env.taskExecutor });

    await engine.evaluate({
      type: "TaskCreated",
      projectId: "p1",
      taskId: "t1",
      task: { id: "t1", statusId: "s-todo", priority: "Medium", assigneeId: null },
    });

    expect(env.comments).toHaveLength(1);
    expect(env.comments[0].content).toBe("Task automatically registered.");
    expect(env.logs[0].status).toBe("Success");
  });

  it("ignores disabled rules", async () => {
    const rule: AutomationRuleRecord = {
      id: "rule-1",
      projectId: "p1",
      name: "Disabled Rule",
      enabled: false,
      triggerType: "TaskCreated",
      triggerConfig: null,
      actionType: "ChangePriority",
      actionConfig: { priority: "Urgent" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const task: MockTask = {
      id: "t1",
      projectId: "p1",
      statusId: "s-todo",
      priority: "Low",
      assigneeId: null,
      creatorId: "u1",
    };

    const env = createMockEnvironment({ rules: [rule], tasks: [task] });
    const engine = new RuleEngine({ repo: env.repo, taskExecutor: env.taskExecutor });

    await engine.evaluate({
      type: "TaskCreated",
      projectId: "p1",
      taskId: "t1",
      task: { id: "t1", statusId: "s-todo", priority: "Low", assigneeId: null },
    });

    expect(env.tasks[0].priority).toBe("Low");
    expect(env.logs).toHaveLength(0);
  });

  it("logs Failed status when task executor fails", async () => {
    const rule: AutomationRuleRecord = {
      id: "rule-1",
      projectId: "p1",
      name: "Failing Rule",
      enabled: true,
      triggerType: "TaskCreated",
      triggerConfig: null,
      actionType: "ChangeStatus",
      actionConfig: { statusId: "s-done" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const env = createMockEnvironment({ rules: [rule], tasks: [] }); // Task doesn't exist
    const engine = new RuleEngine({ repo: env.repo, taskExecutor: env.taskExecutor });

    await engine.evaluate({
      type: "TaskCreated",
      projectId: "p1",
      taskId: "nonexistent",
      task: { id: "nonexistent", statusId: "s-todo", priority: "Low", assigneeId: null },
    });

    expect(env.logs).toHaveLength(1);
    expect(env.logs[0].status).toBe("Failed");
  });

  it("prevents infinite loops using depth counter (maxDepth = 2)", async () => {
    // Rule 1: When Status -> InProgress, Change Priority -> Urgent
    // Rule 2: When Priority -> Urgent, Change Status -> InProgress
    const rule1: AutomationRuleRecord = {
      id: "rule-1",
      projectId: "p1",
      name: "Status to InProgress -> Priority Urgent",
      enabled: true,
      triggerType: "StatusChanged",
      triggerConfig: { toStatusId: "s-in-prog" },
      actionType: "ChangePriority",
      actionConfig: { priority: "Urgent" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const rule2: AutomationRuleRecord = {
      id: "rule-2",
      projectId: "p1",
      name: "Priority Urgent -> Status InProgress",
      enabled: true,
      triggerType: "PriorityChanged",
      triggerConfig: { toPriority: "Urgent" },
      actionType: "ChangeStatus",
      actionConfig: { statusId: "s-in-prog" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const task: MockTask = {
      id: "t1",
      projectId: "p1",
      statusId: "s-todo",
      priority: "Low",
      assigneeId: null,
      creatorId: "u1",
    };

    const env = createMockEnvironment({ rules: [rule1, rule2], tasks: [task] });
    const engine = new RuleEngine({
      repo: env.repo,
      taskExecutor: env.taskExecutor,
      maxDepth: 2,
    });

    // Initial trigger: depth 1
    await engine.evaluate({
      type: "StatusChanged",
      projectId: "p1",
      taskId: "t1",
      fromStatusId: "s-todo",
      toStatusId: "s-in-prog",
    });

    // Rule 1 runs (depth 1) -> triggers PriorityChanged (depth 2)
    // Rule 2 runs (depth 2) -> Status is already InProgress, doesn't trigger recursion, and even if it did, depth 3 > 2 would stop.
    expect(env.logs.length).toBeLessThanOrEqual(3);
    expect(env.tasks[0].priority).toBe("Urgent");
  });
});
