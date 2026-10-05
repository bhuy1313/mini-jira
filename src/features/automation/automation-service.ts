import type { ProjectActor } from "@/features/authorization/actor";
import { requirePermission } from "@/features/authorization/actor";
import { UnauthorizedError } from "@/features/authorization/errors";
import { canManageAutomationRules } from "@/features/authorization/permissions";
import type { AutomationRepository } from "./prisma-automation-repository";
import type {
  ActionConfig,
  AutomationExecutionLogRecord,
  AutomationRuleRecord,
  RuleActionType,
  RuleTriggerType,
  TriggerConfig,
} from "./automation-types";

interface Deps {
  repo: AutomationRepository;
}

export interface CreateRuleInput {
  name: string;
  enabled?: boolean;
  triggerType: RuleTriggerType;
  triggerConfig?: TriggerConfig;
  actionType: RuleActionType;
  actionConfig: ActionConfig;
}

export interface UpdateRuleInput {
  ruleId: string;
  name?: string;
  enabled?: boolean;
  triggerType?: RuleTriggerType;
  triggerConfig?: TriggerConfig;
  actionType?: RuleActionType;
  actionConfig?: ActionConfig;
}

export function createAutomationService({ repo }: Deps) {
  async function listRules(
    actor: ProjectActor,
    projectId: string,
    onlyEnabled = false,
  ): Promise<AutomationRuleRecord[]> {
    if (actor.projectId !== projectId) {
      throw new UnauthorizedError("Project mismatch.");
    }
    return repo.listRulesByProject(projectId, onlyEnabled);
  }

  async function getRule(
    actor: ProjectActor,
    ruleId: string,
  ): Promise<AutomationRuleRecord> {
    const rule = await repo.getRule(ruleId);
    if (!rule || rule.projectId !== actor.projectId) {
      throw new UnauthorizedError("Automation rule not found or project mismatch.");
    }
    return rule;
  }

  async function createRule(
    actor: ProjectActor,
    projectId: string,
    input: CreateRuleInput,
  ): Promise<AutomationRuleRecord> {
    if (actor.projectId !== projectId) {
      throw new UnauthorizedError("Project mismatch.");
    }
    requirePermission(
      actor,
      canManageAutomationRules(actor.projectRole),
      "Only Project Owners and Admins can create automation rules.",
    );

    if (!input.name || input.name.trim().length === 0) {
      throw new UnauthorizedError("Rule name is required.");
    }

    return repo.createRule({
      projectId,
      name: input.name.trim(),
      enabled: input.enabled ?? true,
      triggerType: input.triggerType,
      triggerConfig: input.triggerConfig ?? null,
      actionType: input.actionType,
      actionConfig: input.actionConfig,
    });
  }

  async function updateRule(
    actor: ProjectActor,
    input: UpdateRuleInput,
  ): Promise<AutomationRuleRecord> {
    const existing = await repo.getRule(input.ruleId);
    if (!existing || existing.projectId !== actor.projectId) {
      throw new UnauthorizedError("Automation rule not found.");
    }
    requirePermission(
      actor,
      canManageAutomationRules(actor.projectRole),
      "Only Project Owners and Admins can update automation rules.",
    );

    if (input.name !== undefined && input.name.trim().length === 0) {
      throw new UnauthorizedError("Rule name cannot be empty.");
    }

    return repo.updateRule({
      ruleId: input.ruleId,
      name: input.name ? input.name.trim() : undefined,
      enabled: input.enabled,
      triggerType: input.triggerType,
      triggerConfig: input.triggerConfig,
      actionType: input.actionType,
      actionConfig: input.actionConfig,
    });
  }

  async function toggleRule(
    actor: ProjectActor,
    ruleId: string,
    enabled: boolean,
  ): Promise<AutomationRuleRecord> {
    const existing = await repo.getRule(ruleId);
    if (!existing || existing.projectId !== actor.projectId) {
      throw new UnauthorizedError("Automation rule not found.");
    }
    requirePermission(
      actor,
      canManageAutomationRules(actor.projectRole),
      "Only Project Owners and Admins can toggle automation rules.",
    );

    return repo.toggleRule(ruleId, enabled);
  }

  async function deleteRule(
    actor: ProjectActor,
    ruleId: string,
  ): Promise<void> {
    const existing = await repo.getRule(ruleId);
    if (!existing || existing.projectId !== actor.projectId) {
      throw new UnauthorizedError("Automation rule not found.");
    }
    requirePermission(
      actor,
      canManageAutomationRules(actor.projectRole),
      "Only Project Owners and Admins can delete automation rules.",
    );

    await repo.deleteRule(ruleId);
  }

  async function listExecutionLogs(
    actor: ProjectActor,
    projectId: string,
    limit = 50,
  ): Promise<AutomationExecutionLogRecord[]> {
    if (actor.projectId !== projectId) {
      throw new UnauthorizedError("Project mismatch.");
    }
    return repo.listLogsByProject(projectId, limit);
  }

  return {
    listRules,
    getRule,
    createRule,
    updateRule,
    toggleRule,
    deleteRule,
    listExecutionLogs,
  };
}

export type AutomationService = ReturnType<typeof createAutomationService>;
