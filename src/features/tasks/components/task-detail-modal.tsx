"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { CloseIcon } from "@/components/ui/icons";
import { Markdown } from "@/components/ui/markdown";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";

import type { ActivityRecord } from "@/features/activities/activity-service";
import { ActivityTimeline } from "@/features/activities/components/activity-timeline";
import { AttachmentList } from "@/features/attachments/components/attachment-list";
import type { AttachmentRecord } from "@/features/attachments/attachment-service";
import type { Role, TaskField } from "@/features/authorization/permissions";
import {
  canAssignTask,
  canChangeDueDate,
  canChangePriority,
  canEditTask,
  canEditTaskField,
  PRIORITIES,
  canToggleTaskLabels,
} from "@/features/authorization/permissions";
import { CommentList } from "@/features/comments/components/comment-list";
import type { CommentRecord } from "@/features/comments/comment-service";
import { setTaskCustomFieldValueAction } from "@/features/custom-fields/actions";
import type {
  CustomFieldRecord,
  TaskCustomFieldValueRecord,
} from "@/features/custom-fields/custom-field-service";
import {
  addLabelToTaskAction,
  removeLabelFromTaskAction,
} from "@/features/labels/actions";
import { LabelChip } from "@/features/labels/components/label-chip";
import type { LabelRecord } from "@/features/labels/label-service";
import type { StatusRecord } from "@/features/statuses/status-service";
import { updateTaskFieldAction } from "@/features/tasks/actions";
import type { TaskRecord } from "@/features/tasks/task-service";
import { SubtaskList } from "@/features/tasks/components/subtask-list";
import type { SprintRecord } from "@/features/sprints/sprint-service";
import type { MemberWithUser } from "@/features/workspaces/workspace-service";
import { TimeTrackingBar } from "@/features/worklogs/components/time-tracking-bar";
import { LogWorkModal } from "@/features/worklogs/components/log-work-modal";
import { WorklogList } from "@/features/worklogs/components/worklog-list";
import type { WorklogRecord } from "@/features/worklogs/worklog-service";
import { canLogWork } from "@/features/authorization/permissions";


function MetaSelect({
  label,
  value,
  children,
  onValue,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
  onValue: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-ink-faint">{label}</span>
      <select
        value={value}
        aria-label={label}
        onChange={(e) => onValue(e.target.value)}
        className="mt-1 w-full cursor-pointer rounded-md border border-rule bg-transparent px-1 py-0.5 text-sm font-medium text-ink hover:border-rule-strong focus:border-primary focus:outline-none"
      >
        {children}
      </select>
    </label>
  );
}

function StaticMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-xs text-ink-faint">{label}</span>
      <p className="mt-1 text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

