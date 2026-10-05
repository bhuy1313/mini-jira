"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import {
  CalendarIcon,
  ClockIcon,
  CommentIcon,
  GripIcon,
  PlusIcon,
  TrashIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";

import type { ActivityRecord } from "@/features/activities/activity-service";
import type { AttachmentRecord } from "@/features/attachments/attachment-service";
import type { Role, TaskField } from "@/features/authorization/permissions";
import { formatDuration } from "@/features/worklogs/duration";
import type { WorklogRecord } from "@/features/worklogs/worklog-service";
import {
  canDeleteTask,
  canEditTaskField,
} from "@/features/authorization/permissions";
import { useLiveEvents } from "@/features/live/use-live-events";
import type { CommentRecord } from "@/features/comments/comment-service";
import type { LabelRecord } from "@/features/labels/label-service";
import { LabelChip } from "@/features/labels/components/label-chip";
import type { StatusRecord } from "@/features/statuses/status-service";
import type { SprintRecord } from "@/features/sprints/sprint-service";
import { SprintSwitcher } from "@/features/sprints/components/sprint-switcher";
import {
  createTaskAction,
  deleteTaskAction,
  moveTaskAction,
  moveTaskToIndexAction,
  updateTaskFieldAction,
} from "@/features/tasks/actions";
import { CreateTaskModal } from "@/features/tasks/components/create-task-modal";
import { TaskDetailModal } from "@/features/tasks/components/task-detail-modal";
import { TaskFilterToolbar } from "@/features/tasks/components/task-filter-toolbar";
import type {
  CustomFieldRecord,
  TaskCustomFieldValueRecord,
} from "@/features/custom-fields/custom-field-service";
import type { TaskFilterInput, TaskRecord } from "@/features/tasks/task-service";

import type { MemberWithUser } from "@/features/workspaces/workspace-service";
import {
  getStatusDotClass,
  PRIORITY_LABEL,
  PRIORITY_SIGNAL_CLASS,
  PRIORITY_TAG_CLASS,
} from "@/features/tasks/task-meta";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1
    ? (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
    : name.charAt(0).toUpperCase();
}

function groupByStatus(tasks: TaskRecord[], statuses: StatusRecord[]): Record<string, TaskRecord[]> {
  const result: Record<string, TaskRecord[]> = {};
  for (const s of statuses) {
    result[s.id] = [];
  }
  for (const t of tasks) {
    const list = result[t.statusId] ?? (result[t.statusId] = []);
    list.push(t);
  }
  for (const key of Object.keys(result)) {
    result[key]?.sort((a, b) => a.position - b.position);
  }
  return result;
}

/* ------------------------- TaskCard (sortable) ------------------------- */

