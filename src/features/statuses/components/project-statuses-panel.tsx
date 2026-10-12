"use client";

import { useActionState, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/inputs";
import { TrashIcon } from "@/components/ui/icons";
import { canManageStatuses, type Role } from "@/features/authorization/permissions";
import {
  deleteStatusAction,
  reorderStatusesAction,
  updateStatusAction,
} from "@/features/statuses/actions";
import { CreateStatusButton } from "@/features/statuses/components/create-status-modal";
import type { StatusRecord } from "@/features/statuses/status-service";
import { getStatusDotClass } from "@/features/tasks/task-meta";
import { cn } from "@/lib/cn";
import { notifyDeleted, notifyError, notifyUpdated } from "@/lib/notify";

function StatusRow({
  status,
  statuses,
  index,
  workspaceId,
  projectId,
  canManage,
}: {
  status: StatusRecord;
  statuses: StatusRecord[];
  index: number;
  workspaceId: string;
  projectId: string;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [editError, setEditError] = useState<string | undefined>();

  const [deleteState, doDeleteAction, deletePending] = useActionState(
    async (_prev: { error?: string }) => {
      const res = await deleteStatusAction(workspaceId, projectId, status.id);
      if (res?.error) {
        notifyError(res.error);
      } else {
        notifyDeleted("status");
      }
      return res;
    },
    {},
  );

  const [doneState, doDoneAction, donePending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      const res = await updateStatusAction(workspaceId, projectId, status.id, formData);
      if (res?.error) {
        notifyError(res.error);
      } else {
        notifyUpdated("status");
      }
      return res;
    },
    {},
  );

  function handleMove(direction: "up" | "down") {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= statuses.length) return;

    const newOrder = [...statuses];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIdx, 0, moved);

    startTransition(async () => {
      const res = await reorderStatusesAction(
        workspaceId,
        projectId,
        newOrder.map((s) => s.id),
      );
      if (res?.error) notifyError(res.error);
    });
  }

  async function handleSaveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEditError(undefined);
    const formData = new FormData(e.currentTarget);
    const res = await updateStatusAction(workspaceId, projectId, status.id, formData);
    if (res.error) {
      setEditError(res.error);
      notifyError(res.error);
    } else {
      notifyUpdated("status");
      setEditing(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <span
        aria-hidden
        className={cn("size-2.5 shrink-0 rounded-full", getStatusDotClass(status.name))}
      />

      <div className="min-w-0 flex-1">
        {editing ? (
          <form onSubmit={handleSaveEdit} className="flex items-center gap-2">
            <Input
              name="name"
              defaultValue={status.name}
              required
              maxLength={50}
              aria-label={`Edit name for ${status.name}`}
              className="h-8 text-xs"
            />
            <Button type="submit" size="sm">
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false);
                setEditError(undefined);
              }}
            >
              Cancel
            </Button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ink">{status.name}</span>
            {status.isDefault ? (
              <span className="rounded bg-primary-soft px-1.5 py-0.5 text-[10px] font-medium text-primary-ink">
                Default
              </span>
            ) : null}
            {status.isDone ? (
              <span className="rounded bg-done-soft px-1.5 py-0.5 text-[10px] font-medium text-done">
                Done
              </span>
            ) : null}
          </div>
        )}
      </div>

      {canManage && !editing && (
        <form action={doDoneAction} className="flex shrink-0 items-center gap-1.5">
          <input type="hidden" name="isDone" value={String(!status.isDone)} />
          <button
            type="submit"
            disabled={donePending}
            aria-label={
              status.isDone
                ? `Mark ${status.name} as not done`
                : `Mark ${status.name} as done`
            }
            className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-ink-soft"
          >
            <input
              type="checkbox"
              checked={status.isDone}
              readOnly
              tabIndex={-1}
              className="pointer-events-none accent-primary"
            />
            Done
          </button>
        </form>
      )}
      {doneState.error ? (
        <p role="alert" className="w-full text-xs text-danger">
          {doneState.error}
        </p>
      ) : null}

      {canManage && !editing && (
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={index === 0 || isPending}
            onClick={() => handleMove("up")}
            aria-label={`Move ${status.name} up`}
            className="h-7 px-2 text-xs"
          >
            ↑
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={index === statuses.length - 1 || isPending}
            onClick={() => handleMove("down")}
            aria-label={`Move ${status.name} down`}
            className="h-7 px-2 text-xs"
          >
            ↓
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditing(true)}
            className="h-7 px-2 text-xs"
          >
            Edit
          </Button>

          {!deleting ? (
            <button
              type="button"
              onClick={() => setDeleting(true)}
              aria-label={`Delete status ${status.name}`}
              disabled={statuses.length <= 1}
              className="grid size-7 place-items-center rounded-md text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-30"
              title="Delete status"
            >
              <TrashIcon className="size-3.5" />
            </button>
          ) : (
            <form action={doDeleteAction} className="flex items-center gap-1">
              <span className="text-xs text-danger">Delete?</span>
              <Button type="submit" variant="danger" size="sm" disabled={deletePending} className="h-7 px-2 text-xs">
                Yes
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDeleting(false)}
                className="h-7 px-2 text-xs"
              >
                Cancel
              </Button>
            </form>
          )}
        </div>
      )}

      {editError ? (
        <p role="alert" className="w-full text-xs text-danger">
          {editError}
        </p>
      ) : null}
      {deleteState.error ? (
        <p role="alert" className="w-full text-xs text-danger">
          {deleteState.error}
        </p>
      ) : null}
    </li>
  );
}

export function ProjectStatusesPanel({
  workspaceId,
  projectId,
  statuses,
  actorProjectRole,
}: {
  workspaceId: string;
  projectId: string;
  statuses: StatusRecord[];
  actorProjectRole: Role;
}) {
  const canManage = canManageStatuses(actorProjectRole);

  return (
    <section aria-labelledby="project-statuses-heading" className="rounded-md border border-rule bg-panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="project-statuses-heading" className="text-lg font-semibold tracking-tight text-ink">
            Statuses (Kanban Columns)
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Customize the workflow states and column order for this project&apos;s board.
          </p>
        </div>

        {canManage && (
          <CreateStatusButton workspaceId={workspaceId} projectId={projectId} />
        )}
      </div>

      {statuses.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft italic">No statuses yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-rule" aria-label="Project statuses">
          {statuses.map((s, index) => (
            <StatusRow
              key={s.id}
              status={s}
              statuses={statuses}
              index={index}
              workspaceId={workspaceId}
              projectId={projectId}
              canManage={canManage}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
