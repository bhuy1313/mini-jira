"use client";

import { useActionState, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/inputs";
import { TrashIcon } from "@/components/ui/icons";
import { canManageSprints, type Role } from "@/features/authorization/permissions";
import {
  deleteSprintAction,
  reorderSprintsAction,
  updateSprintAction,
} from "@/features/sprints/actions";
import type { SprintRecord } from "@/features/sprints/sprint-service";
import { formatDate } from "@/lib/dates";
import { withActionRetry } from "@/lib/action-retry";
import { withMutation } from "@/lib/mutation-busy";

function formatSprintDate(d: Date | null): string {
  if (!d) return "";
  return formatDate(d);
}

function SprintRow({
  sprint,
  sprints,
  index,
  workspaceId,
  projectId,
  canManage,
}: {
  sprint: SprintRecord;
  sprints: SprintRecord[];
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
    (_prev: { error?: string }) =>
      // Sprint deletes are non-idempotent: gate refreshes, never retry.
      withMutation(() => deleteSprintAction(workspaceId, projectId, sprint.id)),
    {},
  );

  function handleMove(direction: "up" | "down") {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= sprints.length) return;

    const newOrder = [...sprints];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIdx, 0, moved);

    startTransition(async () => {
      // Reorder is idempotent (same final order) — safe to retry on abort.
      await withActionRetry(() =>
        reorderSprintsAction(
          workspaceId,
          projectId,
          newOrder.map((s) => s.id),
        ),
      );
    });
  }

  async function handleSaveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEditError(undefined);
    const formData = new FormData(e.currentTarget);
    // Sprint field updates are idempotent sets — safe to retry on abort.
    const res = await withActionRetry(() =>
      updateSprintAction(workspaceId, projectId, sprint.id, formData),
    );
    if (res.error) {
      setEditError(res.error);
    } else {
      setEditing(false);
    }
  }

  const rangeText =
    sprint.startDate || sprint.endDate
      ? `${formatSprintDate(sprint.startDate)} — ${formatSprintDate(sprint.endDate)}`
      : null;

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        {editing ? (
          <form onSubmit={handleSaveEdit} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                name="name"
                defaultValue={sprint.name}
                required
                maxLength={100}
                aria-label="Sprint name"
                className="h-8 w-56 text-xs"
              />
              <Input
                name="startDate"
                type="date"
                defaultValue={sprint.startDate ? sprint.startDate.toISOString().slice(0, 10) : ""}
                aria-label="Start date"
                className="h-8 w-40 text-xs"
              />
              <Input
                name="endDate"
                type="date"
                defaultValue={sprint.endDate ? sprint.endDate.toISOString().slice(0, 10) : ""}
                aria-label="End date"
                className="h-8 w-40 text-xs"
              />
            </div>
            <Input
              name="goal"
              defaultValue={sprint.goal ?? ""}
              maxLength={500}
              placeholder="Sprint goal (optional)"
              aria-label="Sprint goal"
              className="h-8 text-xs"
            />
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" className="h-8">
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => {
                  setEditing(false);
                  setEditError(undefined);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-ink">{sprint.name}</span>
              {rangeText ? (
                <span className="text-xs text-ink-faint">{rangeText}</span>
              ) : null}
            </div>
            {sprint.goal ? (
              <p className="mt-0.5 text-xs text-ink-soft">{sprint.goal}</p>
            ) : null}
          </div>
        )}
      </div>

      {canManage && !editing && (
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={index === 0 || isPending}
            onClick={() => handleMove("up")}
            aria-label={`Move ${sprint.name} up`}
            className="h-7 px-2 text-xs"
          >
            ↑
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={index === sprints.length - 1 || isPending}
            onClick={() => handleMove("down")}
            aria-label={`Move ${sprint.name} down`}
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
              aria-label={`Delete sprint ${sprint.name}`}
              className="grid size-7 place-items-center rounded-md text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-30"
              title="Delete sprint"
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


import { CreateSprintButton } from "@/features/sprints/components/create-sprint-modal";

export function ProjectSprintsPanel({
  workspaceId,
  projectId,
  sprints,
  actorProjectRole,
}: {
  workspaceId: string;
  projectId: string;
  sprints: SprintRecord[];
  actorProjectRole: Role;
}) {
  const canManage = canManageSprints(actorProjectRole);

  return (
    <section aria-labelledby="project-sprints-heading" className="rounded-md border border-rule bg-panel p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-rule pb-4">
        <div>
          <h2 id="project-sprints-heading" className="text-lg font-semibold tracking-tight">Sprints</h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            Plan iterations, assign tasks to sprints from the board, and track progress.
          </p>
        </div>
        {canManage && (
          <div className="shrink-0">
            <CreateSprintButton workspaceId={workspaceId} projectId={projectId} />
          </div>
        )}
      </div>

      {sprints.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft italic">No sprints yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-rule" aria-label="Project sprints">
          {sprints.map((s, index) => (
            <SprintRow
              key={s.id}
              sprint={s}
              sprints={sprints}
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