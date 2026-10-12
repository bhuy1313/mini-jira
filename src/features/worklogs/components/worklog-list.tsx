"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDuration, formatDurationDetailed } from "../duration";
import type { WorklogRecord } from "../worklog-service";
import { deleteWorklogAction } from "../actions";
import { EditWorklogModal } from "./edit-worklog-modal";
import { canDeleteWorklog, canEditWorklog, type Role } from "@/features/authorization/permissions";
import { ClockIcon, EditIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { notifyDeleted, notifyError } from "@/lib/notify";
import { formatDateTime } from "@/lib/dates";
import { withMutation } from "@/lib/mutation-busy";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface WorklogListProps {
  taskId: string;
  taskTitle: string;
  workspaceId: string;
  projectId: string;
  worklogs: WorklogRecord[];
  actorRole: Role;
  actorUserId: string;
  onOpenLogModal: () => void;
}

export function WorklogList({
  taskId,
  taskTitle,
  workspaceId,
  projectId,
  worklogs,
  actorRole,
  actorUserId,
  onOpenLogModal,
}: WorklogListProps) {
  const router = useRouter();
  const [editingWorklog, setEditingWorklog] = useState<WorklogRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalSpentMinutes = worklogs.reduce((sum, w) => sum + w.timeSpentMinutes, 0);

  const handleDelete = (worklogId: string) => {
    if (!window.confirm("Are you sure you want to delete this worklog entry?")) {
      return;
    }
    setDeletingId(worklogId);
    startTransition(async () => {
      const res = await withMutation(() => deleteWorklogAction(workspaceId, projectId, worklogId));
      setDeletingId(null);
      if (res?.error) {
        notifyError(res.error);
      } else {
        notifyDeleted("worklog");
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {/* Top action row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-faint">
            Total logged:{" "}
            <strong className="text-ink font-semibold">
              {formatDuration(totalSpentMinutes)}
            </strong>
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenLogModal}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-deep transition-colors"
        >
          <PlusIcon className="size-3.5" />
          <span>Log work</span>
        </button>
      </div>

      {/* Worklogs List */}
      {worklogs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-rule p-8 text-center">
          <ClockIcon className="mx-auto size-8 text-ink-faint mb-2" />
          <h3 className="text-sm font-medium text-ink">No work logged yet</h3>
          <p className="mt-1 text-xs text-ink-soft">
            Keep track of time spent working on this task.
          </p>
          <button
            type="button"
            onClick={onOpenLogModal}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-rule px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper transition-colors"
          >
            <PlusIcon className="size-3.5 text-primary" />
            <span>Log work now</span>
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-rule rounded-lg border border-rule bg-panel">
          {worklogs.map((worklog) => {
            const isAuthor = worklog.authorId === actorUserId;
            const canEdit = canEditWorklog(actorRole, isAuthor);
            const canDelete = canDeleteWorklog(actorRole, isAuthor);
            const authorName = worklog.author?.name ?? "Unknown";

            const formattedDate = formatDateTime(worklog.startedAt);

            return (
              <li
                key={worklog.id}
                className="group flex flex-col gap-2 p-3.5 transition-colors hover:bg-paper/40"
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Author & Date info */}
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-7 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary-ink">
                      {initials(authorName)}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-ink">
                          {authorName}
                        </span>
                        {isAuthor && (
                          <span className="rounded bg-rule px-1 py-0.2 text-[10px] font-medium text-ink-faint">
                            You
                          </span>
                        )}
                      </div>
                      <time className="text-[11px] text-ink-faint">{formattedDate}</time>
                    </div>
                  </div>

                  {/* Right: Spent badge & Actions */}
                  <div className="flex items-center gap-2">
                    <span
                      title={formatDurationDetailed(worklog.timeSpentMinutes)}
                      className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary-deep"
                    >
                      <ClockIcon className="size-3" />
                      {formatDuration(worklog.timeSpentMinutes)}
                    </span>

                    {(canEdit || canDelete) && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => setEditingWorklog(worklog)}
                            aria-label="Edit worklog"
                            className="rounded p-1 text-ink-faint hover:bg-paper hover:text-ink transition-colors"
                            title="Edit worklog"
                          >
                            <EditIcon className="size-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDelete(worklog.id)}
                            disabled={isPending && deletingId === worklog.id}
                            aria-label="Delete worklog"
                            className="rounded p-1 text-ink-faint hover:bg-danger-soft hover:text-danger transition-colors disabled:opacity-50"
                            title="Delete worklog"
                          >
                            {isPending && deletingId === worklog.id ? (
                              <Spinner className="size-3.5" />
                            ) : (
                              <TrashIcon className="size-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Description Note */}
                {worklog.description && (
                  <p className="mt-0.5 text-xs text-ink-soft whitespace-pre-wrap pl-9">
                    {worklog.description}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Edit Modal Dialog */}
      {editingWorklog && (
        <EditWorklogModal
          open={Boolean(editingWorklog)}
          onClose={() => setEditingWorklog(null)}
          workspaceId={workspaceId}
          projectId={projectId}
          worklog={editingWorklog}
        />
      )}
    </div>
  );
}
