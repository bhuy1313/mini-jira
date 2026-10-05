"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/inputs";
import { Spinner } from "@/components/ui/spinner";
import { updateWorkspaceAction } from "@/features/workspaces/actions";
import { WorkspaceIconPicker } from "@/features/workspaces/components/workspace-icon-picker";

export function SettingsForm({
  workspaceId,
  name,
  description,
  icon,
}: {
  workspaceId: string;
  name: string;
  description: string | null;
  icon?: string | null;
}) {
  const [workspaceName, setWorkspaceName] = useState(name);
  const [selectedIconId, setSelectedIconId] = useState<string | null>(icon ?? null);

  const bound = (prev: { error?: string } | undefined, formData: FormData) =>
    updateWorkspaceAction(workspaceId, formData);
  const [state, formAction, pending] = useActionState(bound, {});

  return (
    <form action={formAction} className="space-y-4">
      <WorkspaceIconPicker
        selectedIconId={selectedIconId}
        workspaceName={workspaceName}
        onSelect={setSelectedIconId}
      />

      <Field label="Workspace name">
        <Input
          name="name"
          required
          maxLength={80}
          value={workspaceName}
          onChange={(e) => setWorkspaceName(e.target.value)}
          aria-label="Workspace name"
          className="text-sm"
        />
      </Field>

      <Field label="Description" hint="optional">
        <Textarea
          name="description"
          maxLength={500}
          defaultValue={description ?? ""}
          aria-label="Workspace description"
          rows={3}
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

      <Button type="submit" disabled={pending} className="text-xs">
        {pending ? (
          <span className="flex items-center gap-1.5">
            <Spinner className="size-3.5" />
            <span>Saving…</span>
          </span>
        ) : (
          "Save changes"
        )}
      </Button>
    </form>
  );
}