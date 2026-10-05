"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/inputs";
import { createWorkspaceAction } from "@/features/workspaces/actions";

export function CreateWorkspaceForm() {
  const [state, formAction, pending] = useActionState(
    (_prev: { error?: string }, formData: FormData) => createWorkspaceAction(formData),
    {},
  );

  return (
    <form
      action={formAction}
      className="mt-4 rounded-lg border border-rule bg-panel p-4 text-ink"
    >
      <p className="text-sm font-medium">New workspace</p>
      <div className="mt-3 space-y-3">
        <Field label="Workspace name">
          <Input
            name="name"
            required
            maxLength={80}
            placeholder="e.g. Product team"
            aria-label="Workspace name"
          />
        </Field>
        <Field label="Description" hint="optional">
          <Textarea
            name="description"
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