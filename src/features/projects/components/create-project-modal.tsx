"use client";

import { useActionState, useState, useRef, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { BoardsIcon, CloseIcon, PlusIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { createProjectAction } from "@/features/projects/actions";
import { notifyError } from "@/lib/notify";

export function CreateProjectModal({
  open,
  onClose,
  workspaceId,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [projectName, setProjectName] = useState("");
  const [projectKey, setProjectKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      // Thành công thì action redirect sang board (toast không kịp hiện).
      const res = await createProjectAction(workspaceId, formData);
      if (res?.error) notifyError(res.error);
      return res;
    },
    {},
  );

  // Reset form khi đóng (event handler, không phải effect) để lần mở sau sạch.
  function handleClose() {
    setProjectName("");
    setProjectKey("");
    setKeyTouched(false);
    onClose();
  }

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      labelledBy="create-project-heading"
      panelClassName="max-w-md p-0 overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-rule bg-paper/50 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="grid size-6 place-items-center rounded-md bg-primary text-white">
            <BoardsIcon className="size-3.5" />
          </div>
          <h2 id="create-project-heading" className="text-sm font-semibold text-ink">
            Create Project
          </h2>
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close dialog"
          className="rounded p-1 text-ink-faint transition-colors hover:bg-paper hover:text-ink"
        >
          <CloseIcon className="size-4" />
        </button>
      </div>

      <form action={formAction} className="flex flex-col gap-4 p-5">
        <div>
          <label htmlFor="project-name-input" className="block text-xs font-medium text-ink mb-1.5">
            Project Name <span className="text-danger">*</span>
          </label>
          <input
            ref={inputRef}
            id="project-name-input"
            name="name"
            required
            maxLength={80}
            value={projectName}
            onChange={(e) => {
              const v = e.target.value;
              setProjectName(v);
              if (!keyTouched) {
                const stem = v.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase();
                setProjectKey(/^[A-Z0-9]{2,}$/.test(stem) ? stem : "");
              }
            }}
            placeholder="e.g. Website Redesign, Mobile App"
            aria-label="Project name"
            className="w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-faint transition-colors hover:border-rule-strong focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="project-key-input" className="block text-xs font-medium text-ink mb-1.5">
            Project Key <span className="text-ink-faint font-normal">(tasks become KEY-1, KEY-2…)</span>
          </label>
          <input
            id="project-key-input"
            name="key"
            maxLength={10}
            value={projectKey}
            onChange={(e) => {
              setKeyTouched(true);
              setProjectKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10));
            }}
            placeholder="e.g. WEB"
            aria-label="Project key"
            className="w-40 rounded-md border border-rule bg-paper px-3 py-2 text-sm font-mono uppercase text-ink placeholder:text-ink-faint placeholder:normal-case transition-colors hover:border-rule-strong focus:border-primary focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-ink-faint">
            2–10 letters/digits. Leave empty to derive from the name. Cannot be changed later.
          </p>
        </div>

        <div>
          <label htmlFor="project-desc-input" className="block text-xs font-medium text-ink mb-1.5">
            Description <span className="text-ink-faint font-normal">(optional)</span>
          </label>
          <textarea
            id="project-desc-input"
            name="description"
            maxLength={500}
            rows={3}
            placeholder="What is the goal of this project?"
            aria-label="Project description"
            className="w-full rounded-md border border-rule bg-paper px-3 py-2 text-xs text-ink placeholder:text-ink-faint transition-colors hover:border-rule-strong focus:border-primary focus:outline-none resize-y"
          />
        </div>

        {state.error ? (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
            {state.error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-rule pt-4 mt-2">
          <Button type="button" variant="secondary" size="sm" onClick={handleClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={pending} className="bg-primary text-white">
            {pending ? <Spinner className="size-4" /> : <PlusIcon className="size-4" />}
            {pending ? "Creating…" : "Create project"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function CreateProjectButton({ workspaceId }: { workspaceId: string }) {
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
        New project
      </Button>
      <CreateProjectModal
        open={open}
        onClose={() => setOpen(false)}
        workspaceId={workspaceId}
      />
    </>
  );
}
