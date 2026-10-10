import Link from "next/link";

import { LogoutButton } from "@/features/auth/components/logout-button";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { getNotificationData } from "@/features/notifications/queries";
import { WorkspaceSwitcher } from "@/features/workspaces/components/workspace-switcher";
import { getUserWorkspaces, getWorkspaceContext } from "@/features/workspaces/queries";
import { getSessionUser } from "@/features/workspaces/session";
import type { Actor } from "@/features/authorization/actor";

/**
 * Async data slots for the workspace shell (`layout.tsx`).
 *
 * Problem: the layout used to `await` all four queries (context, session
 * user, workspaces, notifications) before rendering anything, so every
 * in-app navigation stalled behind the slowest query even though the page
 * content and sidebar nav need none of that data. Each slot below fetches
 * only what its UI needs and streams in behind a same-footprint skeleton,
 * so the shell + page start painting after the auth gate alone.
 *
 * All queries are `React.cache` memoized per request — slots mounted twice
 * (desktop + mobile) still hit the database once.
 */

/** Same-footprint skeletons so streamed swaps never shift layout. */
export function SwitcherSkeleton() {
  return <div aria-hidden className="h-10 w-full animate-pulse rounded-xl border border-rule/80 bg-paper/60" />;
}

export function BellSkeleton() {
  return <div aria-hidden className="size-8 animate-pulse rounded-md border border-rule bg-paper" />;
}

export function CrumbSkeleton() {
  return <span aria-hidden className="inline-block h-4 w-24 animate-pulse rounded bg-ink/10" />;
}

export function FooterSkeleton() {
  return <div aria-hidden className="h-12 w-full animate-pulse rounded-xl border border-rule/70 bg-paper/60" />;
}

/** Workspace name for the header breadcrumb. */
export async function WorkspaceCrumbSlot({ workspaceId }: { workspaceId: string }) {
  const ctx = await getWorkspaceContext(workspaceId);
  return <span className="truncate font-medium text-ink">{ctx.ws.name}</span>;
}

/** Workspace switcher (rendered in sidebar and mobile header). */
export async function WorkspaceSwitcherSlot({
  workspaceId,
  variant,
}: {
  workspaceId: string;
  variant?: "block" | "dropdown";
}) {
  const workspaces = await getUserWorkspaces();
  return (
    <WorkspaceSwitcher
      workspaces={workspaces}
      currentWorkspaceId={workspaceId}
      variant={variant ?? "dropdown"}
    />
  );
}

/** Header notification bell with badge + dropdown. */
export async function NotificationBellSlot({ workspaceId }: { workspaceId: string }) {
  const notificationData = await getNotificationData();
  return (
    <NotificationBell
      workspaceId={workspaceId}
      notifications={notificationData.notifications}
      unreadCount={notificationData.unreadCount}
    />
  );
}

/** Sidebar footer: profile link + logout. Falls back to actor when the session user row lags. */
export async function UserFooterSlot({ actor }: { actor: Actor }) {
  const user = await getSessionUser();
  const userInitial = user?.name
    ? user.name.charAt(0).toUpperCase()
    : actor.userId.charAt(0).toUpperCase();
  return (
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
  );
}

/** Mobile header account cluster (bell is slotted separately). */
export async function MobileAccountSlot({ actor }: { actor: Actor }) {
  const user = await getSessionUser();
  const userInitial = user?.name
    ? user.name.charAt(0).toUpperCase()
    : actor.userId.charAt(0).toUpperCase();
  return (
    <>
      <Link
        href="/account"
        className="grid size-7 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary-ink"
        title="Account Settings"
      >
        {userInitial}
      </Link>
      <LogoutButton iconOnly />
    </>
  );
}
