"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/inputs";
import { authClient } from "@/lib/auth-client";

function codeErrorMessage(message: string | undefined): string {
  if (!message) return "This code is invalid or has expired.";
  if (/expir/i.test(message)) return "This code has expired. Request a new one below.";
  if (/attempt/i.test(message)) return "Too many wrong attempts. Request a new code below.";
  return message;
}

export function VerifyCodeForm({ email: initialEmail }: { email: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const targetEmail = email.trim();
    if (!targetEmail) {
      setError("Enter your account email first.");
      return;
    }
    const otp = String(new FormData(event.currentTarget).get("otp") ?? "")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (otp.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setIsSubmitting(true);
    try {
      const { error: verifyError } = await authClient.emailOtp.verifyEmail({ email: targetEmail, otp });
      if (verifyError) {
        setError(codeErrorMessage(verifyError.message));
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Verification is unavailable right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    setError(null);
    setNotice(null);
    const targetEmail = email.trim();
    if (!targetEmail) {
      setError("Enter your account email first.");
      return;
    }
    setIsResending(true);
    try {
      const { error: resendError } = await authClient.emailOtp.sendVerificationOtp({
        email: targetEmail,
        type: "email-verification",
      });
      if (resendError) {
        setError(resendError.message || "Could not resend the code. Please try again.");
        return;
      }
      setNotice("A new code is on its way. It expires in 5 minutes.");
    } catch {
      setError("Could not resend the code. Please try again.");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="space-y-5">
      <form className="space-y-5" onSubmit={handleSubmit}>
        {initialEmail ? null : (
          <Field label="Email">
            <Input
              id="verify-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
        )}
        <Field label="6-digit code" hint="Check your inbox — it expires in 5 minutes">
          <Input
            id="otp"
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="••••••"
            maxLength={6}
            required
            className="text-center text-2xl font-mono tracking-[0.5em]"
          />
        </Field>
        {error ? (
          <p role="alert" className="rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="rounded-md border border-rule bg-panel px-3 py-2 text-sm text-ink-soft">
            {notice}
          </p>
        ) : null}
        <Button type="submit" disabled={isSubmitting} className="w-full" size="lg">
          {isSubmitting ? "Verifying…" : "Verify email"}
        </Button>
      </form>
      <p className="text-center text-xs text-ink-faint">
        Didn&apos;t get a code?{" "}
        <button
          type="button"
          onClick={handleResend}
          disabled={isResending}
          className="font-medium text-primary-ink hover:underline disabled:opacity-50"
        >
          {isResending ? "Sending…" : "Resend code"}
        </button>
      </p>
    </div>
  );
}
