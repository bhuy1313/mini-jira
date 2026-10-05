import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AuthShell } from "@/features/auth/components/auth-shell";
import { AuthSwitcher } from "@/features/auth/components/auth-switcher";
import { auth } from "@/lib/auth";

export default async function AuthPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session) {
    redirect("/dashboard");
  }

  return (
    <AuthShell>
      <AuthSwitcher />
    </AuthShell>
  );
}
