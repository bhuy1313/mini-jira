"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/inputs";
import { createProjectAction } from "@/features/projects/actions";

export function CreateProjectForm({ workspaceId }: { workspaceId: string }) {
  const bound = (prev: { error?: string } | undefined, formData: FormData) =>
    createProjectAction(workspaceId, formData);
  const [state, formAction, pending] = useActionState(bound, {});

  return (
    <form
      action={formAction}
      className="rounded-lg border border-rule bg-panel p-5 text-ink"
    >
      <p className="text-sm font-medium">New project</p>
      <div className="mt-4 space-y-4">
        <Field label="Name">
          <Input
            name="name"
            required
            maxLength={80}
            placeholder="Project name"
            aria-label="Project name"
          />
        </Field>
        <Field label="Description" hint="optional">
          <Textarea
            name="description"
            maxLength={500}
            placeholder="What is this project about?"
            aria-label="Project description"
            rows={2}
          />
        </Field>
      </div>
      {state.error ? (
        <p role="alert" className="mt-3 text-xs text-danger">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="mt-4 w-full">
        {pending ? "Creating…" : "Create project"}
      </Button>
    </form>
  );
}