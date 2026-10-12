"use client";

import { useActionState, useState, useRef, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { CloseIcon, PlusIcon, UsersIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { addMemberAction } from "@/features/workspaces/actions";
import { notifyCreated, notifyError } from "@/lib/notify";

export function InviteMemberModal({
  open,
  onClose,
  workspaceId,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      const res = await addMemberAction(workspaceId, formData);
      if (!res?.error) {
        notifyCreated("member");
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
      labelledBy="invite-member-heading"
      panelClassName="max-w-md p-0 overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-rule bg-paper/50 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="grid size-6 place-items-center rounded-md bg-primary text-white">
            <UsersIcon className="size-3.5" />
          </div>
          <h2 id="invite-member-heading" className="text-sm font-semibold text-ink">
            Add Workspace Member
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
          <label htmlFor="member-email-input" className="block text-xs font-medium text-ink mb-1.5">
            User Email <span className="text-danger">*</span>
          </label>
          <input
            ref={inputRef}
            id="member-email-input"
            name="email"
            type="email"
            required
            placeholder="colleague@example.com"
            aria-label="Member email"
            className="w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-faint transition-colors hover:border-rule-strong focus:border-primary focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-ink-faint">
            Must be the email of an existing registered user.
          </p>
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
            {pending ? "Adding…" : "Add member"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function InviteMemberButton({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={() => setOpen(true)}
        className="bg-primary text-white hover:bg-primary-ink shadow-xs"
      >
        <PlusIcon className="size-4" />
        Add member
      </Button>
      <InviteMemberModal
        open={open}
        onClose={() => setOpen(false)}
        workspaceId={workspaceId}
      />
    </>
  );
}
