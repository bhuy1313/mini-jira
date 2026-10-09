"use client";

import { useActionState, useRef, useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { CloseIcon, EditIcon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import { formatDuration, formatDurationDetailed, parseDuration } from "../duration";
import { updateWorklogAction } from "../actions";
import type { WorklogRecord } from "../worklog-service";

interface EditWorklogModalProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  projectId: string;
  worklog: WorklogRecord;
}

export function EditWorklogModal({
  open,
  onClose,
  workspaceId,
  projectId,
  worklog,
}: EditWorklogModalProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);
  const [timeSpentText, setTimeSpentText] = useState(
    formatDuration(worklog.timeSpentMinutes),
  );

  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      const res = await updateWorklogAction(workspaceId, projectId, worklog.id, formData);
      if (!res?.error) {
        onClose();
      }
      return res;
    },
    {},
  );

  // Reset form state on open transition / worklog change during render
  // (not in an effect).
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevWorklog, setPrevWorklog] = useState(worklog);
  if (open && (!prevOpen || prevWorklog !== worklog)) {
    setPrevOpen(true);
    setPrevWorklog(worklog);
    setTimeSpentText(formatDuration(worklog.timeSpentMinutes));
  } else if (!open && prevOpen) {
    setPrevOpen(false);
  }

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => {
        timeInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  const parsedMinutes = parseDuration(timeSpentText);

  const defaultStartedAt = new Date(
    new Date(worklog.startedAt).getTime() - new Date().getTimezoneOffset() * 60000,
  )
    .toISOString()
    .slice(0, 16);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="edit-worklog-heading"
      panelClassName="max-w-lg p-0 overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-rule bg-paper/50 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="grid size-6 place-items-center rounded-md bg-primary text-white">
            <EditIcon className="size-3.5" />
          </div>
          <h2 id="edit-worklog-heading" className="text-sm font-semibold text-ink">
            Edit Work Log
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
        action={formAction}
        onKeyDown={handleKeyDown}
        className="flex flex-col gap-4 p-5"
      >
        <div>
          <label htmlFor="edit-worklog-time" className="block text-xs font-medium text-ink mb-1">
            Time Spent <span className="text-danger">*</span>
          </label>
          <input
            id="edit-worklog-time"
            ref={timeInputRef}
            name="timeSpent"
            required
            value={timeSpentText}
            onChange={(e) => setTimeSpentText(e.target.value)}
            placeholder="e.g. 2d 4h, 1h 30m, 45m"
            aria-label="Time spent"
            className="h-9 w-full rounded-md border border-rule bg-paper px-3 text-sm text-ink transition-colors hover:border-rule-strong focus:border-primary focus:outline-none"
          />
          {timeSpentText.trim().length > 0 && (
            <div className="mt-1 text-xs">
              {parsedMinutes ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  ✓ {formatDurationDetailed(parsedMinutes)} ({parsedMinutes} minutes)
                </span>
              ) : (
                <span className="text-rose-500">
                  Use standard format: e.g. 2w 1d 4h 30m
                </span>
              )}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="edit-worklog-started" className="block text-xs font-medium text-ink mb-1">
            Date Started
          </label>
          <input
            id="edit-worklog-started"
            name="startedAt"
            type="datetime-local"
            defaultValue={defaultStartedAt}
            aria-label="Date started"
            className="h-9 w-full rounded-md border border-rule bg-paper px-3 text-xs text-ink transition-colors hover:border-rule-strong focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="edit-worklog-desc" className="block text-xs font-medium text-ink mb-1">
            Work Description <span className="text-ink-faint font-normal">(optional)</span>
          </label>
          <textarea
            id="edit-worklog-desc"
            name="description"
            rows={3}
            defaultValue={worklog.description ?? ""}
            placeholder="Describe the work done or progress achieved…"
            aria-label="Work description"
            className="w-full rounded-md border border-rule bg-paper p-2.5 text-xs text-ink transition-colors hover:border-rule-strong focus:border-primary focus:outline-none resize-none"
          />
        </div>

        {state.error ? (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
            {state.error}
          </p>
        ) : null}

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
              disabled={pending || !parsedMinutes}
              className="bg-primary text-white"
            >
              {pending ? <Spinner className="size-4" /> : "Save changes"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
