"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";

import { CommandPalette, CommandPaletteTrigger } from "@/components/command-palette";
import { ThemeQuickToggle } from "@/components/theme/theme-toggle";
import { ChevronRightIcon } from "@/components/ui/icons";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { getNotificationData } from "@/features/notifications/queries";
import { WorkspaceNav } from "@/features/workspaces/components/workspace-nav";
import { WorkspaceSwitcher } from "@/features/workspaces/components/workspace-switcher";
import { getWorkspaceContext, getUserWorkspaces } from "@/features/workspaces/queries";
import { getSessionUser } from "@/features/workspaces/session";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    const prev = useRef(pathname);
    if (pathname !== prev.current) {
      setIsNavigating(true);
      prev.current = pathname;
      const timer = setTimeout(() => setIsNavigating(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  const [ctx, notificationData, user, workspaces] = await Promise.all([
    getWorkspaceContext(workspaceId),
    getNotificationData(),
    getSessionUser(),
    getUserWorkspaces(),
  ]);
  const { ws, actor } = ctx;
  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : actor.userId.charAt(0).toUpperCase();

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
            <WorkspaceSwitcher
              workspaces={workspaces}
              currentWorkspaceId={workspaceId}
              variant="dropdown"
            />
          </div>

          {/* Nav items scroll independently inside sidebar if content overflows */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <WorkspaceNav workspaceId={workspaceId} variant="vertical" />
          </div>

          {/* Fixed Footer: User profile & Logout - ALWAYS visible at viewport bottom */}
          <div className="shrink-0 border-t border-rule p-3 bg-panel">
            <div className="flex items-center justify-between rounded-xl border border-rule/70 bg-paper/60 p-2 transition-colors hover:border-rule-strong hover:bg-paper">
              <Link
                href="/account"
                className="group flex min-w-0 flex-1 items-center gap-2.5 text-xs text-ink-soft hover:text-ink transition-colors focus-visible:outline-none"
                title="Account Settings"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary-soft text-xs font-bold text-primary-ink group-hover:ring-1 group-hover:ring-primary shadow-2xs">
                  {userInitial}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-ink group-hover:text-primary leading-tight">
                    {user?.name || "Account"}
                  </p>
                  <p className="truncate text-[10px] text-ink-faint leading-tight mt-0.5">
                    {user?.email || actor.role}
                  </p>
                </div>
              </Link>
              <LogoutButton iconOnly />
            </div>
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
                  <span className="truncate font-medium text-ink">{ws.name}</span>
                </div>
                <div className="lg:hidden">
                  <WorkspaceSwitcher
                    workspaces={workspaces}
                    currentWorkspaceId={workspaceId}
                    variant="dropdown"
                  />
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <CommandPaletteTrigger />
                <ThemeQuickToggle />
                <div className="hidden sm:block">
                  <NotificationBell
                    workspaceId={workspaceId}
                    notifications={notificationData.notifications}
                    unreadCount={notificationData.unreadCount}
                  />
                </div>
                <div className="lg:hidden flex items-center gap-2">
                  <NotificationBell
                    workspaceId={workspaceId}
                    notifications={notificationData.notifications}
                    unreadCount={notificationData.unreadCount}
                  />
                  <Link
                    href="/account"
                    className="grid size-7 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary-ink"
                    title="Account Settings"
                  >
                    {userInitial}
                  </Link>
                  <LogoutButton iconOnly />
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

      {/* Loading banner — hiển thị khi navigate giữa các trang workspace */}
      {isNavigating && (
        <div className="fixed bottom-4 right-4 bg-primary/10 text-primary px-4 py-2 rounded-xl text-sm animate-fade-in flex items-center gap-2">
          <svg className="size-4 animate-spin" viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
            />
          </svg>
          <span>Đang tải dữ liệu workspace...</span>
        </div>
      )}

    </div>
  );
}
