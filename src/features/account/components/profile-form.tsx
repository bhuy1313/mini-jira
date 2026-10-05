"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { UserProfile } from "@/features/account/account-repository";
import { updateProfileAction } from "@/features/account/actions";
import { CheckIcon } from "@/components/ui/icons";

export function ProfileForm({ user }: { user: UserProfile }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name cannot be empty");
      return;
    }

    startTransition(async () => {
      const res = await updateProfileAction({ name: trimmed });
      if (!res.success) {
        setError(res.error || "Failed to update profile");
      } else {
        setSuccess("Profile updated successfully!");
        router.refresh();
      }
    });
  };

  const initial = name ? name.charAt(0).toUpperCase() : "U";

  return (
    <div className="rounded-lg border border-rule bg-panel p-6 shadow-xs">
      <div className="border-b border-rule pb-4">
        <h2 className="text-base font-semibold text-ink">Personal Information</h2>
        <p className="mt-1 text-xs text-ink-soft">
          Update your public display name and view your registered email.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {error && (
          <div
            role="alert"
            className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            <CheckIcon className="size-4 shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        <div className="flex items-center gap-4">
          <div className="grid size-16 place-items-center rounded-full bg-primary-soft text-2xl font-bold text-primary-ink ring-2 ring-primary/20">
            {initial}
          </div>
          <div>
            <p className="text-xs font-medium text-ink">Avatar Preview</p>
            <p className="text-[11px] text-ink-faint">
              Your avatar is generated from your display name initial.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="account-name" className="block text-xs font-medium text-ink">
              Display Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="account-name"
              type="text"
              required
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
              className="mt-1.5 w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="mt-1 text-[11px] text-ink-faint">
              Visible on assigned tasks, comments, and workspace activity logs.
            </p>
          </div>

          <div>
            <label htmlFor="account-email" className="block text-xs font-medium text-ink">
              Email Address
            </label>
            <input
              id="account-email"
              type="email"
              disabled
              value={user.email}
              className="mt-1.5 w-full cursor-not-allowed rounded-md border border-rule bg-panel/60 px-3 py-2 text-sm text-ink-soft opacity-80"
            />
            <p className="mt-1 text-[11px] text-ink-faint">
              Your email is used for sign in and cannot be changed directly.
            </p>
          </div>
        </div>

        <div className="flex justify-end border-t border-rule pt-4">
          <button
            type="submit"
            disabled={isPending || name.trim() === user.name}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-ink focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Saving changes..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
