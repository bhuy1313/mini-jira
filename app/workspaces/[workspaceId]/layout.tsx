import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { CommandPalette, CommandPaletteTrigger } from "@/components/command-palette";
import { ThemeQuickToggle } from "@/components/theme/theme-toggle";
import { ChevronRightIcon } from "@/components/ui/icons";
import { WorkspaceNav } from "@/features/workspaces/components/workspace-nav";
import { requireActor } from "@/features/workspaces/session";
import {
  BellSkeleton,
  CrumbSkeleton,
  FooterSkeleton,
  MobileAccountSlot,
  NotificationBellSlot,
  SwitcherSkeleton,
  UserFooterSlot,
  WorkspaceCrumbSlot,
  WorkspaceSwitcherSlot,
} from "./_slots";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  // Minimal auth gate (session + membership) — same redirect semantics as
  // before: non-members go to /workspaces. Everything else (workspace name,
  // session user, workspace list, notifications) streams in via slots below
  // so navigation never stalls behind the slowest query.
  const actor = await requireActor(workspaceId).catch(() => null);
  if (!actor) redirect("/workspaces");

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="flex min-h-screen">
        {/* Sidebar (Fixed viewport height, pinned header & footer, independent scroll) */}
        <aside className="sticky top-0 hidden h-screen w-64 xl:w-70 shrink-0 flex-col border-r border-rule bg-panel lg:flex overflow-hidden z-20">
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-rule px-4">
            <Link
              href="/workspaces"
              className="flex items-center gap-2.5 text-sm font-semibold tracking-tight hover:opacity-90 transition-opacity"
            >
              <span className="grid size-7 place-items-center rounded-lg bg-primary text-xs font-bold text-white shadow-2xs">
                M
              </span>
              <span className="font-bold tracking-tight">Mini Jira</span>
            </Link>
          </div>

          {/* Workspace Switcher in dedicated header section (avoids overflow clipping) */}
          <div className="shrink-0 border-b border-rule/70 p-3 bg-panel/50">
            <Suspense fallback={<SwitcherSkeleton />}>
              <WorkspaceSwitcherSlot workspaceId={workspaceId} variant="dropdown" />
            </Suspense>
          </div>

          {/* Nav items scroll independently inside sidebar if content overflows */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <WorkspaceNav workspaceId={workspaceId} variant="vertical" />
          </div>

          {/* Fixed Footer: User profile & Logout - ALWAYS visible at viewport bottom */}
          <div className="shrink-0 border-t border-rule p-3 bg-panel">
            <Suspense fallback={<FooterSkeleton />}>
              <UserFooterSlot actor={actor} />
            </Suspense>
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 h-16 border-b border-rule bg-panel/95 backdrop-blur">
            <div className="flex h-full items-center justify-between gap-4 px-4 lg:px-6">
              <div className="flex min-w-0 items-center gap-4">
                <Link
                  href="/workspaces"
                  className="flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight lg:hidden"
                >
                  <span className="grid size-7 place-items-center rounded-md bg-primary text-xs font-bold text-white">
                    M
                  </span>
                </Link>
                <div className="hidden min-w-0 items-center gap-1.5 text-sm lg:flex">
                  <Link
                    href="/workspaces"
                    className="shrink-0 text-ink-faint transition-colors hover:text-ink"
                  >
                    Workspaces
                  </Link>
                  <ChevronRightIcon className="size-3.5 shrink-0 text-ink-faint" />
                  <Suspense fallback={<CrumbSkeleton />}>
                    <WorkspaceCrumbSlot workspaceId={workspaceId} />
                  </Suspense>
                </div>
                <div className="lg:hidden">
                  <Suspense fallback={<SwitcherSkeleton />}>
                    <WorkspaceSwitcherSlot workspaceId={workspaceId} variant="dropdown" />
                  </Suspense>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <CommandPaletteTrigger />
                <ThemeQuickToggle />
                <div className="hidden sm:block">
                  <Suspense fallback={<BellSkeleton />}>
                    <NotificationBellSlot workspaceId={workspaceId} />
                  </Suspense>
                </div>
                <div className="lg:hidden flex items-center gap-2">
                  <Suspense fallback={<BellSkeleton />}>
                    <NotificationBellSlot workspaceId={workspaceId} />
                  </Suspense>
                  <Suspense fallback={<BellSkeleton />}>
                    <MobileAccountSlot actor={actor} />
                  </Suspense>
                </div>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
      <CommandPalette workspaceId={workspaceId} />
    </div>
  );
}