function StatusMenuMove({
  task,
  statuses,
  onMoveStatus,
}: {
  task: TaskRecord;
  statuses: StatusRecord[];
  onMoveStatus: (taskId: string, statusId: string) => void;
}) {
  return (
    <div className="flex items-center">
      <select
        value={task.statusId}
        aria-label={`Move ${task.title}`}
        onChange={(e) => {
          const newStatusId = e.target.value;
          if (newStatusId && newStatusId !== task.statusId) {
            onMoveStatus(task.id, newStatusId);
          }
        }}
        className="h-7 cursor-pointer rounded-md border border-rule bg-panel px-2 text-xs text-ink-soft hover:border-rule-strong focus:border-primary focus:outline-none"
      >
        {statuses.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function DeleteTaskButton({
  task,
  onDelete,
}: {
  task: TaskRecord;
  onDelete: (taskId: string) => void;
}) {
  return (
    <button
      type="button"
      aria-label="Delete task"
      onClick={() => {
        if (confirm(`Are you sure you want to delete "${task.title}"?`)) {
          onDelete(task.id);
        }
      }}
      className="grid size-7 place-items-center rounded-md text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
      title="Delete task"
    >
      <TrashIcon className="size-4" />
    </button>
  );
}


function SortableTaskCard({
  task,
  statuses,
  members,
  workspaceId,
  projectId,
  commentsCount,
  labels,
  worklogs = [],
  canMove,
  canDelete,
  canEditTitle,
  onOpenDetail,
  onMoveStatus,
  onDeleteTask,
}: {
  task: TaskRecord;
  statuses: StatusRecord[];
  members: MemberWithUser[];
  workspaceId: string;
  projectId: string;
  commentsCount: number;
  labels: LabelRecord[];
  worklogs?: WorklogRecord[];
  canMove: boolean;
  canDelete: boolean;
  canEditTitle: boolean;
  onOpenDetail: () => void;
  onMoveStatus: (taskId: string, statusId: string) => void;
  onDeleteTask: (taskId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, disabled: !canMove });

  const [titleState, titleAction, titlePending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      const value = String(formData.get("title") || "");
      return updateTaskFieldAction(workspaceId, projectId, task.id, "title", value);
    },
    {},
  );

  const assignee = task.assigneeId ? members.find((m) => m.userId === task.assigneeId) : null;
  const currentStatus = statuses.find((s) => s.id === task.statusId);
  const isDone = Boolean(currentStatus?.name.toLowerCase().includes("done"));
  const isOverdue = Boolean(
    task.dueDate &&
      !isDone &&
      new Date(task.dueDate).getTime() < new Date().setHours(0, 0, 0, 0)
  );

  return (
    <li
      ref={setNodeRef}
      data-task-id={task.id}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "group relative flex overflow-hidden rounded-lg border border-rule bg-panel text-ink shadow-xs transition-all duration-150 hover:shadow-md hover:border-primary-ink/40 hover:bg-primary-soft/30",
        isDragging && "rotate-2 opacity-40 shadow-lg",
      )}
    >
      <span
        aria-hidden
        className={cn("w-1.5 shrink-0 self-stretch", PRIORITY_SIGNAL_CLASS[task.priority])}
      />
      <div className="min-w-0 flex-1 px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          {canEditTitle ? (
            <form
              action={titleAction}
              className="flex min-w-0 flex-1 items-center gap-1.5"
            >
              <input
                key={task.title}
                name="title"
                defaultValue={task.title}
                aria-label={`Title: ${task.title}`}
                className="w-full min-w-0 rounded border-0 bg-transparent px-0 py-0 text-sm font-medium text-ink placeholder:text-ink-faint focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary dark:focus-visible:outline-paper"
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.form?.requestSubmit();
                }}
              />
              {titlePending ? <Spinner className="size-3.5 shrink-0 text-ink-faint" /> : null}
              {titleState.error ? (
                <p role="alert" className="text-xs text-danger">
                  {titleState.error}
                </p>
              ) : null}
            </form>
          ) : (
            <button
              type="button"
              onClick={onOpenDetail}
              className="min-w-0 flex-1 text-left text-sm font-medium text-ink hover:underline"
            >
              <span className="line-clamp-2">{task.title}</span>
            </button>
          )}

          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              aria-label="Drag to move"
              {...attributes}
              {...listeners}
              className={cn(
                "grid size-6 cursor-grab touch-none place-items-center rounded-md text-ink-faint opacity-0 transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100",
                !canMove && "hidden",
              )}
            >
              <GripIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={onOpenDetail}
              aria-label="Open details"
              className="grid size-6 place-items-center rounded-md text-ink-faint transition-colors hover:bg-paper hover:text-ink"
            >
              <PlusIcon className="size-4 rotate-45" />
            </button>
          </div>
        </div>

        {labels.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {labels.map((label) => (
              <LabelChip key={label.id} label={label} />
            ))}
          </div>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium",
              PRIORITY_TAG_CLASS[task.priority],
            )}
          >
            {PRIORITY_LABEL[task.priority]}
          </span>
          {task.dueDate ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors",
                isOverdue
                  ? "bg-danger-soft text-danger font-semibold"
                  : "text-ink-faint",
              )}
              title={isOverdue ? "Overdue deadline" : undefined}
            >
              <CalendarIcon className="size-3.5" />
              {task.dueDate.toISOString().slice(0, 10)}
            </span>
          ) : null}
          {commentsCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs text-ink-faint">
              <CommentIcon className="size-3.5" />
              {commentsCount}
            </span>
          ) : null}
          {task.subtaskCount > 0 ? (
            <span
              title={`${task.subtaskDoneCount} of ${task.subtaskCount} sub-tasks completed`}
              className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium",
                task.subtaskDoneCount === task.subtaskCount
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rule/70 text-ink-soft",
              )}
            >
              <svg
                className="size-3 text-ink-faint"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 3h5v5" />
                <path d="M8 21H3v-5" />
                <path d="M21 3l-7 7" />
                <path d="M3 21l7-7" />
              </svg>
              <span>
                {task.subtaskDoneCount}/{task.subtaskCount}
              </span>
            </span>
          ) : null}
          {task.parentId ? (
            <span
              title="Sub-task"
              className="inline-flex items-center gap-0.5 text-2xs font-medium text-ink-faint"
            >
              ↳ sub-task
            </span>
          ) : null}
          {(() => {
            const totalSpentMinutes = worklogs.reduce((sum, w) => sum + w.timeSpentMinutes, 0);
            const hasEstimate =
              task.originalEstimateMinutes !== null &&
              task.originalEstimateMinutes !== undefined &&
              task.originalEstimateMinutes > 0;
            if (!hasEstimate && totalSpentMinutes === 0) return null;
            const isOver = hasEstimate && totalSpentMinutes > task.originalEstimateMinutes!;
            return (
              <span
                title={`Time tracking: Logged ${formatDuration(totalSpentMinutes)}${
                  hasEstimate ? ` / Estimated ${formatDuration(task.originalEstimateMinutes!)}` : ""
                }`}
                className={cn(
                  "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium",
                  isOver
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold"
                    : "bg-rule/70 text-ink-soft",
                )}
              >
                <ClockIcon className="size-3 text-ink-faint" />
                <span>
                  {formatDuration(totalSpentMinutes)}
                  {hasEstimate ? ` / ${formatDuration(task.originalEstimateMinutes!)}` : ""}
                </span>
              </span>
            );
          })()}
          <span
            title={assignee ? assignee.name : "Unassigned"}
            className="ml-auto inline-flex shrink-0 items-center gap-1.5"
          >
            {assignee ? (
              <>
                <span className="grid size-5 place-items-center rounded-full bg-primary-soft text-[9px] font-semibold text-primary-ink">
                  {initials(assignee.name)}
                </span>
                <span className="text-xs text-ink-soft">{assignee.name}</span>
              </>
            ) : (
              <>
                <UsersIcon className="size-4 text-ink-faint" />
                <span className="text-xs text-ink-faint">Unassigned</span>
              </>
            )}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 border-t border-rule pt-2">
          {canMove ? (
            <StatusMenuMove
              task={task}
              statuses={statuses}
              onMoveStatus={onMoveStatus}
            />
          ) : (
            <span className="text-xs text-ink-faint">{currentStatus?.name ?? task.statusName}</span>
          )}
          {canDelete ? (
            <DeleteTaskButton task={task} onDelete={onDeleteTask} />
          ) : (
            <span className="h-7" />
          )}
        </div>
      </div>
    </li>
  );
}

