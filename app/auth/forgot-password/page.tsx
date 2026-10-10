import type { Metadata } from "next";

import { AuthShell } from "@/features/auth/components/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="mt-1.5 text-sm leading-6 text-ink-soft">
          Enter your account email and we will send you a reset link.
        </p>
      </div>
      <div className="mt-7">
        <ForgotPasswordForm />
      </div>
    </AuthShell>
  );
}
