import Link from "next/link";

import { ThemeQuickToggle } from "@/components/theme/theme-toggle";
import {
  ArrowLeftIcon,
  CalendarIcon,
  CheckIcon,
  UserIcon,
} from "@/components/ui/icons";
import { LogoutButton } from "@/features/auth/components/logout-button";
import type { UserProfile } from "@/features/account/account-repository";

export function AccountHeader({ user }: { user: UserProfile }) {
  const initial = user.name?.trim() ? user.name.trim().charAt(0).toUpperCase() : "U";
  const joinedDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(user.createdAt));

  return (
    <div className="rounded-2xl border border-rule bg-panel shadow-xs overflow-hidden">
      {/* Top Banner Navigation Bar */}
      <div className="relative flex items-center justify-between border-b border-rule/70 bg-gradient-to-r from-primary/15 via-primary/5 to-indigo-500/10 px-4 py-3 sm:px-6 sm:py-3.5">
        <Link
          href="/workspaces"
          className="inline-flex items-center gap-2 rounded-lg border border-rule/80 bg-panel/90 px-3 py-1.5 text-xs font-medium text-ink shadow-2xs backdrop-blur transition-all hover:border-primary/40 hover:bg-panel hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeftIcon className="size-3.5 text-ink-faint" />
          <span>Back to Workspaces</span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeQuickToggle />
          <LogoutButton
            variant="secondary"
            size="sm"
            className="h-8 border-rule bg-panel/90 px-3 text-xs shadow-2xs hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:hover:border-rose-900/50 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
          >
            Sign out
          </LogoutButton>
        </div>
      </div>

      {/* User Profile Info Card Body */}
      <div className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="grid size-16 sm:size-18 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary-deep text-2xl font-bold text-white shadow-md ring-4 ring-primary-soft/60">
              {initial}
            </div>

            {/* Name and Metadata */}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl sm:text-2xl font-bold tracking-tight text-ink">
                  {user.name}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckIcon className="size-3" />
                  Active
                </span>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-xs text-ink-soft">
                <span className="font-mono text-ink font-medium rounded-md bg-panel-muted border border-rule px-2 py-0.5 text-[11px]">
                  {user.email}
                </span>
                <span className="text-ink-faint">•</span>
                <span className="inline-flex items-center gap-1 text-ink-faint text-[11px]">
                  <CalendarIcon className="size-3 text-ink-faint" />
                  Member since {joinedDate}
                </span>
              </div>
            </div>
          </div>

          {/* Account scope indicator */}
          <div className="hidden md:flex items-center gap-2 self-center rounded-xl border border-rule bg-paper/60 px-3.5 py-2 text-xs text-ink-soft shadow-2xs">
            <UserIcon className="size-4 text-primary" />
            <span className="font-medium text-ink">Personal Account</span>
          </div>
        </div>
      </div>
    </div>
  );
}
