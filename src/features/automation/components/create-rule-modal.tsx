"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/inputs";
import { Modal } from "@/components/ui/modal";
import { PlusIcon } from "@/components/ui/icons";
import { PRIORITIES } from "@/features/authorization/permissions";
import type { StatusRecord } from "@/features/statuses/status-service";
import { createRuleAction } from "@/features/automation/actions";
import { notifyCreated, notifyError } from "@/lib/notify";
import type {
  RuleActionType,
  RuleTriggerType,
} from "@/features/automation/automation-types";

export function CreateRuleModal({
  workspaceId,
  projectId,
  statuses,
  members,
  open,
  onClose,
}: {
  workspaceId: string;
  projectId: string;
  statuses: StatusRecord[];
  members: { userId: string; name: string }[];
  open: boolean;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedTrigger, setSelectedTrigger] =
    useState<RuleTriggerType>("StatusChanged");
  const [selectedAction, setSelectedAction] =
    useState<RuleActionType>("ChangePriority");

  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      const res = await createRuleAction(workspaceId, projectId, formData);
      if (!res?.error) {
        notifyCreated("automation rule");
        onClose();
      } else {
        notifyError(res.error);
      }
      return res;
    },
    {},
  );

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="create-rule-title"
      panelClassName="max-w-2xl p-6"
    >
      <div className="flex items-center justify-between pb-3 border-b border-rule">
        <div>
          <h2 id="create-rule-title" className="text-lg font-semibold tracking-tight text-ink">
            New Automation Rule
          </h2>
          <p className="text-xs text-ink-soft mt-0.5">
            Set up an automated WHEN-THEN workflow rule for this project.
          </p>
        </div>
      </div>

      <form action={formAction} className="mt-4 space-y-4">
        {state?.error ? (
          <div role="alert" className="rounded-md bg-danger/10 border border-danger/20 p-2.5 text-xs text-danger">
            {state.error}
          </div>
        ) : null}

        <Field label="Rule Name *">
          <Input
            ref={inputRef}
            name="name"
            placeholder="e.g. Set Urgent when In Progress"
            required
            maxLength={100}
            aria-label="Rule name"
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* TRIGGER CONFIG */}
          <div className="space-y-3 rounded-md border border-rule bg-field-bg/30 p-3.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              WHEN (Trigger)
            </span>
            <Field label="Trigger Event">
              <select
                name="triggerType"
                value={selectedTrigger}
                onChange={(e) =>
                  setSelectedTrigger(e.target.value as RuleTriggerType)
                }
                className="w-full rounded-md border border-rule bg-panel px-2.5 py-1.5 text-xs text-ink focus:border-primary focus:outline-none"
              >
                <option value="StatusChanged">Status is changed</option>
                <option value="TaskCreated">Task is created</option>
                <option value="PriorityChanged">Priority is changed</option>
              </select>
            </Field>

            {selectedTrigger === "StatusChanged" && (
              <div className="space-y-2 pt-1">
                <Field label="From Status (optional)">
                  <select
                    name="trigger_fromStatusId"
                    className="w-full rounded-md border border-rule bg-panel px-2.5 py-1.5 text-xs text-ink focus:border-primary focus:outline-none"
                  >
                    <option value="">Any status</option>
                    {statuses.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="To Status">
                  <select
                    name="trigger_toStatusId"
                    className="w-full rounded-md border border-rule bg-panel px-2.5 py-1.5 text-xs text-ink focus:border-primary focus:outline-none"
                  >
                    <option value="">Any status</option>
                    {statuses.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}

            {selectedTrigger === "TaskCreated" && (
              <div className="space-y-2 pt-1">
                <Field label="In Status (optional)">
                  <select
                    name="trigger_statusId"
                    className="w-full rounded-md border border-rule bg-panel px-2.5 py-1.5 text-xs text-ink focus:border-primary focus:outline-none"
                  >
                    <option value="">Any status</option>
                    {statuses.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="With Priority (optional)">
                  <select
                    name="trigger_priority"
                    className="w-full rounded-md border border-rule bg-panel px-2.5 py-1.5 text-xs text-ink focus:border-primary focus:outline-none"
                  >
                    <option value="">Any priority</option>
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}

            {selectedTrigger === "PriorityChanged" && (
              <div className="space-y-2 pt-1">
                <Field label="From Priority (optional)">
                  <select
                    name="trigger_fromPriority"
                    className="w-full rounded-md border border-rule bg-panel px-2.5 py-1.5 text-xs text-ink focus:border-primary focus:outline-none"
                  >
                    <option value="">Any priority</option>
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="To Priority">
                  <select
                    name="trigger_toPriority"
                    className="w-full rounded-md border border-rule bg-panel px-2.5 py-1.5 text-xs text-ink focus:border-primary focus:outline-none"
                  >
                    <option value="">Any priority</option>
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}
          </div>

          {/* ACTION CONFIG */}
          <div className="space-y-3 rounded-md border border-rule bg-field-bg/30 p-3.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              THEN (Action)
            </span>
            <Field label="Action Type">
              <select
                name="actionType"
                value={selectedAction}
                onChange={(e) =>
                  setSelectedAction(e.target.value as RuleActionType)
                }
                className="w-full rounded-md border border-rule bg-panel px-2.5 py-1.5 text-xs text-ink focus:border-primary focus:outline-none"
              >
                <option value="ChangePriority">Change Priority</option>
                <option value="ChangeStatus">Change Status</option>
                <option value="ChangeAssignee">Change Assignee</option>
                <option value="AddComment">Add Comment</option>
              </select>
            </Field>

            {selectedAction === "ChangePriority" && (
              <div className="pt-1">
                <Field label="Set Priority to *">
                  <select
                    name="action_priority"
                    className="w-full rounded-md border border-rule bg-panel px-2.5 py-1.5 text-xs text-ink focus:border-primary focus:outline-none"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}

            {selectedAction === "ChangeStatus" && (
              <div className="pt-1">
                <Field label="Set Status to *">
                  <select
                    name="action_statusId"
                    className="w-full rounded-md border border-rule bg-panel px-2.5 py-1.5 text-xs text-ink focus:border-primary focus:outline-none"
                  >
                    {statuses.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}

            {selectedAction === "ChangeAssignee" && (
              <div className="pt-1">
                <Field label="Assign to *">
                  <select
                    name="action_assigneeId"
                    className="w-full rounded-md border border-rule bg-panel px-2.5 py-1.5 text-xs text-ink focus:border-primary focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}

            {selectedAction === "AddComment" && (
              <div className="pt-1">
                <Field label="Comment Text *">
                  <Input
                    name="action_comment"
                    placeholder="e.g. Please review this task."
                    required
                  />
                </Field>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-rule">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Creating..." : "Create rule"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function CreateRuleButton({
  workspaceId,
  projectId,
  statuses,
  members,
}: {
  workspaceId: string;
  projectId: string;
  statuses: StatusRecord[];
  members: { userId: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
        Add rule
      </Button>
      <CreateRuleModal
        workspaceId={workspaceId}
        projectId={projectId}
        statuses={statuses}
        members={members}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
