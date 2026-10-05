import type { Metadata } from "next";

import { AccountPageView } from "@/features/account/components/account-page-view";
import { getAccountData } from "@/features/account/queries";

export const metadata: Metadata = {
  title: "Account Settings - Mini Jira",
  description: "Manage your personal profile, security settings, active sessions, and workspaces.",
};

export default async function AccountPage() {
  const accountData = await getAccountData();

  return (
    <div className="min-h-screen bg-paper px-4 py-8 sm:px-6 lg:px-8">
      <AccountPageView overview={accountData} />
    </div>
  );
}
