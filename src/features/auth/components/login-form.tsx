"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/inputs";
import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    setIsSubmitting(true);

    try {
      const { error: signInError } = await authClient.signIn.email({
        email,
        password,
        rememberMe: true,
      });

      if (signInError) {
        setError(
          signInError.message || "The email or password is incorrect.",
        );
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Sign in is unavailable right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
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

      <Field label="Password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
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
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-center text-xs text-ink-faint">
        <Link href="/auth/forgot-password" className="font-medium text-primary-ink hover:underline">
          Forgot your password?
        </Link>
        <span className="mx-1.5" aria-hidden>
          ·
        </span>
        <Link href="/auth/verify-code" className="font-medium text-primary-ink hover:underline">
          Verify your email
        </Link>
      </p>
    </form>
  );
}