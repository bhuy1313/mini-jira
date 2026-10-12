"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/inputs";
import { updateProjectAction } from "@/features/projects/actions";
import { notifyError, notifyUpdated } from "@/lib/notify";

export function ProjectSettingsForm({
  workspaceId,
  projectId,
  name,
  description,
}: {
  workspaceId: string;
  projectId: string;
  name: string;
  description: string | null;
}) {
  const bound = async (prev: { error?: string } | undefined, formData: FormData) => {
    const res = await updateProjectAction(workspaceId, projectId, formData);
    if (res?.error) {
      notifyError(res.error);
    } else {
      notifyUpdated("project");
    }
    return res;
  };
  const [state, formAction, pending] = useActionState(bound, {});

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Project name">
        <Input
          name="name"
          required
          maxLength={80}
          defaultValue={name}
          aria-label="Project name"
        />
      </Field>
      <Field label="Description" hint="optional">
        <Textarea
          name="description"
          maxLength={500}
          defaultValue={description ?? ""}
          aria-label="Project description"
          rows={3}
        />
      </Field>
      {state.error ? (
        <p role="alert" className="text-xs text-danger">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}