/* ------------------------------ Column ------------------------------ */

function ColumnDroppable({
  id,
  status,
  statuses,
  tasks = [],
  members,
  workspaceId,
  projectId,
  commentsByTask,
  labelsByTask,
  worklogsByTask = {},
  actorRole,
  actorUserId,
  onOpenDetail,
  onMoveStatus,
  onDeleteTask,
}: {
  id: string;
  status: StatusRecord;
  statuses: StatusRecord[];
  tasks?: TaskRecord[];
  members: MemberWithUser[];
  workspaceId: string;
  projectId: string;
  commentsByTask: Record<string, CommentRecord[]>;
  labelsByTask: Record<string, LabelRecord[]>;
  worklogsByTask?: Record<string, WorklogRecord[]>;
  actorRole: Role;
  actorUserId: string;
  onOpenDetail: (task: TaskRecord) => void;
  onMoveStatus: (taskId: string, statusId: string) => void;
  onDeleteTask: (taskId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const canDelete = canDeleteTask(actorRole);

  function focusCreateTask() {
    document.getElementById("create-task-title")?.focus();
  }

  return (
    <section
      ref={setNodeRef}
      aria-label={status.name}
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-rule/40 p-2 transition-colors min-w-[260px]",
        isOver ? "border-primary bg-primary-soft/40" : "border-transparent",
      )}
    >
      <h3 className="flex items-center gap-2 px-1 pt-0.5">
        <span
          aria-hidden
          className={cn("size-2.5 rounded-full", getStatusDotClass(status.name))}
        />
        <span className="text-xs font-semibold uppercase tracking-wide text-ink truncate">
          {status.name}
        </span>
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-rule px-1.5 py-0.5 text-[11px] font-medium text-ink-soft">
          {tasks.length}
        </span>
        <button
          type="button"
          aria-label={`Add task to ${status.name}`}
          onClick={focusCreateTask}
          className="ml-auto grid size-6 place-items-center rounded-md text-ink-faint transition-colors hover:bg-panel hover:text-ink"
        >
          <PlusIcon className="size-4" />
        </button>
      </h3>

      {tasks.length === 0 ? (
        <p className="px-1 py-5 text-center text-xs text-ink-faint">No tasks.</p>
      ) : (
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex flex-col gap-2">
            {tasks.map((t) => {
              const canMove = canEditTaskField("status" as TaskField, {
                role: actorRole,
                isCreator: t.creatorId === actorUserId,
                isAssignee: t.assigneeId === actorUserId,
              });
              const canEditTitle = canEditTaskField("title" as TaskField, {
                role: actorRole,
                isCreator: t.creatorId === actorUserId,
                isAssignee: t.assigneeId === actorUserId,
              });
              return (
                <SortableTaskCard
                  key={t.id}
                  task={t}
                  statuses={statuses}
                  members={members}
                  workspaceId={workspaceId}
                  projectId={projectId}
                  commentsCount={commentsByTask[t.id]?.length ?? 0}
                  labels={labelsByTask[t.id] ?? []}
                  worklogs={worklogsByTask[t.id] ?? []}
                  canMove={canMove}
                  canEditTitle={canEditTitle}
                  canDelete={canDelete}
                  onOpenDetail={() => onOpenDetail(t)}
                  onMoveStatus={onMoveStatus}
                  onDeleteTask={onDeleteTask}
                />
              );
            })}
          </ul>
        </SortableContext>
      )}
    </section>
  );
}

