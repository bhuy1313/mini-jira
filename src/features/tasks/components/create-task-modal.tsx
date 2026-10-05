"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/inputs";
import { CloseIcon, PlusIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Spinner } from "@/components/ui/spinner";
import type { Role } from "@/features/authorization/permissions";
import { canAssignTask, PRIORITIES } from "@/features/authorization/permissions";
import type { StatusRecord } from "@/features/statuses/status-service";
import { PRIORITY_LABEL } from "@/features/tasks/task-meta";
import type { MemberWithUser } from "@/features/workspaces/workspace-service";

type CreateTaskResult = { error?: string };

export function CreateTaskModal({
  open,
  onClose,
  statuses = [],
  members = [],
  actorRole,
  onCreateTask,
}: {
  open: boolean;
  onClose: () => void;
  statuses?: StatusRecord[];
  members: MemberWithUser[];
  actorRole: Role;
  onCreateTask: (formData: FormData) => Promise<CreateTaskResult>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);

  const canAssign = canAssignTask(actorRole);

  useEffect(() => {
    if (open) {
      // Focus the title input once modal opens
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);
    }
  }, [open]);

  // Support Ctrl+Enter / Cmd+Enter to submit from anywhere in form
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;

    const formData = new FormData(form);
    setPending(true);
    onClose();
    form.reset();

    await onCreateTask(formData);
    setPending(false);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="create-task-heading"
      panelClassName="max-w-xl p-0 overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-rule bg-paper/50 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="grid size-6 place-items-center rounded-md bg-primary text-white">
            <PlusIcon className="size-3.5" />
          </div>
          <h2 id="create-task-heading" className="text-sm font-semibold text-ink">
            Create Task
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

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        className="flex flex-col gap-4 p-5"
      >
        {/* Title Input */}
        <div>
          <label htmlFor="task-title-input" className="block text-xs font-medium text-ink mb-1.5">
            Title <span className="text-danger">*</span>
          </label>
          <input
            ref={titleInputRef}
            id="task-title-input"
            name="title"
            required
            maxLength={200}
            placeholder="What needs to be done?"
            aria-label="Task title"
            className="w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-faint transition-colors hover:border-rule-strong focus:border-primary focus:outline-none"
          />
        </div>

        {/* Description Textarea */}
        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink">Description</span>
          <MarkdownEditor
            name="description"
            rows={3}
            compact
            placeholder="Add context, acceptance criteria or details… (optional)"
            ariaLabel="Task description"
            members={members}
          />
        </div>

        {/* Form Fields Grid */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {/* Status Field */}
          <div>
            <label htmlFor="task-status-select" className="block text-xs font-medium text-ink mb-1">
              Status
            </label>
            {statuses.length > 0 ? (
              <Select
                id="task-status-select"
                name="statusId"
                defaultValue={statuses.find((s) => s.isDefault)?.id ?? statuses[0]?.id ?? ""}
                aria-label="Status"
                className="w-full text-xs"
              >
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            ) : null}
          </div>

          {/* Priority Field */}
          <div>
            <label htmlFor="task-priority-select" className="block text-xs font-medium text-ink mb-1">
              Priority
            </label>
            <Select
              id="task-priority-select"
              name="priority"
              defaultValue="Medium"
              aria-label="Priority"
              className="w-full text-xs"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </Select>
          </div>

          {/* Assignee Field */}
          <div>
            <label htmlFor="task-assignee-select" className="block text-xs font-medium text-ink mb-1">
              Assignee
            </label>
            {canAssign ? (
              <Select
                id="task-assignee-select"
                name="assigneeId"
                defaultValue=""
                aria-label="Assignee"
                className="w-full text-xs"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </Select>
            ) : (
              <p className="text-xs text-ink-faint italic py-1.5">Unassigned</p>
            )}
          </div>

          {/* Due Date Field */}
          <div>
            <label htmlFor="task-duedate-input" className="block text-xs font-medium text-ink mb-1">
              Due Date
            </label>
            <input
              id="task-duedate-input"
              name="dueDate"
              type="date"
              aria-label="Due date"
              className="h-8.5 w-full rounded-md border border-rule bg-paper px-2.5 text-xs text-ink transition-colors hover:border-rule-strong focus:border-primary focus:outline-none"
            />
          </div>

          {/* Original Estimate Field */}
          <div>
            <label htmlFor="task-estimate-input" className="block text-xs font-medium text-ink mb-1">
              Original Estimate <span className="text-ink-faint font-normal">(optional)</span>
            </label>
            <input
              id="task-estimate-input"
              name="originalEstimate"
              type="text"
              placeholder="e.g. 2d 4h, 30m"
              aria-label="Original estimate"
              className="h-8.5 w-full rounded-md border border-rule bg-paper px-2.5 text-xs text-ink transition-colors hover:border-rule-strong focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="mt-2 flex items-center justify-between border-t border-rule pt-4">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-ink-faint">
            <kbd className="rounded border border-rule bg-paper px-1 font-mono text-[10px]">⌘</kbd>
            <span>+</span>
            <kbd className="rounded border border-rule bg-paper px-1 font-mono text-[10px]">Enter</kbd>
            <span>to submit</span>
          </span>

          <div className="flex w-full sm:w-auto items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={pending}
              className="bg-primary text-white"
            >
              {pending ? <Spinner className="size-4" /> : <PlusIcon className="size-4" />}
              {pending ? "Creating…" : "Create task"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
