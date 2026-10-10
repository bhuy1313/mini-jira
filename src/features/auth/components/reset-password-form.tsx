"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/inputs";
import { authClient } from "@/lib/auth-client";
import { hasValidPassword, PASSWORD_POLICY_MESSAGE } from "@/features/auth/password-policy";

export function ResetPasswordForm({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const newPassword = String(new FormData(event.currentTarget).get("newPassword") ?? "");
    if (!hasValidPassword(newPassword)) {
      setError(PASSWORD_POLICY_MESSAGE);
      return;
    }
    setIsSubmitting(true);
    try {
      const { error: resetError } = await authClient.resetPassword({ newPassword, token });
      if (resetError) {
        setError(resetError.message || "This link is invalid or has expired.");
        return;
      }
      setDone(true);
    } catch {
      setError("Reset is unavailable right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (done) {
    return (
      <p role="status" className="rounded-md border border-rule bg-panel px-3 py-2 text-sm text-ink-soft">
        Password updated.{" "}
        <Link href="/auth" className="font-medium text-primary-ink hover:underline">
          Sign in
        </Link>
      </p>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <Field label="New password">
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>
      {error ? (
        <p role="alert" className="rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={isSubmitting} className="w-full" size="lg">
        {isSubmitting ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