/* ------------------------------ Board ------------------------------ */

export function KanbanBoard({
  tasks = [],
  statuses = [],
  sprints = [],
  members,
  workspaceId,
  projectId,
  commentsByTask = {},
  activitiesByTask = {},
  attachmentsByTask = {},
  labelsByTask = {},
  projectLabels = [],
  customFields = [],
  customFieldValuesByTask = {},
  worklogsByTask = {},
  activeFilters = {},
  sprintTotals,
  sprintDoneTotals,
  activeSprintId,
  actorRole,
  actorUserId,
}: {
  tasks: TaskRecord[];
  statuses?: StatusRecord[];
  sprints?: SprintRecord[];
  members: MemberWithUser[];
  workspaceId: string;
  projectId: string;
  commentsByTask?: Record<string, CommentRecord[]>;
  activitiesByTask?: Record<string, ActivityRecord[]>;
  attachmentsByTask?: Record<string, AttachmentRecord[]>;
  labelsByTask?: Record<string, LabelRecord[]>;
  projectLabels?: LabelRecord[];
  customFields?: CustomFieldRecord[];
  customFieldValuesByTask?: Record<string, TaskCustomFieldValueRecord[]>;
  worklogsByTask?: Record<string, WorklogRecord[]>;
  activeFilters?: TaskFilterInput;
  sprintTotals?: Record<string, number>;
  sprintDoneTotals?: Record<string, number>;
  activeSprintId?: string | null;
  actorRole: Role;
  actorUserId: string;
}) {
  const router = useRouter();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [items, setItems] = useState<Record<string, TaskRecord[]>>(() => groupByStatus(tasks, statuses));

  const [prevTasks, setPrevTasks] = useState(tasks);
  const [prevStatuses, setPrevStatuses] = useState(statuses);
  const isDraggingRef = useRef(false);
  const isMutatingRef = useRef(false);
  const dragStartContainerRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!isMutatingRef.current && !isDraggingRef.current) {
    if (prevTasks !== tasks || prevStatuses !== statuses) {
      setPrevTasks(tasks);
      setPrevStatuses(statuses);
      setItems(groupByStatus(tasks, statuses));
    }
  }

  const allTasksList = useMemo(() => {
    return (statuses ?? []).flatMap((s) => items[s.id] ?? []);
  }, [statuses, items]);

  const selectedTask = allTasksList.find((t) => t.id === selectedTaskId) ?? null;

  async function handleCreateTask(formData: FormData): Promise<{ error?: string }> {
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return { error: "Title is required." };

    const requestedStatusId = String(formData.get("statusId") ?? "");
    const fallbackStatus = statuses.find((s) => s.isDefault) ?? statuses[0];
    const status = statuses.find((s) => s.id === requestedStatusId) ?? fallbackStatus;
    if (!status) return { error: "Status is required." };

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const dueDateValue = String(formData.get("dueDate") ?? "");
    const assigneeId = String(formData.get("assigneeId") ?? "") || null;
    const priority = String(formData.get("priority") || "Medium") as TaskRecord["priority"];
    const currentList = items[status.id] ?? [];
    const lastPosition = currentList.at(-1)?.position ?? 0;
    const optimisticTask: TaskRecord = {
      id: tempId,
      projectId,
      workspaceId,
      creatorId: actorUserId,
      assigneeId,
      title,
      description: String(formData.get("description") ?? "").trim() || null,
      statusId: status.id,
      statusName: status.name,
      sprintId: activeSprintId ?? null,
      priority,
      dueDate: dueDateValue ? new Date(dueDateValue) : null,
      position: lastPosition + 1,
      parentId: null,
      subtaskCount: 0,
      subtaskDoneCount: 0,
      subtasks: [],
      originalEstimateMinutes: null,
    };

    setBoardError(null);
    setItems((prev) => ({
      ...prev,
      [status.id]: [...(prev[status.id] ?? []), optimisticTask],
    }));

    isMutatingRef.current = true;
    try {
      const res = await createTaskAction(workspaceId, projectId, formData);
      if (res?.error || !res?.task) {
        setItems((prev) => ({
          ...prev,
          [status.id]: (prev[status.id] ?? []).filter((t) => t.id !== tempId),
        }));
        const error = res?.error ?? "Task could not be created.";
        setBoardError(error);
        return { error };
      }

      const createdTask = res.task;
      setItems((prev) => {
        const next: Record<string, TaskRecord[]> = {};
        for (const [key, list] of Object.entries(prev)) {
          next[key] = list.filter((t) => t.id !== tempId);
        }
        next[createdTask.statusId] = [...(next[createdTask.statusId] ?? []), createdTask].sort(
          (left, right) => left.position - right.position,
        );
        return next;
      });
      return {};
    } catch {
      setItems((prev) => ({
        ...prev,
        [status.id]: (prev[status.id] ?? []).filter((t) => t.id !== tempId),
      }));
      const error = "Task could not be created.";
      setBoardError(error);
      return { error };
    } finally {
      isMutatingRef.current = false;
    }
  }

  async function handleMoveStatus(taskId: string, targetStatusId: string) {
    const sourceStatusId = findContainer(taskId);
    if (!sourceStatusId || sourceStatusId === targetStatusId) return;

    const targetStatus = statuses.find((s) => s.id === targetStatusId);

    // Instant optimistic update (0ms UI transition)
    setItems((prev) => {
      const sourceList = [...(prev[sourceStatusId] ?? [])];
      const targetList = [...(prev[targetStatusId] ?? [])];
      const idx = sourceList.findIndex((t) => t.id === taskId);
      if (idx < 0) return prev;
      const [taskToMove] = sourceList.splice(idx, 1);
      const updatedTask: TaskRecord = {
        ...taskToMove,
        statusId: targetStatusId,
        statusName: targetStatus?.name ?? taskToMove.statusName,
      };
      targetList.push(updatedTask);
      return {
        ...prev,
        [sourceStatusId]: sourceList,
        [targetStatusId]: targetList,
      };
    });

    isMutatingRef.current = true;
    try {
      const res = await moveTaskAction(workspaceId, projectId, taskId, targetStatusId);
      if (res?.error) {
        setItems(groupByStatus(tasks, statuses));
      }
    } catch {
      setItems(groupByStatus(tasks, statuses));
    } finally {
      isMutatingRef.current = false;
    }
  }

  async function handleDeleteTask(taskId: string) {
    const containerId = findContainer(taskId);
    if (!containerId) return;
    setBoardError(null);

    // Instant optimistic deletion (0ms UI removal)
    setItems((prev) => {
      const list = (prev[containerId] ?? []).filter((t) => t.id !== taskId);
      return {
        ...prev,
        [containerId]: list,
      };
    });

    if (selectedTaskId === taskId) {
      setSelectedTaskId(null);
    }

    isMutatingRef.current = true;
    try {
      const res = await deleteTaskAction(workspaceId, projectId, taskId);
      if (res?.error) {
        setItems(groupByStatus(tasks, statuses));
        setBoardError(res.error);
      } else {
        setItems((prev) => ({
          ...prev,
          [containerId]: (prev[containerId] ?? []).filter((task) => task.id !== taskId),
        }));
      }
    } catch {
      setItems(groupByStatus(tasks, statuses));
      setBoardError("Task could not be deleted.");
    } finally {
      isMutatingRef.current = false;
    }
  }

  function clearPendingRefresh() {
    if (refreshTimerRef.current !== null) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }

  useLiveEvents(workspaceId, (event) => {
    if (event.kind !== "board" || (event.projectId && event.projectId !== projectId)) return;
    if (isDraggingRef.current || isMutatingRef.current) return;
    if (refreshTimerRef.current !== null) return;
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        "mini-jira:last-board-event",
        JSON.stringify({ projectId: event.projectId ?? null, ts: Date.now() }),
      );
    }
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      router.refresh();
    }, 50);
  });

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "c" || e.key === "C") {
        if (!selectedTask && !isCreateOpen) {
          e.preventDefault();
          setIsCreateOpen(true);
        }
      } else if (e.key === "j" || e.key === "J") {
        if (selectedTask) {
          e.preventDefault();
          const idx = allTasksList.findIndex((t) => t.id === selectedTask.id);
          if (idx >= 0 && idx < allTasksList.length - 1) {
            setSelectedTaskId(allTasksList[idx + 1].id);
          }
        }
      } else if (e.key === "k" || e.key === "K") {
        if (selectedTask && !(e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          const idx = allTasksList.findIndex((t) => t.id === selectedTask.id);
          if (idx > 0) {
            setSelectedTaskId(allTasksList[idx - 1].id);
          }
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTask, allTasksList, isCreateOpen]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function findContainer(id: string): string | null {
    if (id in items) return id;
    const found = Object.keys(items).find((key) =>
      items[key]?.some((t) => t.id === id),
    );
    return found ?? null;
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    if (String(over.id).startsWith("sprint-target:")) return;
    const activeContainer = findContainer(String(active.id));
    const overContainer = findContainer(String(over.id));
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    setItems((prev) => {
      const activeItems = [...(prev[activeContainer] ?? [])];
      const overItems = [...(prev[overContainer] ?? [])];
      const activeIndex = activeItems.findIndex((t) => t.id === active.id);
      if (activeIndex < 0) return prev;
      const [moved] = activeItems.splice(activeIndex, 1);
      const targetStatus = statuses.find((s) => s.id === overContainer);
      const updatedMoved: TaskRecord = {
        ...moved,
        statusId: overContainer,
        statusName: targetStatus?.name ?? moved.statusName,
      };
      const overIndex = overItems.findIndex((t) => t.id === over.id);
      overItems.splice(overIndex >= 0 ? overIndex : overItems.length, 0, updatedMoved);
      return {
        ...prev,
        [activeContainer]: activeItems,
        [overContainer]: overItems,
      };
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const sourceContainer = dragStartContainerRef.current;
    dragStartContainerRef.current = null;
    isDraggingRef.current = false;

    if (!over) {
      if (sourceContainer) {
        setItems(groupByStatus(tasks, statuses));
      }
      return;
    }

    if (String(over.id).startsWith("sprint-target:")) {
      const targetSprint = String(over.id).replace("sprint-target:", "");
      if (targetSprint !== "all") {
        const sprintValue = targetSprint === "backlog" ? "" : targetSprint;
        isMutatingRef.current = true;
        try {
          await updateTaskFieldAction(
            workspaceId,
            projectId,
            String(active.id),
            "sprintId",
            sprintValue,
          );
        } finally {
          isMutatingRef.current = false;
          router.refresh();
        }
      }
      return;
    }

    const activeTaskId = String(active.id);
    const targetContainer = findContainer(activeTaskId);
    if (!targetContainer) return;

    const currentList = items[targetContainer] ?? [];
    let targetIndex = currentList.findIndex((t) => t.id === activeTaskId);

    // If dropped directly onto another task card within the target container, reorder
    if (over.id !== active.id) {
      const overIndex = currentList.findIndex((t) => t.id === over.id);
      if (overIndex >= 0 && targetIndex >= 0 && targetIndex !== overIndex) {
        setItems((prev) => ({
          ...prev,
          [targetContainer]: arrayMove(prev[targetContainer] ?? [], targetIndex, overIndex),
        }));
        targetIndex = overIndex;
      }
    }

    if (targetIndex < 0) {
      targetIndex = currentList.length;
    }

    isMutatingRef.current = true;
    try {
      const res = await moveTaskToIndexAction(
        workspaceId,
        projectId,
        activeTaskId,
        targetContainer,
        targetIndex,
      );
      if (res?.error) {
        setItems(groupByStatus(tasks, statuses));
      }
    } catch {
      setItems(groupByStatus(tasks, statuses));
    } finally {
      isMutatingRef.current = false;
    }
  }

  const hasActiveFilters = Boolean(
    activeFilters.query || activeFilters.statusId || activeFilters.priority || activeFilters.assigneeId || activeFilters.labelId,
  );

  return (
    <DndContext
      id="kanban-board-dnd"
      sensors={sensors}
      onDragStart={(event) => {
        dragStartContainerRef.current = findContainer(String(event.active.id));
        isDraggingRef.current = true;
        clearPendingRefresh();
      }}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        dragStartContainerRef.current = null;
        isDraggingRef.current = false;
        clearPendingRefresh();
        setItems(groupByStatus(tasks, statuses));
      }}
    >
      <div className="space-y-4">
        {sprints && sprints.length > 0 && sprintTotals && sprintDoneTotals ? (
          <SprintSwitcher
            sprints={sprints}
            totals={sprintTotals}
            doneTotals={sprintDoneTotals}
            activeSprintId={activeSprintId ?? null}
          />
        ) : null}

        {/* Top Action Bar with Filters on Left and Create Task Button on Top Right */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <TaskFilterToolbar
              statuses={statuses}
              members={members}
              projectLabels={projectLabels}
              activeFilters={activeFilters}
            />
          </div>
          <Button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="shrink-0 bg-primary text-white shadow-xs hover:bg-primary-ink transition-colors"
          >
            <PlusIcon className="size-4" />
            Create task
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-ink-faint">
          <div className="flex flex-wrap items-center gap-3">
            <span>Shortcuts:</span>
            <span><kbd className="rounded border border-rule bg-panel px-1 font-mono text-[10px]">C</kbd> new task</span>
            <span><kbd className="rounded border border-rule bg-panel px-1 font-mono text-[10px]">J</kbd>/<kbd className="rounded border border-rule bg-panel px-1 font-mono text-[10px]">K</kbd> navigate task</span>
            <span><kbd className="rounded border border-rule bg-panel px-1 font-mono text-[10px]">Esc</kbd> close drawer</span>
            <span><kbd className="rounded border border-rule bg-panel px-1 font-mono text-[10px]">⌘K</kbd> quick jump</span>
          </div>
        </div>

        {boardError ? (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
            {boardError}
          </p>
        ) : null}

        {tasks.length === 0 && hasActiveFilters ? (
          <div className="rounded-md border border-dashed border-rule-strong bg-panel/60 px-6 py-10 text-center">
            <p className="text-sm font-medium text-ink">No tasks match your filters.</p>
            <p className="mt-1 text-xs text-ink-soft">
              Try searching for a different keyword or resetting filters.
            </p>
          </div>
        ) : (
          <div
            className="grid items-start gap-3 overflow-x-auto pb-4"
            style={{
              gridTemplateColumns: `repeat(${Math.max(statuses.length, 1)}, minmax(280px, 1fr))`,
            }}
          >
            {statuses.map((status) => (
              <ColumnDroppable
                key={status.id}
                id={status.id}
                status={status}
                statuses={statuses}
                tasks={items[status.id] ?? []}
                members={members}
                workspaceId={workspaceId}
                projectId={projectId}
                commentsByTask={commentsByTask}
                labelsByTask={labelsByTask}
                worklogsByTask={worklogsByTask}
                actorRole={actorRole}
                actorUserId={actorUserId}
                onOpenDetail={(task) => setSelectedTaskId(task.id)}
                onMoveStatus={handleMoveStatus}
                onDeleteTask={handleDeleteTask}
              />
            ))}
          </div>
        )}

      {selectedTask ? (
        <TaskDetailModal
          task={selectedTask}
          workspaceId={workspaceId}
          projectId={projectId}
          statuses={statuses}
          sprints={sprints}
          members={members}
          comments={commentsByTask[selectedTask.id] ?? []}
          activities={activitiesByTask[selectedTask.id] ?? []}
          attachments={attachmentsByTask[selectedTask.id] ?? []}
          labels={labelsByTask[selectedTask.id] ?? []}
          projectLabels={projectLabels}
          customFields={customFields}
          customFieldValues={customFieldValuesByTask[selectedTask.id] ?? []}
          worklogs={worklogsByTask[selectedTask.id] ?? []}
          actorRole={actorRole}
          actorUserId={actorUserId}
          onClose={() => setSelectedTaskId(null)}
          onStatusChange={(newStatusId) => handleMoveStatus(selectedTask.id, newStatusId)}
        />
      ) : null}

        <CreateTaskModal
          open={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          statuses={statuses}
          members={members}
          actorRole={actorRole}
          onCreateTask={handleCreateTask}
        />
      </div>
    </DndContext>
  );
}
