"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { deleteWorkspaceAction } from "@/features/workspaces/actions";

export function DeleteWorkspaceButton({
  workspaceId,
  workspaceName,
}: {
  workspaceId: string;
  workspaceName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    (_prev: { error?: string }, _formData: FormData) =>
      deleteWorkspaceAction(workspaceId),
    {},
  );

  return (
    <>
      <Button type="button" variant="danger" onClick={() => setOpen(true)}>
        Delete workspace
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        labelledBy="delete-workspace-modal-title"
        panelClassName="max-w-md p-6"
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-danger/10 text-danger shrink-0 font-bold text-lg">
              !
            </div>
            <div>
              <h2 id="delete-workspace-modal-title" className="text-lg font-semibold tracking-tight text-ink">
                Delete Workspace Permanently?
              </h2>
              <p className="text-xs text-ink-soft">
                This action is completely irreversible.
              </p>
            </div>
          </div>

          <p className="text-sm text-ink-soft">
            Are you sure you want to permanently delete {workspaceName ? <strong className="text-ink">{workspaceName}</strong> : "this workspace"}?
            All projects, tasks, sprints, members, and workspace API keys will be wiped immediately.
          </p>

          {state?.error ? (
            <div role="alert" className="rounded-md bg-danger/10 border border-danger/20 p-2.5 text-xs text-danger">
              {state.error}
            </div>
          ) : null}

          <form action={formAction} className="flex justify-end gap-2 pt-3 border-t border-rule">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger-solid"
              disabled={pending}
            >
              {pending ? "Deleting…" : "Yes, delete workspace"}
            </Button>
          </form>
        </div>
      </Modal>
    </>
  );
}