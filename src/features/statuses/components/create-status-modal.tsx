"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/inputs";
import { Modal } from "@/components/ui/modal";
import { PlusIcon } from "@/components/ui/icons";
import { createStatusAction } from "@/features/statuses/actions";

export function CreateStatusModal({
  workspaceId,
  projectId,
  open,
  onClose,
}: {
  workspaceId: string;
  projectId: string;
  open: boolean;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      const res = await createStatusAction(workspaceId, projectId, formData);
      if (!res?.error) {
        onClose();
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
      labelledBy="create-status-title"
      panelClassName="max-w-md p-6"
    >
      <div className="flex items-center justify-between pb-3 border-b border-rule">
        <div>
          <h2 id="create-status-title" className="text-lg font-semibold tracking-tight text-ink">
            Add Workflow Status
          </h2>
          <p className="text-xs text-ink-soft mt-0.5">
            Create a new status column for your Kanban board.
          </p>
        </div>
      </div>

      <form action={formAction} className="mt-4 space-y-4">
        {state?.error ? (
          <div role="alert" className="rounded-md bg-danger/10 border border-danger/20 p-2.5 text-xs text-danger">
            {state.error}
          </div>
        ) : null}

        <Field label="Status Name" hint="e.g., In Review, QA, Blocked">
          <Input
            ref={inputRef}
            name="name"
            required
            maxLength={50}
            placeholder="e.g. In Review"
            aria-label="Status name"
          />
        </Field>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-rule">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Adding…" : "Add status"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function CreateStatusButton({
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
        variant="primary"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
        Add status
      </Button>
      <CreateStatusModal
        workspaceId={workspaceId}
        projectId={projectId}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
