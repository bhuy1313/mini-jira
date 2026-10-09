import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/lib/auth";

export const metadata: Metadata = { title: "Mini Jira" };

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session) {
    redirect("/dashboard");
  }
  redirect("/auth");
}