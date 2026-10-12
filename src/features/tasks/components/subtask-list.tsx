"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { notifyCreated, notifyError, notifyUpdated } from "@/lib/notify";
import { createSubtaskAction, toggleSubtaskDoneAction, unlinkSubtaskAction } from "@/features/tasks/actions";
import { withMutation } from "@/lib/mutation-busy";
import { resolveRealTaskId, trackPendingTask } from "@/features/tasks/pending-task-ids";
import type { SubtaskSummary } from "@/features/tasks/task-service";
import type { MemberWithUser } from "@/features/workspaces/workspace-service";

interface SubtaskListProps {
  workspaceId: string;
  projectId: string;
  parentTaskId: string;
  subtasks: SubtaskSummary[];
  members: MemberWithUser[];
  canEdit: boolean;
  onOpenSubtask?: (subtaskId: string) => void;
}

export function SubtaskList({
  workspaceId,
  projectId,
  parentTaskId,
  subtasks: initialSubtasks,
  members,
  canEdit,
  onOpenSubtask,
}: SubtaskListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAssigneeId, setNewAssigneeId] = useState("");
  const [prevInitialSubtasks, setPrevInitialSubtasks] = useState(initialSubtasks);
  const [localSubtasks, setLocalSubtasks] = useState<SubtaskSummary[]>(initialSubtasks);
  const [error, setError] = useState<string | null>(null);

  if (prevInitialSubtasks !== initialSubtasks) {
    setPrevInitialSubtasks(initialSubtasks);
    setLocalSubtasks(initialSubtasks);
  }

  const total = localSubtasks.length;
  const doneCount = localSubtasks.filter((s) => s.isDone).length;
  const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  function handleToggleDone(subtaskId: string, currentDone: boolean) {
    if (!canEdit) return;
    setError(null);
    setLocalSubtasks((prev) =>
      prev.map((st) =>
        st.id === subtaskId
          ? { ...st, isDone: !currentDone, statusName: !currentDone ? "Done" : "To Do" }
          : st,
      ),
    );
    startTransition(async () => {
      // Await the real id when toggling a just-created (optimistic) subtask.
      const res = await withMutation(async () =>
        toggleSubtaskDoneAction(
          workspaceId,
          projectId,
          await resolveRealTaskId(subtaskId),
          !currentDone,
        ),
      );
      if (res.error) {
        setError(res.error);
        notifyError(res.error);
        setLocalSubtasks(initialSubtasks);
      } else {
        notifyUpdated("subtask");
        router.refresh();
      }
    });
  }

  function handleUnlink(subtaskId: string) {
    if (!canEdit) return;
    setError(null);
    setLocalSubtasks((prev) => prev.filter((st) => st.id !== subtaskId));
    startTransition(async () => {
      // Await the real id when unlinking a just-created (optimistic) subtask.
      const res = await withMutation(async () =>
        unlinkSubtaskAction(
          workspaceId,
          projectId,
          await resolveRealTaskId(subtaskId),
        ),
      );
      if (res.error) {
        setError(res.error);
        notifyError(res.error);
        setLocalSubtasks(initialSubtasks);
      } else {
        notifyUpdated("subtask");
        router.refresh();
      }
    });
  }

  async function handleCreateSubtask(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;

    setError(null);
    const tempId = `temp-${Date.now()}`;
    const optimisticSubtask: SubtaskSummary = {
      id: tempId,
      title,
      statusId: "",
      statusName: "To Do",
      isDone: false,
      priority: "Medium",
      assigneeId: newAssigneeId || null,
    };
    setLocalSubtasks((prev) => [...prev, optimisticSubtask]);
    setNewTitle("");
    setNewAssigneeId("");
    setIsAdding(false);

    let resolveCreate!: (id: string | null) => void;
    trackPendingTask(
      tempId,
      new Promise<string | null>((r) => {
        resolveCreate = r;
      }),
    );

    startTransition(async () => {
      const formData = new FormData();
      formData.set("title", title);
      if (newAssigneeId) {
        formData.set("assigneeId", newAssigneeId);
      }
      formData.set("priority", "Medium");

      const res = await withMutation(async () =>
        createSubtaskAction(
          workspaceId,
          projectId,
          await resolveRealTaskId(parentTaskId),
          formData,
        ),
      );

      if (res.error || !res.task) {
        resolveCreate(null);
        setError(res.error ?? "Sub-task could not be created.");
        notifyError(res.error);
        setLocalSubtasks(initialSubtasks);
      } else {
        resolveCreate(res.task.id);
        notifyCreated("subtask");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3 rounded-md border border-rule bg-panel p-3.5">
      {/* Header & Progress Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <svg
            className="size-4 text-ink-faint"
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
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Sub-tasks ({doneCount}/{total})
          </h3>
        </div>

        {canEdit && !isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            + Add sub-task
          </button>
        )}
      </div>

      {/* Progress track */}
      {total > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-ink-faint">
            <span>
              {doneCount} of {total} completed
            </span>
            <span className="font-semibold text-ink">{percent}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-rule">
            <div
              className={cn(
                "h-full transition-all duration-300",
                percent === 100
                  ? "bg-emerald-500"
                  : percent > 0
                    ? "bg-primary"
                    : "bg-transparent",
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Subtask list */}
      {localSubtasks.length > 0 ? (
        <div className="divide-y divide-rule rounded-md border border-rule bg-paper">
          {localSubtasks.map((st) => {
            const assignee = members.find((m) => m.userId === st.assigneeId);
            return (
              <div
                key={st.id}
                className={cn(
                  "group flex items-center justify-between gap-3 px-3 py-2 text-sm transition-colors hover:bg-panel/60",
                  st.isDone && "bg-paper/40",
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={st.isDone}
                    disabled={!canEdit || isPending}
                    onChange={() => handleToggleDone(st.id, st.isDone)}
                    aria-label={`Toggle subtask ${st.title}`}
                    className="size-4 cursor-pointer rounded border-rule text-primary focus:ring-primary disabled:cursor-not-allowed"
                  />

                  <span
                    onClick={() => onOpenSubtask?.(st.id)}
                    className={cn(
                      "min-w-0 flex-1 truncate font-medium text-ink transition-colors",
                      onOpenSubtask && "cursor-pointer hover:text-primary",
                      st.isDone && "text-ink-faint line-through",
                    )}
                  >
                    {st.title}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {/* Status chip */}
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-2xs font-medium",
                      st.isDone
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-rule text-ink-soft",
                    )}
                  >
                    {st.statusName || (st.isDone ? "Done" : "Todo")}
                  </span>

                  {/* Assignee */}
                  {assignee ? (
                    <span
                      title={`Assigned to ${assignee.name}`}
                      className="grid size-5 place-items-center rounded-full bg-primary-soft text-2xs font-bold text-primary-deep"
                    >
                      {assignee.name.slice(0, 1).toUpperCase()}
                    </span>
                  ) : null}

                  {/* Actions menu / Unlink button */}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleUnlink(st.id)}
                      title="Unlink from parent (convert to standalone task)"
                      aria-label="Unlink subtask"
                      className="opacity-0 transition-opacity group-hover:opacity-100 text-xs text-ink-faint hover:text-danger"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : !isAdding ? (
        <p className="text-xs text-ink-faint">No sub-tasks yet.</p>
      ) : null}

      {/* Add Subtask Form */}
      {isAdding && (
        <form onSubmit={handleCreateSubtask} className="space-y-2 pt-1">
          <div className="flex gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="What needs to be done? (Press Enter to add)"
              autoFocus
              className="w-full rounded-md border border-rule-strong bg-paper px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
            />
            {members.length > 0 && (
              <select
                value={newAssigneeId}
                onChange={(e) => setNewAssigneeId(e.target.value)}
                aria-label="Assignee"
                className="max-w-[130px] rounded-md border border-rule bg-paper px-2 py-1.5 text-xs text-ink focus:border-primary focus:outline-none"
              >
                <option value="">Assignee</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsAdding(false);
                setNewTitle("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isPending || !newTitle.trim()}
            >
              {isPending ? (
                <>
                  <Spinner className="mr-1.5 size-3" /> Adding…
                </>
              ) : (
                "Add Sub-task"
              )}
            </Button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
