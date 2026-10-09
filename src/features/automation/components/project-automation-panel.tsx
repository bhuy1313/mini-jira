"use client";

import { useState, useTransition, useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { TrashIcon } from "@/components/ui/icons";
import {
  canManageAutomationRules,
  type Role,
} from "@/features/authorization/permissions";
import type { StatusRecord } from "@/features/statuses/status-service";
import {
  deleteRuleAction,
  toggleRuleAction,
} from "@/features/automation/actions";
import { CreateRuleButton } from "@/features/automation/components/create-rule-modal";
import { formatDateTime } from "@/lib/dates";
import type {
  AutomationExecutionLogRecord,
  AutomationRuleRecord,
  ChangeAssigneeActionConfig,
  ChangePriorityActionConfig,
  ChangeStatusActionConfig,
  AddCommentActionConfig,
  PriorityChangedTriggerConfig,
  StatusChangedTriggerConfig,
  TaskCreatedTriggerConfig,
} from "@/features/automation/automation-types";

function describeTrigger(
  rule: AutomationRuleRecord,
  statuses: StatusRecord[],
): string {
  switch (rule.triggerType) {
    case "TaskCreated": {
      const config = (rule.triggerConfig as TaskCreatedTriggerConfig) ?? {};
      const parts: string[] = [];
      if (config.statusId) {
        const s = statuses.find((st) => st.id === config.statusId);
        parts.push(`in status "${s ? s.name : config.statusId}"`);
      }
      if (config.priority) {
        parts.push(`with priority "${config.priority}"`);
      }
      return parts.length > 0
        ? `When task is created ${parts.join(" and ")}`
        : "When any task is created";
    }
    case "StatusChanged": {
      const config = (rule.triggerConfig as StatusChangedTriggerConfig) ?? {};
      const from = config.fromStatusId
        ? `from "${statuses.find((s) => s.id === config.fromStatusId)?.name ?? config.fromStatusId}"`
        : "";
      const to = config.toStatusId
        ? `to "${statuses.find((s) => s.id === config.toStatusId)?.name ?? config.toStatusId}"`
        : "";
      if (from && to) return `When status changed ${from} ${to}`;
      if (to) return `When status changed ${to}`;
      if (from) return `When status changed ${from}`;
      return "When status changed to any status";
    }
    case "PriorityChanged": {
      const config = (rule.triggerConfig as PriorityChangedTriggerConfig) ?? {};
      const from = config.fromPriority ? `from "${config.fromPriority}"` : "";
      const to = config.toPriority ? `to "${config.toPriority}"` : "";
      if (from && to) return `When priority changed ${from} ${to}`;
      if (to) return `When priority changed ${to}`;
      if (from) return `When priority changed ${from}`;
      return "When priority changed";
    }
    default:
      return rule.triggerType;
  }
}

function describeAction(
  rule: AutomationRuleRecord,
  statuses: StatusRecord[],
  members: { userId: string; name: string }[],
): string {
  switch (rule.actionType) {
    case "ChangeAssignee": {
      const config = rule.actionConfig as ChangeAssigneeActionConfig;
      if (!config.assigneeId) return "Unassign task";
      const member = members.find((m) => m.userId === config.assigneeId);
      return `Assign to ${member ? member.name : config.assigneeId}`;
    }
    case "ChangePriority": {
      const config = rule.actionConfig as ChangePriorityActionConfig;
      return `Change priority to ${config.priority}`;
    }
    case "ChangeStatus": {
      const config = rule.actionConfig as ChangeStatusActionConfig;
      const status = statuses.find((s) => s.id === config.statusId);
      return `Change status to "${status ? status.name : config.statusId}"`;
    }
    case "AddComment": {
      const config = rule.actionConfig as AddCommentActionConfig;
      return `Add comment "${config.comment}"`;
    }
    default:
      return rule.actionType;
  }
}

function RuleRow({
  rule,
  workspaceId,
  projectId,
  statuses,
  members,
  canManage,
}: {
  rule: AutomationRuleRecord;
  workspaceId: string;
  projectId: string;
  statuses: StatusRecord[];
  members: { userId: string; name: string }[];
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);

  const [, doDeleteAction, deletePending] = useActionState(
    (_prev: { error?: string }) => deleteRuleAction(workspaceId, projectId, rule.id),
    {},
  );

  function handleToggle() {
    startTransition(async () => {
      await toggleRuleAction(workspaceId, projectId, rule.id, !rule.enabled);
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-rule last:border-b-0">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-ink">{rule.name}</span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              rule.enabled
                ? "bg-primary/10 text-primary border border-primary/20"
                : "bg-paper text-ink-faint border border-rule"
            }`}
          >
            {rule.enabled ? "Active" : "Disabled"}
          </span>
        </div>
        <div className="text-xs text-ink-soft flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-ink">
            {describeTrigger(rule, statuses)}
          </span>
          <span className="text-ink-faint">→</span>
          <span className="font-medium text-primary">
            {describeAction(rule, statuses, members)}
          </span>
        </div>
      </div>

      {canManage && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isPending}
            onClick={handleToggle}
            className="text-xs h-7 px-2.5"
          >
            {rule.enabled ? "Disable" : "Enable"}
          </Button>

          {deleting ? (
            <div className="flex items-center gap-1">
              <form action={doDeleteAction}>
                <Button
                  type="submit"
                  variant="danger"
                  size="sm"
                  disabled={deletePending}
                  className="text-xs h-7 px-2"
                >
                  Confirm
                </Button>
              </form>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDeleting(false)}
                className="text-xs h-7 px-2"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setDeleting(true)}
              aria-label={`Delete rule ${rule.name}`}
              className="text-ink-faint hover:text-danger p-1 rounded transition-colors"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export function ProjectAutomationPanel({
  workspaceId,
  projectId,
  rules,
  logs,
  statuses,
  members,
  actorProjectRole,
}: {
  workspaceId: string;
  projectId: string;
  rules: AutomationRuleRecord[];
  logs: AutomationExecutionLogRecord[];
  statuses: StatusRecord[];
  members: { userId: string; name: string }[];
  actorProjectRole: Role;
}) {
  const canManage = canManageAutomationRules(actorProjectRole);
  const [activeTab, setActiveTab] = useState<"rules" | "logs">("rules");

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            Automation / Rules Engine
          </h2>
          <p className="text-sm text-ink-soft">
            Automate actions like changing status, priority, assignee, or adding comments when events occur.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-rule bg-paper p-1">
            <button
              type="button"
              onClick={() => setActiveTab("rules")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeTab === "rules"
                  ? "bg-panel text-ink shadow-sm"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              Rules ({rules.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("logs")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeTab === "logs"
                  ? "bg-panel text-ink shadow-sm"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              Execution Logs ({logs.length})
            </button>
          </div>

          {canManage && activeTab === "rules" && (
            <CreateRuleButton
              workspaceId={workspaceId}
              projectId={projectId}
              statuses={statuses}
              members={members}
            />
          )}
        </div>
      </div>

      {activeTab === "rules" && (
        <div className="space-y-4">
          {rules.length === 0 ? (
            <p className="text-sm text-ink-soft py-4 text-center">
              No automation rules created yet.
            </p>
          ) : (
            <ul className="divide-y divide-rule rounded-md border border-rule bg-panel px-4">
              {rules.map((rule) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  workspaceId={workspaceId}
                  projectId={projectId}
                  statuses={statuses}
                  members={members}
                  canManage={canManage}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === "logs" && (
        <div>
          {logs.length === 0 ? (
            <p className="text-sm text-ink-soft py-4 text-center">
              No execution logs recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-rule text-ink-soft font-semibold">
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Rule</th>
                    <th className="py-2 px-3">Result / Message</th>
                    <th className="py-2 px-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-paper/40">
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            log.status === "Success"
                              ? "bg-success/15 text-success border border-success/20"
                              : log.status === "Failed"
                                ? "bg-danger/15 text-danger border border-danger/20"
                                : "bg-paper text-ink-faint border border-rule"
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-ink whitespace-nowrap">
                        {log.ruleName || log.ruleId}
                      </td>
                      <td className="py-2.5 px-3 text-ink-soft max-w-md truncate">
                        {log.message || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-ink-faint whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
