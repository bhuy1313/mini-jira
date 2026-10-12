"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/inputs";
import { addMemberAction } from "@/features/workspaces/actions";
import { notifyCreated, notifyError } from "@/lib/notify";

export function AddMemberForm({ workspaceId }: { workspaceId: string }) {
  const bound = async (prev: { error?: string } | undefined, formData: FormData) => {
    const res = await addMemberAction(workspaceId, formData);
    if (res?.error) {
      notifyError(res.error);
    } else {
      notifyCreated("member");
    }
    return res;
  };
  const [state, formAction, pending] = useActionState(bound, {});

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
      <Input
        name="email"
        type="email"
        required
        placeholder="Email of a registered user"
        aria-label="Member email"
        className="sm:max-w-xs"
      />
      <Button type="submit" disabled={pending} className="shrink-0">
        {pending ? "Adding…" : "Add member"}
      </Button>
      {state.error ? (
        <p aria-live="polite" role="alert" className="text-xs text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}