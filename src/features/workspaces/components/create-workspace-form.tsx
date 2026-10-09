"use client";

import {
  getFormProps,
  getInputProps,
  getTextareaProps,
  useForm,
} from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/inputs";
import { createWorkspaceAction } from "@/features/workspaces/actions";
import { createWorkspaceSchema } from "@/features/workspaces/workspace-schema";
import type { FieldErrors } from "@/lib/validation";

export function CreateWorkspaceForm() {
  const [state, formAction, pending] = useActionState(
    (
      _prev: { error?: string; fieldErrors?: FieldErrors },
      formData: FormData,
    ) => createWorkspaceAction(formData),
    {},
  );

  const [form, fields] = useForm({
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: createWorkspaceSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <form
      {...getFormProps(form)}
      action={formAction}
      className="mt-4 rounded-lg border border-rule bg-panel p-4 text-ink"
    >
      <p className="text-sm font-medium">New workspace</p>
      <div className="mt-3 space-y-3">
        <Field
          label="Workspace name"
          error={fields.name.errors?.[0] ?? state.fieldErrors?.name?.[0]}
        >
          <Input
            {...getInputProps(fields.name, { type: "text" })}
            maxLength={80}
            placeholder="e.g. Product team"
            aria-label="Workspace name"
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
            maxLength={500}
            placeholder="What is this workspace for?"
            aria-label="Workspace description"
            rows={2}
          />
        </Field>
      </div>
      {state.error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-danger">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="mt-4 w-full">
        {pending ? "Creating…" : "Create workspace"}
      </Button>
    </form>
  );
}
