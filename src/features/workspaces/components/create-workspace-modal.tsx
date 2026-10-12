"use client";

import {
  getFormProps,
  getInputProps,
  getTextareaProps,
  useForm,
} from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { BoardsIcon, CloseIcon, PlusIcon } from "@/components/ui/icons";
import { Input, Textarea } from "@/components/ui/inputs";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { createWorkspaceAction } from "@/features/workspaces/actions";
import { notifyError } from "@/lib/notify";
import { createWorkspaceSchema } from "@/features/workspaces/workspace-schema";
import type { FieldErrors } from "@/lib/validation";
import { WorkspaceIconPicker } from "@/features/workspaces/components/workspace-icon-picker";

export function CreateWorkspaceModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [selectedIconId, setSelectedIconId] = useState<string | null>("rocket");

  const [state, formAction, pending] = useActionState(
    async (
      _prev: { error?: string; fieldErrors?: FieldErrors } | undefined,
      formData: FormData,
    ) => {
      // Thành công thì action redirect (toast không kịp hiện) — chỉ toast khi lỗi.
      const res = await createWorkspaceAction(formData);
      if (res?.error) notifyError(res.error);
      return res;
    },
    {},
  );

  const [form, fields] = useForm({
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: createWorkspaceSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="create-workspace-heading"
      panelClassName="max-w-lg p-0 overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-rule bg-paper/50 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="grid size-7 place-items-center rounded-lg bg-primary text-white shadow-2xs">
            <BoardsIcon className="size-4" />
          </div>
          <div>
            <h2 id="create-workspace-heading" className="text-sm font-semibold text-ink">
              Create Workspace
            </h2>
            <p className="text-[11px] text-ink-soft">
              A workspace brings your team, projects, and tasks together.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="rounded-lg p-1 text-ink-faint transition-colors hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <CloseIcon className="size-4" />
        </button>
      </div>

      <form {...getFormProps(form)} action={formAction} className="p-5 space-y-4">
        {/* Workspace Icon Picker */}
        <WorkspaceIconPicker
          selectedIconId={selectedIconId}
          workspaceName={workspaceName}
          onSelect={setSelectedIconId}
        />

        <Field
          label="Workspace name"
          error={fields.name.errors?.[0] ?? state.fieldErrors?.name?.[0]}
        >
          <Input
            {...getInputProps(fields.name, { type: "text" })}
            ref={inputRef}
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            maxLength={80}
            placeholder="e.g. Acme Engineering, Design Ops"
            aria-label="Workspace name"
            className="text-sm"
          />
        </Field>

        <Field
          label="Description"
          hint="optional"
          error={
            fields.description.errors?.[0] ??
            state.fieldErrors?.description?.[0]
          }
        >
          <Textarea
            {...getTextareaProps(fields.description)}
            placeholder="What is the main purpose of this workspace?"
            aria-label="Workspace description"
            rows={2}
            className="text-sm"
          />
        </Field>

        {state.error ? (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
          >
            {state.error}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2.5 border-t border-rule/60 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={pending}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={pending}
            className="text-xs"
          >
            {pending ? (
              <span className="flex items-center gap-1.5">
                <Spinner className="size-3.5" />
                <span>Creating…</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <PlusIcon className="size-3.5" />
                <span>Create workspace</span>
              </span>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
