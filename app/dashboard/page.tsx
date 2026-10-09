import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  redirect("/workspaces");
}

