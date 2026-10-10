"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/inputs";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!email) return;
    setStatus("sending");
    try {
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: "/auth/reset-password",
      });
      setStatus(error ? "error" : "sent");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <p role="status" className="rounded-md border border-rule bg-panel px-3 py-2 text-sm text-ink-soft">
        If an account exists for that email, a reset link is on its way.
      </p>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <Field label="Email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
      </Field>
      {status === "error" ? (
        <p role="alert" className="rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">
          Could not send the reset link. Please try again.
        </p>
      ) : null}
      <Button type="submit" disabled={status === "sending"} className="w-full" size="lg">
        {status === "sending" ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
