"use client";

import { useActionState, useState, useRef, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { CalendarIcon, CloseIcon, PlusIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { createSprintAction } from "@/features/sprints/actions";
import { withMutation } from "@/lib/mutation-busy";
import { notifyCreated, notifyError } from "@/lib/notify";

export function CreateSprintModal({
  open,
  onClose,
  workspaceId,
  projectId,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  projectId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      // Sprint creates are non-idempotent: gate refreshes, never retry.
      const res = await withMutation(() =>
        createSprintAction(workspaceId, projectId, formData),
      );
      if (!res?.error) {
        notifyCreated("sprint");
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
      labelledBy="create-sprint-heading"
      panelClassName="max-w-lg p-0 overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-rule bg-paper/50 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="grid size-6 place-items-center rounded-md bg-primary text-white">
            <CalendarIcon className="size-3.5" />
          </div>
          <h2 id="create-sprint-heading" className="text-sm font-semibold text-ink">
            Add Sprint
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="rounded p-1 text-ink-faint transition-colors hover:bg-paper hover:text-ink"
        >
          <CloseIcon className="size-4" />
        </button>
      </div>

      <form action={formAction} className="flex flex-col gap-4 p-5">
        <div>
          <label htmlFor="sprint-name-input" className="block text-xs font-medium text-ink mb-1.5">
            Sprint Name <span className="text-danger">*</span>
          </label>
          <input
            ref={inputRef}
            id="sprint-name-input"
            name="name"
            required
            maxLength={100}
            placeholder="e.g., Sprint 1, Q4 Release"
            aria-label="Sprint name"
            className="w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-faint transition-colors hover:border-rule-strong focus:border-primary focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label htmlFor="sprint-start-date" className="block text-xs font-medium text-ink mb-1">
              Start Date
            </label>
            <input
              id="sprint-start-date"
              name="startDate"
              type="date"
              aria-label="Sprint start date"
              className="h-8.5 w-full rounded-md border border-rule bg-paper px-2.5 text-xs text-ink transition-colors hover:border-rule-strong focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="sprint-end-date" className="block text-xs font-medium text-ink mb-1">
              End Date
            </label>
            <input
              id="sprint-end-date"
              name="endDate"
              type="date"
              aria-label="Sprint end date"
              className="h-8.5 w-full rounded-md border border-rule bg-paper px-2.5 text-xs text-ink transition-colors hover:border-rule-strong focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label htmlFor="sprint-goal-input" className="block text-xs font-medium text-ink mb-1.5">
            Sprint Goal <span className="text-ink-faint font-normal">(optional)</span>
          </label>
          <textarea
            id="sprint-goal-input"
            name="goal"
            maxLength={500}
            rows={2}
            placeholder="What is the objective of this sprint iteration?"
            aria-label="Sprint goal"
            className="w-full rounded-md border border-rule bg-paper px-3 py-2 text-xs text-ink placeholder:text-ink-faint transition-colors hover:border-rule-strong focus:border-primary focus:outline-none resize-y"
          />
        </div>

        {state.error ? (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
            {state.error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-rule pt-4 mt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={pending} className="bg-primary text-white">
            {pending ? <Spinner className="size-4" /> : <PlusIcon className="size-4" />}
            {pending ? "Adding…" : "Add sprint"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function CreateSprintButton({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={() => setOpen(true)}
        className="bg-primary text-white hover:bg-primary-ink shadow-xs"
      >
        <PlusIcon className="size-4 mr-1.5" />
        Add sprint
      </Button>
      <CreateSprintModal
        open={open}
        onClose={() => setOpen(false)}
        workspaceId={workspaceId}
        projectId={projectId}
      />
    </>
  );
}
