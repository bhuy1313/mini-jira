import type { Metadata } from "next";

import { AuthShell } from "@/features/auth/components/auth-shell";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const token = (await searchParams)?.token ?? "";
  return (
    <AuthShell>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="mt-1.5 text-sm leading-6 text-ink-soft">
          Enter a new password for your account.
        </p>
      </div>
      <div className="mt-7">
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <p role="alert" className="rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">
            This reset link is missing its token. Please request a new one.
          </p>
        )}
      </div>
    </AuthShell>
  );
}
