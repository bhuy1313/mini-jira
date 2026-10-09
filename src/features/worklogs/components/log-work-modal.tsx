"use client";

import { useActionState, useRef, useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ClockIcon, CloseIcon, PlusIcon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import { formatDurationDetailed, parseDuration } from "../duration";
import { logWorkAction } from "../actions";
import { resolveRealTaskId } from "@/features/tasks/pending-task-ids";

interface LogWorkModalProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  projectId: string;
  taskId: string;
  taskTitle: string;
}

export function LogWorkModal({
  open,
  onClose,
  workspaceId,
  projectId,
  taskId,
  taskTitle,
}: LogWorkModalProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);
  const [timeSpentText, setTimeSpentText] = useState("");

  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      // Await the real id when logging work right after task creation.
      const realTaskId = await resolveRealTaskId(taskId);
      const res = await logWorkAction(workspaceId, projectId, realTaskId, formData);
      if (!res?.error) {
        onClose();
      }
      return res;
    },
    {},
  );

  // Reset form state on open transition during render (not in an effect).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open && !prevOpen) {
    setPrevOpen(true);
    setTimeSpentText("");
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

  // Live parse calculation
  const parsedMinutes = parseDuration(timeSpentText);

  // Default datetime-local string (YYYY-MM-DDTHH:mm) — computed once per
  // mount so render stays pure (react-hooks/purity).
  const [defaultStartedAt] = useState(
    () =>
      new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16),
  );

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
      labelledBy="log-work-heading"
      panelClassName="max-w-lg p-0 overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-rule bg-paper/50 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="grid size-6 place-items-center rounded-md bg-primary text-white">
            <ClockIcon className="size-3.5" />
          </div>
          <div>
            <h2 id="log-work-heading" className="text-sm font-semibold text-ink">
              Log Work
            </h2>
            <p className="text-xs text-ink-faint line-clamp-1">{taskTitle}</p>
          </div>
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
        {/* Time Spent Input */}
        <div>
          <label htmlFor="log-work-time" className="block text-xs font-medium text-ink mb-1">
            Time Spent <span className="text-danger">*</span>
          </label>
          <input
            id="log-work-time"
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
          <span className="mt-1 block text-2xs text-ink-faint">
            1w = 5d, 1d = 8h, 1h = 60m
          </span>
        </div>

        {/* Date & Time Started */}
        <div>
          <label htmlFor="log-work-started" className="block text-xs font-medium text-ink mb-1">
            Date Started
          </label>
          <input
            id="log-work-started"
            name="startedAt"
            type="datetime-local"
            defaultValue={defaultStartedAt}
            aria-label="Date started"
            className="h-9 w-full rounded-md border border-rule bg-paper px-3 text-xs text-ink transition-colors hover:border-rule-strong focus:border-primary focus:outline-none"
          />
        </div>

        {/* Work Description */}
        <div>
          <label htmlFor="log-work-desc" className="block text-xs font-medium text-ink mb-1">
            Work Description <span className="text-ink-faint font-normal">(optional)</span>
          </label>
          <textarea
            id="log-work-desc"
            name="description"
            rows={3}
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
              disabled={pending || !parsedMinutes}
              className="bg-primary text-white"
            >
              {pending ? <Spinner className="size-4" /> : <PlusIcon className="size-4" />}
              {pending ? "Logging…" : "Log work"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
