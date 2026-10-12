import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/features/auth/components/auth-shell";
import { VerifyCodeForm } from "@/features/auth/components/verify-code-form";
import { isEmailEnabled } from "@/lib/email";

export const metadata: Metadata = { title: "Verify your email" };

export default async function VerifyCodePage({
  searchParams,
}: {
  searchParams?: Promise<{ email?: string }>;
}) {
  // Tính năng mail đang đóng băng: đá về đăng nhập thay vì trang chết.
  if (!isEmailEnabled()) redirect("/auth");
  const email = (await searchParams)?.email?.trim() ?? "";

  return (
    <AuthShell>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="mt-1.5 text-sm leading-6 text-ink-soft">
          {email ? (
            <>
              We sent a 6-digit code to <span className="font-medium text-ink">{email}</span>.
            </>
          ) : (
            <>Enter your account email and the 6-digit code we sent you.</>
          )}
        </p>
      </div>
      <div className="mt-7">
        <VerifyCodeForm email={email} />
      </div>
    </AuthShell>
  );
}
