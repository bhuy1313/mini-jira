"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/inputs";
import { authClient } from "@/lib/auth-client";
import { PASSWORD_POLICY_MESSAGE, hasValidPassword } from "@/features/auth/password-policy";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const passwordConfirmation = String(formData.get("passwordConfirmation") ?? "");

    if (!hasValidPassword(password)) {
      setError(PASSWORD_POLICY_MESSAGE);
      return;
    }

    if (password !== passwordConfirmation) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error: signUpError } = await authClient.signUp.email({
        name,
        email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message || "Could not create the account. Please try again.");
        return;
      }

      router.replace(`/auth/verify-code?email=${encodeURIComponent(email)}`);
      router.refresh();
    } catch {
      setError("Could not create the account at this time. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <Field label="Full name">
        <Input id="name" name="name" type="text" autoComplete="name" placeholder="Your name" required />
      </Field>

      <Field label="Email">
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
      </Field>

      <Field label="Password" hint="8–128 chars, upper, lower & number">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>

      <Field label="Confirm password">
        <Input
          id="passwordConfirmation"
          name="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>

      {error ? (
        <p
          aria-live="polite"
          role="alert"
          className="rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting} className="w-full" size="lg">
        {isSubmitting ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}