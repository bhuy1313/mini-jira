"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/inputs";
import { Modal } from "@/components/ui/modal";
import { PlusIcon } from "@/components/ui/icons";
import { createCustomFieldAction } from "@/features/custom-fields/actions";
import {
  CUSTOM_FIELD_TYPES,
  type CustomFieldType,
} from "@/features/custom-fields/custom-field-service";

export function CreateCustomFieldModal({
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
  const [fieldType, setFieldType] = useState<CustomFieldType>("Text");

  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      const res = await createCustomFieldAction(workspaceId, projectId, formData);
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
      labelledBy="create-custom-field-title"
      panelClassName="max-w-md p-6"
    >
      <div className="flex items-center justify-between pb-3 border-b border-rule">
        <div>
          <h2 id="create-custom-field-title" className="text-lg font-semibold tracking-tight text-ink">
            Add Custom Field
          </h2>
          <p className="text-xs text-ink-soft mt-0.5">
            Configure a custom property to track structured task metadata.
          </p>
        </div>
      </div>

      <form action={formAction} className="mt-4 space-y-4">
        {state?.error ? (
          <div role="alert" className="rounded-md bg-danger/10 border border-danger/20 p-2.5 text-xs text-danger">
            {state.error}
          </div>
        ) : null}

        <Field label="Field Name *">
          <Input
            ref={inputRef}
            name="name"
            required
            maxLength={50}
            placeholder="e.g. Environment, Release Date, Estimate"
            aria-label="Custom field name"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3 items-end">
          <Field label="Field Type">
            <select
              name="type"
              value={fieldType}
              onChange={(e) => setFieldType(e.target.value as CustomFieldType)}
              aria-label="Custom field type"
              className="h-9 w-full rounded-md border border-rule bg-panel px-2 text-sm font-medium text-ink focus:border-primary focus:outline-none"
            >
              {CUSTOM_FIELD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>

          <div className="pb-2">
            <label className="inline-flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input type="checkbox" name="required" className="accent-primary h-4 w-4 rounded" />
              <span>Required field</span>
            </label>
          </div>
        </div>

        {fieldType === "Select" ? (
          <Field label="Options (comma separated) *" hint="e.g., Staging, Production, QA">
            <Input
              name="options"
              required
              placeholder="e.g., Development, Staging, Production"
              aria-label="Dropdown options"
            />
          </Field>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-rule">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Adding…" : "Add custom field"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function CreateCustomFieldButton({
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
        Add custom field
      </Button>
      <CreateCustomFieldModal
        workspaceId={workspaceId}
        projectId={projectId}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