function TaskLabelPicker({
  taskId,
  workspaceId,
  projectId,
  labels: initialLabels,
  projectLabels,
  canToggle,
}: {
  taskId: string;
  workspaceId: string;
  projectId: string;
  labels: LabelRecord[];
  projectLabels: LabelRecord[];
  canToggle: boolean;
}) {
  const router = useRouter();
  const [localLabels, setLocalLabels] = useState(initialLabels);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalLabels(initialLabels);
  }, [initialLabels]);

  const attachedIds = new Set(localLabels.map((l) => l.id));
  const available = projectLabels.filter((l) => !attachedIds.has(l.id));

  async function toggle(action: typeof addLabelToTaskAction, labelId: string, isRemove = false) {
    setError(null);
    if (isRemove) {
      setLocalLabels((prev) => prev.filter((l) => l.id !== labelId));
    } else {
      const added = projectLabels.find((l) => l.id === labelId);
      if (added) setLocalLabels((prev) => [...prev, added]);
    }
    const res = await action(workspaceId, projectId, taskId, labelId);
    if (res.error) {
      setError(res.error);
      setLocalLabels(initialLabels);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}

      {localLabels.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {localLabels.map((label) => (
            <LabelChip key={label.id} label={label} onRemove={() => toggle(removeLabelFromTaskAction, label.id, true)} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-soft">No labels attached yet.</p>
      )}

      {canToggle && available.length > 0 ? (
        <div className="border-t border-rule pt-3">
          <p className="mb-2 text-xs font-medium text-ink-faint">Add a label</p>
          <div className="flex flex-wrap gap-1.5">
            {available.map((label) => (
              <button
                key={label.id}
                type="button"
                aria-label={`Add label ${label.name}`}
                onClick={() => toggle(addLabelToTaskAction, label.id, false)}
                className="inline-flex items-center gap-1 rounded border border-rule px-1.5 py-0.5 text-[11px] font-medium text-ink-soft transition-colors hover:border-rule-strong hover:text-ink"
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: label.color }}
                  aria-hidden
                />
                {label.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TaskCustomFieldInput({
  field,
  value,
  canEdit,
  onSave,
}: {
  field: CustomFieldRecord;
  value: unknown;
  canEdit: boolean;
  onSave: (value: unknown) => void;
}) {
  const [localVal, setLocalVal] = useState<string>(
    value !== null && value !== undefined ? String(value) : "",
  );
  const [localBool, setLocalBool] = useState<boolean>(Boolean(value));

  useEffect(() => {
    setLocalVal(value !== null && value !== undefined ? String(value) : "");
    setLocalBool(Boolean(value));
  }, [value]);

  if (!canEdit) {
    let displayVal = "—";
    if (value !== null && value !== undefined && value !== "") {
      if (field.type === "Date") {
        displayVal = new Date(String(value)).toLocaleDateString();
      } else if (field.type === "Checkbox") {
        displayVal = value ? "Yes" : "No";
      } else {
        displayVal = String(value);
      }
    }
    return <StaticMeta label={field.name} value={displayVal} />;
  }

  switch (field.type) {
    case "Text":
      return (
        <label className="block">
          <span className="block text-xs text-ink-faint">
            {field.name} {field.required ? <span className="text-danger">*</span> : null}
          </span>
          <input
            type="text"
            value={localVal}
            aria-label={field.name}
            onChange={(e) => setLocalVal(e.target.value)}
            onBlur={() => {
              const val = localVal.trim();
              onSave(val !== "" ? val : null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="mt-1 w-full rounded-md border border-rule bg-transparent px-2 py-0.5 text-sm font-medium text-ink hover:border-rule-strong focus:border-primary focus:outline-none"
          />
        </label>
      );

    case "Number":
      return (
        <label className="block">
          <span className="block text-xs text-ink-faint">
            {field.name} {field.required ? <span className="text-danger">*</span> : null}
          </span>
          <input
            type="number"
            step="any"
            value={localVal}
            aria-label={field.name}
            onChange={(e) => setLocalVal(e.target.value)}
            onBlur={() => {
              const val = localVal.trim();
              onSave(val !== "" ? Number(val) : null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="mt-1 w-full rounded-md border border-rule bg-transparent px-2 py-0.5 text-sm font-medium text-ink hover:border-rule-strong focus:border-primary focus:outline-none"
          />
        </label>
      );

    case "Date":
      return (
        <label className="block">
          <span className="block text-xs text-ink-faint">
            {field.name} {field.required ? <span className="text-danger">*</span> : null}
          </span>
          <input
            type="date"
            value={localVal ? localVal.slice(0, 10) : ""}
            aria-label={field.name}
            onChange={(e) => {
              const val = e.target.value || "";
              setLocalVal(val);
              onSave(val !== "" ? val : null);
            }}
            className="mt-1 w-full cursor-pointer rounded-md border border-rule bg-transparent px-1 py-0.5 text-sm font-medium text-ink hover:border-rule-strong focus:border-primary focus:outline-none"
          />
        </label>
      );

    case "Select":
      return (
        <label className="block">
          <span className="block text-xs text-ink-faint">
            {field.name} {field.required ? <span className="text-danger">*</span> : null}
          </span>
          <select
            value={localVal}
            aria-label={field.name}
            onChange={(e) => {
              const val = e.target.value || "";
              setLocalVal(val);
              onSave(val !== "" ? val : null);
            }}
            className="mt-1 w-full cursor-pointer rounded-md border border-rule bg-transparent px-1 py-0.5 text-sm font-medium text-ink hover:border-rule-strong focus:border-primary focus:outline-none"
          >
            <option value="">None</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      );

    case "Checkbox":
      return (
        <div className="flex flex-col justify-end">
          <span className="block text-xs text-ink-faint">
            {field.name} {field.required ? <span className="text-danger">*</span> : null}
          </span>
          <label className="mt-1.5 inline-flex items-center gap-2 text-sm font-medium text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={localBool}
              aria-label={field.name}
              onChange={(e) => {
                setLocalBool(e.target.checked);
                onSave(e.target.checked);
              }}
              className="size-4 accent-primary rounded"
            />
            <span>{localBool ? "Yes" : "No"}</span>
          </label>
        </div>
      );

    default:
      return null;
  }
}

export function TaskDetailModal({
  task,
  workspaceId,
  projectId,
  statuses = [],
  sprints = [],
  members,
  comments,
  activities,
  attachments,
  labels,
  projectLabels,
  customFields = [],
  customFieldValues = [],
  worklogs = [],
  actorRole,
  actorUserId,
  onClose,
}: {
  task: TaskRecord;
  workspaceId: string;
  projectId: string;
  statuses?: StatusRecord[];
  sprints?: SprintRecord[];
  members: MemberWithUser[];
  comments: CommentRecord[];
  activities: ActivityRecord[];
  attachments: AttachmentRecord[];
  labels: LabelRecord[];
  projectLabels: LabelRecord[];
  customFields?: CustomFieldRecord[];
  customFieldValues?: TaskCustomFieldValueRecord[];
  worklogs?: WorklogRecord[];
  actorRole: Role;
  actorUserId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"comments" | "activities" | "attachments" | "labels" | "worklogs">("comments");
  const [isLogWorkOpen, setIsLogWorkOpen] = useState(false);
  const [customFieldError, setCustomFieldError] = useState<string | null>(null);

  const ctx = {
    role: actorRole,
    isCreator: task.creatorId === actorUserId,
    isAssignee: task.assigneeId === actorUserId,
  };

  const canEditTitle = canEditTaskField("title" as TaskField, ctx);
  const canEditDescription = canEditTaskField("description" as TaskField, ctx);
  const canMove = canEditTaskField("status" as TaskField, ctx);
  const canChangeSprint = canEditTaskField("sprintId" as TaskField, ctx);
  const canEditEstimate = canEditTaskField("originalEstimateMinutes" as TaskField, ctx);
  const canAssign = canAssignTask(actorRole);
  const canChangePrio = canChangePriority(actorRole);
  const canChangeDue = canChangeDueDate(actorRole);
  const canLog = canLogWork(actorRole);

  const [titleState, titleAction, titlePending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      const value = String(formData.get("title") || "");
      return updateTaskFieldAction(workspaceId, projectId, task.id, "title", value);
    },
    {},
  );

  const [descState, descAction, descPending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      const value = String(formData.get("description") || "");
      return updateTaskFieldAction(workspaceId, projectId, task.id, "description", value);
    },
    {},
  );

  const titleRef = useRef<HTMLInputElement>(null);
  async function saveField(field: TaskField, value: string) {
    await updateTaskFieldAction(workspaceId, projectId, task.id, field, value);
    router.refresh();
  }

  async function handleSaveCustomField(fieldId: string, val: unknown) {
    setCustomFieldError(null);
    const res = await setTaskCustomFieldValueAction(
      workspaceId,
      projectId,
      task.id,
      fieldId,
      val,
    );
    if (res.error) {
      setCustomFieldError(res.error);
    } else {
      router.refresh();
    }
  }


  const currentStatusName =
    task.statusName ||
    statuses.find((s) => s.id === task.statusId)?.name ||
    "—";

  const assigneeName =
    members.find((m) => m.userId === task.assigneeId)?.name ?? "Unassigned";
  const dueText = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "None";

  const currentSprintName =
    task.sprintName ||
    sprints.find((s) => s.id === task.sprintId)?.name ||
    "Backlog";

  return (
    <Drawer open onClose={onClose} labelledBy="task-detail-title" className="max-w-2xl">
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-rule p-5">
        <div className="min-w-0 flex-1">
          {task.parentId && (
            <div className="mb-1 flex items-center gap-1.5 text-xs text-ink-faint">
              <span>Sub-task of</span>
              <span className="font-semibold text-ink">{task.parentTitle || "Parent task"}</span>
            </div>
          )}
          {canEditTitle ? (
            <form
              action={titleAction}
              className="flex items-center gap-2"
            >
              <input
                ref={titleRef}
                name="title"
                defaultValue={task.title}
                id="task-detail-title"
                aria-label="Task title"
                className="w-full rounded-md border border-rule-strong bg-panel px-2 py-1 text-lg font-semibold text-ink focus:border-primary focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.form?.requestSubmit();
                }}
              />
              {titlePending ? <Spinner className="size-4 shrink-0 text-ink-faint" /> : null}
            </form>
          ) : (
            <h2 id="task-detail-title" className="text-lg font-semibold leading-snug text-ink">
              {task.title}
            </h2>
          )}
          {titleState.error ? (
            <p role="alert" className="mt-1 text-xs text-danger">
              {titleState.error}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="grid size-8 shrink-0 place-items-center rounded-md text-ink-faint transition-colors hover:bg-paper hover:text-ink"
        >
          <CloseIcon className="size-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {/* Metadata */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-md border border-rule bg-panel p-3.5 sm:grid-cols-4">
          {canMove ? (
            <MetaSelect
              label="Status"
              value={task.statusId}
              onValue={(v) => saveField("status", v)}
            >
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </MetaSelect>
          ) : (
            <StaticMeta label="Status" value={currentStatusName} />
          )}

          {canChangePrio ? (
            <MetaSelect
              label="Priority"
              value={task.priority}
              onValue={(v) => saveField("priority", v)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </MetaSelect>
          ) : (
            <StaticMeta label="Priority" value={task.priority} />
          )}

          {canAssign ? (
            <MetaSelect label="Assignee" value={task.assigneeId ?? ""} onValue={(v) => saveField("assigneeId", v)}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </MetaSelect>
          ) : (
            <StaticMeta label="Assignee" value={assigneeName} />
          )}

          {canChangeDue ? (
            <label className="block">
              <span className="block text-xs text-ink-faint">Due date</span>
              <input
                type="date"
                value={task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ""}
                aria-label="Due date"
                onChange={(e) => saveField("dueDate", e.target.value)}
                className="mt-1 w-full cursor-pointer rounded-md border border-rule bg-transparent px-1 py-0.5 text-sm font-medium text-ink hover:border-rule-strong focus:border-primary focus:outline-none"
              />
            </label>
          ) : (
            <StaticMeta label="Due date" value={dueText} />
          )}

          {canChangeSprint ? (
            <MetaSelect
              label="Sprint"
              value={task.sprintId ?? ""}
              onValue={(v) => saveField("sprintId", v)}
            >
              <option value="">Backlog</option>
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </MetaSelect>
          ) : (
            <StaticMeta label="Sprint" value={currentSprintName} />
          )}
        </div>

        {/* Time Tracking Widget */}
        <TimeTrackingBar
          workspaceId={workspaceId}
          projectId={projectId}
          taskId={task.id}
          originalEstimateMinutes={task.originalEstimateMinutes}
          worklogs={worklogs}
          canEditEstimate={canEditEstimate}
          canLog={canLog}
          onOpenLogModal={() => setIsLogWorkOpen(true)}
        />

        {/* Custom Fields */}
        {customFields.length > 0 ? (
          <div className="space-y-3 rounded-md border border-rule bg-panel p-3.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Custom Fields
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              {customFields.map((field) => {
                const valObj = customFieldValues.find((v) => v.fieldId === field.id);
                const currentVal = valObj?.value;
                return (
                  <TaskCustomFieldInput
                    key={field.id}
                    field={field}
                    value={currentVal}
                    canEdit={canEditTask(ctx)}
                    onSave={(val) => handleSaveCustomField(field.id, val)}
                  />
                );
              })}
            </div>
            {customFieldError ? (
              <p role="alert" className="text-xs text-danger">
                {customFieldError}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Description */}
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-ink-faint">Description</h3>
          {canEditDescription ? (
            <form action={descAction}>
              <MarkdownEditor
                name="description"
                defaultValue={task.description ?? ""}
                placeholder="Add a detailed description… Markdown is supported."
                ariaLabel="Task description"
                members={members}
                rows={4}
              />
              {descState.error ? (
                <p role="alert" className="mt-1 text-xs text-danger">
                  {descState.error}
                </p>
              ) : null}
              <div className="mt-2 flex justify-end">
                <Button type="submit" variant="secondary" size="sm" disabled={descPending}>
                  {descPending ? "Saving…" : "Save description"}
                </Button>
              </div>
            </form>
          ) : task.description?.trim() ? (
            <div className="rounded-md border border-rule bg-paper/50 p-3">
              <Markdown source={task.description} members={members} />
            </div>
          ) : (
            <p className="whitespace-pre-wrap rounded-md border border-rule bg-paper/50 p-3 text-sm leading-6 text-ink-soft">
              No description provided.
            </p>
          )}
        </div>

        {/* Sub-tasks Section (only for parent tasks) */}
        {!task.parentId && (
          <SubtaskList
            workspaceId={workspaceId}
            projectId={projectId}
            parentTaskId={task.id}
            subtasks={task.subtasks ?? []}
            members={members}
            canEdit={canEditTask(ctx)}
          />
        )}

        {/* Tabs */}
        <div className="border-t border-rule pt-4">
          <div className="flex gap-1 border-b border-rule text-sm">
            <button
              type="button"
              onClick={() => setActiveTab("comments")}
              aria-pressed={activeTab === "comments"}
              className={cn(
                "-mb-px border-b-2 px-1 pb-2 font-medium transition-colors",
                activeTab === "comments"
                  ? "border-primary text-primary-deep"
                  : "border-transparent text-ink-faint hover:text-ink-soft",
              )}
            >
              Comments <span className="ml-1 text-xs text-ink-faint">{comments.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("activities")}
              aria-pressed={activeTab === "activities"}
              className={cn(
                "-mb-px ml-5 border-b-2 px-1 pb-2 font-medium transition-colors",
                activeTab === "activities"
                  ? "border-primary text-primary-deep"
                  : "border-transparent text-ink-faint hover:text-ink-soft",
              )}
            >
              Activity <span className="ml-1 text-xs text-ink-faint">{activities.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("attachments")}
              aria-pressed={activeTab === "attachments"}
              className={cn(
                "-mb-px ml-5 border-b-2 px-1 pb-2 font-medium transition-colors",
                activeTab === "attachments"
                  ? "border-primary text-primary-deep"
                  : "border-transparent text-ink-faint hover:text-ink-soft",
              )}
            >
              Attachments{" "}
              <span className="ml-1 text-xs text-ink-faint">{attachments.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("labels")}
              aria-pressed={activeTab === "labels"}
              className={cn(
                "-mb-px ml-5 border-b-2 px-1 pb-2 font-medium transition-colors",
                activeTab === "labels"
                  ? "border-primary text-primary-deep"
                  : "border-transparent text-ink-faint hover:text-ink-soft",
              )}
            >
              Labels <span className="ml-1 text-xs text-ink-faint">{labels.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("worklogs")}
              aria-pressed={activeTab === "worklogs"}
              className={cn(
                "-mb-px ml-5 border-b-2 px-1 pb-2 font-medium transition-colors",
                activeTab === "worklogs"
                  ? "border-primary text-primary-deep"
                  : "border-transparent text-ink-faint hover:text-ink-soft",
              )}
            >
              Work Log <span className="ml-1 text-xs text-ink-faint">{worklogs.length}</span>
            </button>
          </div>

          <div className="mt-4">
            {activeTab === "comments" ? (
              <CommentList
                taskId={task.id}
                workspaceId={workspaceId}
                projectId={projectId}
                comments={comments}
                actorRole={actorRole}
                actorUserId={actorUserId}
                members={members}
              />
            ) : activeTab === "activities" ? (
              <ActivityTimeline activities={activities} />
            ) : activeTab === "attachments" ? (
              <AttachmentList
                taskId={task.id}
                workspaceId={workspaceId}
                projectId={projectId}
                attachments={attachments}
                actorRole={actorRole}
                actorUserId={actorUserId}
              />
            ) : activeTab === "labels" ? (
              <TaskLabelPicker
                taskId={task.id}
                workspaceId={workspaceId}
                projectId={projectId}
                labels={labels}
                projectLabels={projectLabels}
                canToggle={canToggleTaskLabels(actorRole)}
              />
            ) : (
              <WorklogList
                taskId={task.id}
                taskTitle={task.title}
                workspaceId={workspaceId}
                projectId={projectId}
                worklogs={worklogs}
                actorRole={actorRole}
                actorUserId={actorUserId}
                onOpenLogModal={() => setIsLogWorkOpen(true)}
              />
            )}
          </div>
        </div>
      </div>

      {isLogWorkOpen && (
        <LogWorkModal
          open={isLogWorkOpen}
          onClose={() => setIsLogWorkOpen(false)}
          workspaceId={workspaceId}
          projectId={projectId}
          taskId={task.id}
          taskTitle={task.title}
        />
      )}
    </Drawer>
  );
}